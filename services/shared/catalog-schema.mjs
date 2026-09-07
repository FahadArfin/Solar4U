import { transaction } from "./postgres.mjs";
import { classifySolarProduct, extractSolarSpecifications } from "./product-taxonomy.mjs";

const statements = [
  `alter table products add column if not exists slug text`,
  `alter table products add column if not exists picker_category text`,
  `alter table products add column if not exists picker_subcategory text`,
  `alter table products add column if not exists specifications jsonb not null default '{}'::jsonb`,
  `alter table products add column if not exists current_image_url text`,
  `alter table products add column if not exists current_condition text`,
  `alter table products add column if not exists current_stock_status text`,
  `alter table products add column if not exists current_retailer_count integer not null default 0`,
  `alter table products add column if not exists current_low_price numeric(14,2)`,
  `alter table products add column if not exists taxonomy_confidence numeric(5,4) not null default 0`,
  `alter table products add column if not exists taxonomy_source text not null default 'legacy'`,
  `alter table retailer_offers add column if not exists original_price numeric(14,2)`,
  `alter table retailer_offers add column if not exists availability_text text`,
  `alter table retailer_offers add column if not exists seller text`,
  `create unique index if not exists products_slug_unique_idx on products(slug) where slug is not null`,
  `create index if not exists products_picker_category_idx on products(picker_category)`,
  `create table if not exists scraper_checkpoints (
    retailer_id text primary key references retailers(id) on delete cascade,
    run_date date not null,
    status text not null default 'queued',
    next_index integer not null default 0,
    discovered_count integer not null default 0,
    processed_count integer not null default 0,
    offer_count integer not null default 0,
    last_url text,
    policy_reason text,
    updated_at timestamptz not null default now()
  )`,
  `create table if not exists scraper_page_cache (
    retailer_id text not null references retailers(id) on delete cascade,
    source_url text not null,
    etag text,
    last_modified text,
    content_hash text,
    last_status text,
    last_error text,
    last_fetched_at timestamptz,
    primary key(retailer_id, source_url)
  )`,
  `create table if not exists product_match_queue (
    id bigserial primary key,
    candidate_product_id text not null references products(id) on delete cascade,
    possible_match_id text references products(id) on delete cascade,
    confidence numeric(5,4) not null default 0,
    evidence jsonb not null default '{}'::jsonb,
    status text not null default 'pending',
    created_at timestamptz not null default now(),
    unique(candidate_product_id, possible_match_id)
  )`,
  `create table if not exists product_classification_votes (
    id bigserial primary key,
    product_id text not null references products(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    picker_category text not null,
    note text,
    status text not null default 'pending' check(status in ('pending','accepted','rejected')),
    created_at timestamptz not null default now(),
    unique(product_id,user_id)
  )`,
  `create table if not exists scraper_source_settings (
    retailer_id text primary key references retailers(id) on delete cascade,
    enabled boolean not null default true,
    schedule_time text not null default '00:00',
    page_delay_ms integer not null default 60000,
    max_pages integer not null default 500,
    policy_override text not null default 'follow_policy' check(policy_override in ('follow_policy','authorized_integration','disabled')),
    integration_kind text,
    authorized_source_url text,
    authorization_reference text,
    updated_by uuid references users(id),
    updated_at timestamptz not null default now()
  )`,
  `alter table scraper_source_settings add column if not exists integration_kind text`,
  `alter table scraper_source_settings add column if not exists authorized_source_url text`,
  `alter table scraper_source_settings add column if not exists authorization_reference text`,
  `alter table scraper_source_settings drop constraint if exists scraper_source_settings_policy_override_check`,
  `alter table scraper_source_settings add constraint scraper_source_settings_policy_override_check
    check(policy_override in ('follow_policy','authorized_integration','disabled'))`,
  `create index if not exists scraper_runs_retailer_started_idx on scraper_runs(retailer_id, started_at desc)`,
  `update products set slug=trim(both '-' from regexp_replace(lower(name),'[^a-z0-9]+','-','g')) || '-' || left(id,7) where slug is null`,
  `update products set picker_category=case
     when category='panel' then 'generation'
     when category in ('inverter','power_station') then 'inverters'
     when category='charge_controller' then 'controllers'
     when category='battery' then 'storage'
     when category='electrical_protection' then 'protection'
     when category='wire' then 'wiring'
     when category in ('mounting','monitoring','tools') then category
     else picker_category end
   where picker_category is null`,
  `update products set picker_subcategory=case
     when category='panel' and lower(name) like '%bifacial%' then 'Bifacial'
     when category='panel' then 'Monofacial'
     when category='battery' then 'Rack / wall battery'
     when category='inverter' and lower(name) like '%hybrid%' then 'Hybrid'
     when category='inverter' then 'Off-grid'
     when category='charge_controller' and lower(name) like '%pwm%' then 'PWM'
     when category='charge_controller' then 'MPPT'
     when category='wire' then 'Connectors / terminals'
     when category='mounting' then 'Clamps / hardware'
     else 'Other' end
   where picker_subcategory is null and picker_category is not null`,
  `update products p set
     current_low_price=summary.low_price,current_retailer_count=summary.retailer_count,
     current_image_url=coalesce(p.current_image_url,summary.image_url),
     current_condition=summary.condition,
     current_stock_status=case when summary.in_stock then 'In stock' else 'Out of stock' end
   from (
     select product_id,min(price) filter(where in_stock) low_price,count(distinct retailer_id) retailer_count,
       (array_agg(image_url order by (image_url is not null) desc,last_observed_at desc))[1] image_url,
       (array_agg(condition order by price asc))[1] condition,bool_or(in_stock) in_stock
     from retailer_offers group by product_id
   ) summary where p.id=summary.product_id and (p.current_low_price is null or p.current_retailer_count=0)`,
];

export async function ensureCatalogSchema() {
  if (!process.env.DATABASE_URL) return { applied: 0, mode: "no_database" };
  await transaction(async client => {
    await client.query("select pg_advisory_xact_lock(hashtext('solar4u_catalog_schema'))");
    for (const statement of statements) await client.query(statement);
    const products = await client.query(
      `select id,name,description,category,picker_category,specifications,taxonomy_source
       from products where taxonomy_source not in ('admin','community_confirmed')`,
    );
    for (const product of products.rows) {
      const classified = classifySolarProduct(product.name, product.description, product.category);
      const specifications = extractSolarSpecifications(product.name, product.description, product.specifications || {});
      await client.query(
        `update products set category=$2,picker_category=$3,picker_subcategory=case
           when $3='mounting' and lower(name) ~ 'roof|flashing|tile|seam' then 'Roof mount'
           when $3='mounting' and lower(name) ~ 'ground' then 'Ground mount'
           when $3='generation' and lower(name) ~ 'bifacial' then 'Bifacial'
           when $3='generation' then 'Monofacial'
           when $3='inverters' and lower(name) ~ 'power station|solar generator' then 'All-in-one power station'
           when $3='inverters' and lower(name) ~ 'microinverter' then 'Microinverter'
           when $3='inverters' and lower(name) ~ 'hybrid' then 'Hybrid'
           when $3='inverters' then 'Inverter'
           when $3='controllers' and lower(name) ~ 'pwm' then 'PWM'
           when $3='controllers' then 'MPPT'
           when $3='storage' then 'Battery / storage'
           when $3='protection' then 'Protection hardware'
           when $3='wiring' then 'Cable / termination'
           when $3='monitoring' then 'Monitoring hardware'
           when $3='tools' then 'Installer tool / PPE'
           else 'Other' end,
           taxonomy_confidence=$4,taxonomy_source=$5,specifications=$6,updated_at=now()
         where id=$1`,
        [product.id, classified.category, classified.pickerCategory, classified.confidence, classified.source, JSON.stringify(specifications)],
      );
    }
  });
  return { applied: statements.length, mode: "database" };
}
