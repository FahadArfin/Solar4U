alter table products add column if not exists slug text;
alter table products add column if not exists picker_category text;
alter table products add column if not exists picker_subcategory text;
alter table products add column if not exists specifications jsonb not null default '{}'::jsonb;
alter table products add column if not exists current_image_url text;
alter table products add column if not exists current_condition text;
alter table products add column if not exists current_stock_status text;
alter table products add column if not exists current_retailer_count integer not null default 0;
alter table products add column if not exists current_low_price numeric(14,2);
alter table retailer_offers add column if not exists original_price numeric(14,2);
alter table retailer_offers add column if not exists availability_text text;
alter table retailer_offers add column if not exists seller text;

create unique index if not exists products_slug_unique_idx on products(slug) where slug is not null;
create index if not exists products_picker_category_idx on products(picker_category);

create table if not exists scraper_checkpoints (
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
);

create table if not exists scraper_page_cache (
  retailer_id text not null references retailers(id) on delete cascade,
  source_url text not null,
  etag text,
  last_modified text,
  content_hash text,
  last_status text,
  last_error text,
  last_fetched_at timestamptz,
  primary key(retailer_id, source_url)
);

create table if not exists product_match_queue (
  id bigserial primary key,
  candidate_product_id text not null references products(id) on delete cascade,
  possible_match_id text references products(id) on delete cascade,
  confidence numeric(5,4) not null default 0,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique(candidate_product_id, possible_match_id)
);

create index if not exists scraper_runs_retailer_started_idx on scraper_runs(retailer_id, started_at desc);

update products
set slug=trim(both '-' from regexp_replace(lower(name),'[^a-z0-9]+','-','g')) || '-' || left(id,7)
where slug is null;

update products set picker_category=case
  when category='panel' then 'generation'
  when category in ('inverter','power_station') then 'inverters'
  when category='charge_controller' then 'controllers'
  when category='battery' then 'storage'
  when category='electrical_protection' then 'protection'
  when category='wire' then 'wiring'
  when category in ('mounting','monitoring','tools') then category
  else picker_category end
where picker_category is null;

update products set picker_subcategory=case
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
where picker_subcategory is null and picker_category is not null;
