create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  display_name text not null default 'Local builder',
  google_subject text unique,
  role text not null default 'member' check (role in ('member','trusted_member','moderator','editor','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists retailers (
  id text primary key,
  name text not null,
  base_url text not null,
  status text not null default 'pending_policy_review' check (status in ('enabled','disabled_by_policy','pending_policy_review','degraded','failed')),
  policy_note text,
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id text primary key,
  name text not null,
  brand text,
  model text,
  category text not null default 'other',
  description text,
  watts numeric,
  capacity_wh numeric,
  voltage numeric,
  search_text text not null default '',
  match_status text not null default 'matched',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_search_idx on products using gin(to_tsvector('english', search_text));
create index if not exists products_category_idx on products(category);

create table if not exists retailer_offers (
  id uuid primary key default gen_random_uuid(),
  retailer_id text not null references retailers(id),
  product_id text not null references products(id),
  source_url text not null,
  source_product_id text,
  price numeric(14,2) not null,
  shipping numeric(14,2),
  currency char(3) not null default 'USD',
  in_stock boolean not null default true,
  condition text not null default 'new',
  quantity integer not null default 1,
  image_url text,
  evidence_hash text not null,
  last_observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(retailer_id, source_url)
);
create index if not exists offers_product_price_idx on retailer_offers(product_id, price);

create table if not exists scraper_runs (
  id uuid primary key,
  retailer_id text references retailers(id),
  status text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  discovered_count integer not null default 0,
  offer_count integer not null default 0,
  error text
);

create table if not exists import_jobs (
  id text primary key,
  source text not null,
  status text not null,
  started_at timestamptz,
  finished_at timestamptz,
  row_count integer not null default 0,
  rejected_count integer not null default 0,
  error text
);

create table if not exists price_observations (
  id bigserial primary key,
  offer_id uuid not null references retailer_offers(id),
  product_id text not null references products(id),
  retailer_id text not null references retailers(id),
  price numeric(14,2) not null,
  shipping numeric(14,2),
  currency char(3) not null default 'USD',
  in_stock boolean not null,
  observed_at timestamptz not null,
  evidence_hash text not null,
  run_id text,
  unique(offer_id, observed_at)
);
create index if not exists price_history_product_date_idx on price_observations(product_id, observed_at desc);

create table if not exists price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  product_id text not null references products(id),
  target_price numeric(14,2) not null,
  currency char(3) not null default 'USD',
  active boolean not null default true,
  last_triggered_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists guides (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  category text not null,
  body_markdown text not null,
  version integer not null default 1,
  reading_minutes integer not null default 5,
  status text not null default 'draft',
  author_id uuid references users(id),
  published_at timestamptz,
  unique(slug, version)
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references users(id) on delete cascade,
  name text not null,
  mount_type text not null check(mount_type in ('roof','ground','manual')),
  private_location jsonb,
  inputs jsonb not null default '{}',
  assumptions jsonb not null default '{}',
  results jsonb,
  provider_versions jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists diagrams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references users(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  name text not null,
  document jsonb not null default '{"nodes":[],"connections":[]}',
  validation_report jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists forum_threads (
  id uuid primary key default gen_random_uuid(),
  category_slug text not null,
  author_id uuid references users(id) on delete set null,
  title text not null,
  body text not null,
  reply_count integer not null default 0,
  reaction_count integer not null default 0,
  accepted_post_id uuid,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create table if not exists forum_posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references forum_threads(id) on delete cascade,
  author_id uuid references users(id) on delete set null,
  parent_id uuid references forum_posts(id) on delete cascade,
  body text not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table forum_threads drop constraint if exists forum_threads_accepted_post_id_fkey;
alter table forum_threads add constraint forum_threads_accepted_post_id_fkey foreign key(accepted_post_id) references forum_posts(id) on delete set null;

create table if not exists reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  post_id uuid not null references forum_posts(id) on delete cascade,
  reaction text not null check(reaction in ('like','helpful','insightful','thanks','dislike')),
  created_at timestamptz not null default now(),
  unique(user_id, post_id, reaction)
);

create table if not exists moderation_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references users(id) on delete set null,
  target_type text not null,
  target_id uuid not null,
  reason text not null,
  status text not null default 'open',
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists durable_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  idempotency_key text not null unique,
  status text not null default 'queued',
  payload jsonb not null,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  finished_at timestamptz,
  last_error text
);

insert into users(id,email,display_name,role)
values('00000000-0000-0000-0000-000000000001','local@solar4u.test','Fahad (Local)','admin')
on conflict(id) do nothing;

insert into guides(slug,title,category,body_markdown,version,reading_minutes,status,author_id,published_at)
values
('series-vs-parallel','Series vs. parallel arrays','array-design','# Series vs. parallel arrays

Series raises voltage. Parallel raises current. Verify cold Voc and conductor ampacity before committing to a string design.',1,12,'published','00000000-0000-0000-0000-000000000001',now()),
('wire-overcurrent','Wire and overcurrent sizing','safety','# Wire and overcurrent sizing

Start with continuous current, apply required factors, then coordinate conductor ampacity with terminal and overcurrent ratings.',1,18,'published','00000000-0000-0000-0000-000000000001',now())
on conflict(slug,version) do nothing;
