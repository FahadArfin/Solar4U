alter table products add column if not exists taxonomy_confidence numeric(5,4) not null default 0;
alter table products add column if not exists taxonomy_source text not null default 'legacy';

create table if not exists product_classification_votes (
  id bigserial primary key,
  product_id text not null references products(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  picker_category text not null,
  note text,
  status text not null default 'pending' check(status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  unique(product_id,user_id)
);

create table if not exists scraper_source_settings (
  retailer_id text primary key references retailers(id) on delete cascade,
  enabled boolean not null default true,
  schedule_time text not null default '00:00',
  page_delay_ms integer not null default 60000,
  max_pages integer not null default 500,
  policy_override text not null default 'follow_policy' check(policy_override in ('follow_policy','disabled')),
  updated_by uuid references users(id),
  updated_at timestamptz not null default now()
);
