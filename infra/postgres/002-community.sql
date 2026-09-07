create extension if not exists pgcrypto;

create table if not exists schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists forum_categories (
  slug text primary key,
  group_name text not null,
  name text not null,
  description text not null,
  icon text not null default 'discussion',
  color text not null default '#e6ad36',
  sort_order integer not null default 0,
  posting_policy text not null default 'member'
    check (posting_policy in ('member','trusted_member','moderator','admin')),
  visibility text not null default 'public'
    check (visibility in ('public','members','staff')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into forum_categories(slug,group_name,name,description,icon,color,sort_order,posting_policy)
values
  ('new-products','Equipment & Design','New Products','New modules, batteries, inverters, controllers and field equipment. Include specifications and source links.','sparkles','#f5b942',10,'member'),
  ('diy-general','Equipment & Design','DIY Solar General','General solar questions, planning discussions and lessons learned that do not fit a narrower board.','sun','#f0a72e',20,'member'),
  ('system-design','Equipment & Design','System Design & Review','Share load assumptions, one-lines and equipment choices for constructive design review.','diagram','#65c98f',30,'member'),
  ('panels-arrays','Equipment & Design','Solar Panels & Array Design','Module specifications, string design, shade, orientation and array performance.','panel','#54b9d5',40,'member'),
  ('batteries-storage','Equipment & Design','Batteries & Energy Storage','Battery chemistry, BMS behavior, rack design, communications and storage sizing.','battery','#75c96b',50,'member'),
  ('inverters-chargers','Equipment & Design','Inverters, Chargers & Controllers','Inverters, transfer equipment, MPPT controllers, generators and commissioning settings.','inverter','#9f8ce5',60,'member'),
  ('electrical-safety','Build & Install','Electrical, Wiring, Safety & Code','Conductors, protection, grounding, rapid shutdown, safe work practices and code questions.','shield','#ed7c6f',70,'member'),
  ('roof-mounting','Build & Install','Roof Mounting','Attachments, flashing, rails, layout, structural review and weatherproofing.','roof','#d8915d',80,'member'),
  ('ground-structures','Build & Install','Ground, Pole & Solar Structures','Ground mounts, pole mounts, pergolas, carports, foundations and site layout.','ground','#8fbf63',90,'member'),
  ('troubleshooting','Build & Install','Troubleshooting & Repairs','Evidence-led fault finding, commissioning problems, monitoring anomalies and repair lessons.','wrench','#ec8d54',100,'member'),
  ('showcase','Build & Install','Build Showcases','Document completed or in-progress systems with photos, decisions and measured results.','camera','#d5a64e',110,'member'),
  ('permits','Local & Professional','Permits, Utilities & Inspection','AHJ, utility, interconnection, inspection and jurisdiction-specific experience.','document','#5aa5c8',120,'member'),
  ('professional','Local & Professional','Professional Installer Corner','Detailed field practice, manufacturer documentation and professional reference discussions.','hardhat','#c6a365',130,'trusted_member'),
  ('promotions','Marketplace','Promotions','Clearly disclosed manufacturer and retailer promotions. Commercial affiliation must be stated.','megaphone','#d26b5f',140,'trusted_member'),
  ('online-deals','Marketplace','Online Deals','Time-sensitive public deals with seller, price, shipping and expiration context.','tag','#57b77c',150,'member'),
  ('for-sale','Marketplace','For Sale & Wanted','Member listings for equipment. State condition, price, location and shipping terms. Solar4U is not an escrow service.','market','#cf8bd7',160,'trusted_member'),
  ('forum-help','Community','Forum Help & Announcements','Community guidelines, feature help and staff announcements.','info','#6fa7db',170,'member')
on conflict(slug) do nothing;

alter table forum_threads add column if not exists kind text not null default 'discussion';
alter table forum_threads add column if not exists status text not null default 'visible';
alter table forum_threads add column if not exists pinned boolean not null default false;
alter table forum_threads add column if not exists featured boolean not null default false;
alter table forum_threads add column if not exists view_count integer not null default 0;
alter table forum_threads add column if not exists bookmark_count integer not null default 0;
alter table forum_threads add column if not exists follower_count integer not null default 0;
alter table forum_threads add column if not exists first_post_id uuid;
alter table forum_threads add column if not exists last_post_id uuid;
alter table forum_threads add column if not exists updated_at timestamptz not null default now();
alter table forum_threads add column if not exists deleted_at timestamptz;

alter table forum_threads drop constraint if exists forum_threads_kind_check;
alter table forum_threads add constraint forum_threads_kind_check
  check (kind in ('discussion','question','new_product','promotion','deal','listing','showcase','troubleshooting'));
alter table forum_threads drop constraint if exists forum_threads_status_check;
alter table forum_threads add constraint forum_threads_status_check
  check (status in ('visible','hidden','deleted'));

insert into forum_categories(slug,group_name,name,description,sort_order)
select distinct category_slug, 'Community', initcap(replace(category_slug,'-',' ')),
       'Imported community category.', 900
from forum_threads
where not exists (select 1 from forum_categories c where c.slug=forum_threads.category_slug)
on conflict(slug) do nothing;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='forum_threads_category_slug_fkey') then
    alter table forum_threads add constraint forum_threads_category_slug_fkey
      foreign key(category_slug) references forum_categories(slug);
  end if;
end $$;

alter table forum_posts add column if not exists is_original boolean not null default false;
alter table forum_posts add column if not exists status text not null default 'visible';
alter table forum_posts add column if not exists position integer not null default 0;
alter table forum_posts add column if not exists reaction_count integer not null default 0;
alter table forum_posts add column if not exists edited_at timestamptz;
alter table forum_posts add column if not exists deleted_by uuid references users(id) on delete set null;

alter table forum_posts drop constraint if exists forum_posts_status_check;
alter table forum_posts add constraint forum_posts_status_check
  check (status in ('visible','hidden','deleted'));
alter table forum_posts drop constraint if exists forum_posts_parent_id_fkey;
alter table forum_posts add constraint forum_posts_parent_id_fkey
  foreign key(parent_id) references forum_posts(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='forum_threads_first_post_id_fkey') then
    alter table forum_threads add constraint forum_threads_first_post_id_fkey
      foreign key(first_post_id) references forum_posts(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname='forum_threads_last_post_id_fkey') then
    alter table forum_threads add constraint forum_threads_last_post_id_fkey
      foreign key(last_post_id) references forum_posts(id) on delete set null;
  end if;
end $$;

alter table reactions drop constraint if exists reactions_reaction_check;
alter table reactions add constraint reactions_reaction_check
  check(reaction in ('like','dislike','helpful','thanks','insightful','field_tested'));
alter table reactions drop constraint if exists reactions_user_id_post_id_reaction_key;

delete from reactions a
using reactions b
where a.user_id=b.user_id and a.post_id=b.post_id
  and (a.created_at<b.created_at or (a.created_at=b.created_at and a.id<b.id));

create unique index if not exists reactions_one_per_user_post_idx on reactions(user_id,post_id);
create index if not exists reactions_post_idx on reactions(post_id);

create table if not exists forum_thread_bookmarks (
  user_id uuid not null references users(id) on delete cascade,
  thread_id uuid not null references forum_threads(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,thread_id)
);

create table if not exists forum_thread_follows (
  user_id uuid not null references users(id) on delete cascade,
  thread_id uuid not null references forum_threads(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,thread_id)
);

alter table moderation_reports add column if not exists reason_code text not null default 'other';
alter table moderation_reports add column if not exists details text;
alter table moderation_reports add column if not exists assigned_to uuid references users(id) on delete set null;
alter table moderation_reports add column if not exists resolved_by uuid references users(id) on delete set null;
alter table moderation_reports add column if not exists updated_at timestamptz not null default now();
alter table moderation_reports drop constraint if exists moderation_reports_target_type_check;
alter table moderation_reports add constraint moderation_reports_target_type_check
  check(target_type in ('thread','post','user'));
alter table moderation_reports drop constraint if exists moderation_reports_status_check;
alter table moderation_reports add constraint moderation_reports_status_check
  check(status in ('open','triaged','resolved','dismissed'));
alter table moderation_reports drop constraint if exists moderation_reports_reason_code_check;
alter table moderation_reports add constraint moderation_reports_reason_code_check
  check(reason_code in ('spam','harassment','scam','unsafe_electrical_advice','misinformation','undisclosed_promotion','wrong_category','other'));

create table if not exists forum_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references users(id) on delete restrict,
  target_type text not null check(target_type in ('thread','post','user','report')),
  target_id uuid not null,
  action text not null check(action in ('lock','unlock','pin','unpin','hide','restore','move','resolve_report','dismiss_report')),
  reason text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists forum_threads_category_activity_idx
  on forum_threads(category_slug,last_activity_at desc,id);
create index if not exists forum_threads_status_activity_idx
  on forum_threads(status,last_activity_at desc,id);
create index if not exists forum_threads_author_idx on forum_threads(author_id,created_at desc);
create index if not exists forum_posts_thread_position_idx on forum_posts(thread_id,position,id);
create index if not exists forum_posts_author_idx on forum_posts(author_id,created_at desc);
create unique index if not exists forum_posts_one_original_per_thread_idx
  on forum_posts(thread_id) where is_original;
create index if not exists moderation_reports_status_created_idx on moderation_reports(status,created_at desc);
create index if not exists forum_threads_search_idx
  on forum_threads using gin(to_tsvector('english',coalesce(title,'') || ' ' || coalesce(body,'')));
create index if not exists forum_posts_search_idx
  on forum_posts using gin(to_tsvector('english',coalesce(body,'')));

insert into users(id,email,display_name,role)
values
  ('00000000-0000-0000-0000-000000000002','maya@solar4u.test','Maya R.','trusted_member'),
  ('00000000-0000-0000-0000-000000000003','jordan@solar4u.test','Jordan Lee','member'),
  ('00000000-0000-0000-0000-000000000004','priya@solar4u.test','Priya Shah','moderator'),
  ('00000000-0000-0000-0000-000000000005','eli@solar4u.test','Eli Turner','trusted_member'),
  ('00000000-0000-0000-0000-000000000006','sam@solar4u.test','Sam K.','member')
on conflict(id) do nothing;

insert into forum_threads(
  id,category_slug,author_id,title,body,kind,reply_count,reaction_count,view_count,
  pinned,featured,locked,created_at,last_activity_at,updated_at
)
values
  ('10000000-0000-0000-0000-000000000001','system-design','00000000-0000-0000-0000-000000000003',
   'Review my 48 V workshop system before I order',
   'I am planning a 48 V system for a detached workshop with a measured 8.4 kWh daily load. The draft uses two six-module strings, a 250 V MPPT controller, a 6 kW inverter and 15 kWh of LFP storage. My cold-corrected string voltage is 218 V. I would appreciate a check of the protection and disconnect assumptions before I order equipment.',
   'question',0,0,284,false,true,false,now()-interval '8 days',now()-interval '35 minutes',now()-interval '35 minutes'),
  ('10000000-0000-0000-0000-000000000002','online-deals','00000000-0000-0000-0000-000000000005',
   'Price check: 400 W bifacial pallet at $0.27 per watt',
   'A retailer is listing a pallet of 400 W bifacial modules at roughly $0.27 per watt before freight. The listing shows new modules with manufacturer warranty. Freight to western New York changes the delivered price substantially, so compare the complete landed cost rather than the headline number.',
   'deal',0,0,612,false,false,false,now()-interval '3 days',now()-interval '2 hours',now()-interval '2 hours'),
  ('10000000-0000-0000-0000-000000000003','troubleshooting','00000000-0000-0000-0000-000000000002',
   'MPPT production drops at noon but array voltage stays normal',
   'My controller output falls by about 35 percent near noon even though array voltage remains inside the tracking window. Battery voltage is near the absorption setpoint and the controller reports no thermal alarm. What measurements would best separate normal charge limiting from an array-side problem?',
   'troubleshooting',0,0,391,false,false,false,now()-interval '5 days',now()-interval '4 hours',now()-interval '4 hours'),
  ('10000000-0000-0000-0000-000000000004','roof-mounting','00000000-0000-0000-0000-000000000004',
   'Field notes: finding rafters below a second layer of shingles',
   'A second roof covering can make rafter layout less obvious and increases the importance of a documented attachment plan. Here is the survey sequence I use before drilling: attic confirmation where accessible, exterior reference measurements, pilot verification, and immediate sealing of abandoned test holes with an approved repair method.',
   'discussion',0,0,455,false,false,false,now()-interval '12 days',now()-interval '1 day',now()-interval '1 day'),
  ('10000000-0000-0000-0000-000000000005','batteries-storage','00000000-0000-0000-0000-000000000006',
   'Mixing two rack-battery production dates on one bus',
   'I have two listed 51.2 V rack batteries from the same product family but they were manufactured ten months apart. Firmware and charge limits match. Before paralleling them, which state-of-charge, open-circuit voltage and communication checks should I record?',
   'question',0,0,198,false,false,false,now()-interval '2 days',now()-interval '5 hours',now()-interval '5 hours'),
  ('10000000-0000-0000-0000-000000000006','new-products','00000000-0000-0000-0000-000000000002',
   'New high-voltage residential battery: questions to ask beyond capacity',
   'Several new residential batteries advertise higher DC bus voltage and easier whole-home integration. Useful comparisons should include compatible inverter models, usable voltage window, isolation and disconnect architecture, fault-current documentation, service procedure, environmental rating and certification—not capacity alone.',
   'new_product',0,0,337,false,false,false,now()-interval '6 days',now()-interval '8 hours',now()-interval '8 hours'),
  ('10000000-0000-0000-0000-000000000007','ground-structures','00000000-0000-0000-0000-000000000005',
   'Ground-mount row spacing for useful winter access',
   'Production software gives me a minimum shade-driven row spacing, but I also want room for snow management, vegetation control and safe service access. For cold-climate residential arrays, what maintenance clearance has worked well in practice?',
   'discussion',0,0,246,false,false,false,now()-interval '9 days',now()-interval '13 hours',now()-interval '13 hours'),
  ('10000000-0000-0000-0000-000000000008','showcase','00000000-0000-0000-0000-000000000003',
   'Commissioned: 9.6 kW garage array with documented torque log',
   'The system passed inspection this week. I am sharing the final one-line, conductor schedule, label set and anonymized commissioning checklist. The most useful habit was recording each specified torque beside the tool serial number and calibration date while the work was still accessible.',
   'showcase',0,0,728,false,true,false,now()-interval '14 days',now()-interval '7 hours',now()-interval '7 hours'),
  ('10000000-0000-0000-0000-000000000009','permits','00000000-0000-0000-0000-000000000004',
   'What changed between plan review and the field inspection?',
   'The approved drawing showed the major equipment correctly, but the field inspector also checked working clearances, label durability, equipment access and whether conductor routing matched the submitted plan. This thread is for documenting practical plan-review lessons without treating another jurisdiction as precedent.',
   'discussion',0,0,164,false,false,false,now()-interval '10 days',now()-interval '2 days',now()-interval '2 days'),
  ('10000000-0000-0000-0000-000000000010','forum-help','00000000-0000-0000-0000-000000000001',
   'Welcome to the Solar4U community workshop',
   'Share enough measurements and source documentation for another builder to follow your reasoning. Identify assumptions, distinguish observed facts from guesses, and never treat a forum reply as permission to work energized or bypass local requirements. Commercial relationships must be disclosed.',
   'discussion',0,0,1042,true,true,false,now()-interval '30 days',now()-interval '3 days',now()-interval '3 days')
on conflict(id) do nothing;

insert into forum_posts(id,thread_id,author_id,body,is_original,position,created_at,updated_at)
select
  ('20000000-0000-0000-0000-' || right(t.id::text,12))::uuid,
  t.id,t.author_id,t.body,true,0,t.created_at,t.created_at
from forum_threads t
where t.id::text like '10000000-0000-0000-0000-%'
on conflict(id) do nothing;

insert into forum_posts(id,thread_id,author_id,parent_id,body,is_original,position,created_at,updated_at)
values
  ('21000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',null,
   'The voltage margin looks reasonable only if the coefficient and design minimum temperature came from the module data sheet and local design conditions. Please add module Isc, parallel-string count, conductor insulation rating and the controller maximum input current. Those values determine the protection review.',false,1,now()-interval '6 days',now()-interval '6 days'),
  ('21000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004','21000000-0000-0000-0000-000000000001',
   'Also confirm whether the battery breaker is listed for the available DC fault current and conductor terminal temperature. A 48 V nominal label does not make every breaker suitable for this duty.',false,2,now()-interval '35 minutes',now()-interval '35 minutes'),
  ('21000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003',null,
   'My delivered quote adds $318 in residential freight and lift-gate service. That moves the effective module price to about $0.31 per watt before racking.',false,1,now()-interval '1 day',now()-interval '1 day'),
  ('21000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000006',null,
   'The warranty PDF names a different model suffix than the storefront title. I would ask the seller to confirm the exact nameplate before ordering.',false,2,now()-interval '2 hours',now()-interval '2 hours'),
  ('21000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004',null,
   'First trend battery current, controller state and target voltage. If output falls exactly as the battery reaches its charge target, that supports normal regulation. Then repeat with a known load if the manufacturer permits it. Avoid opening live PV connectors for troubleshooting.',false,1,now()-interval '3 days',now()-interval '3 days'),
  ('21000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000003',null,
   'I captured the trend and the drop follows the absorption transition within one sample. Array current returns when a controlled load starts, so this appears to be charge limiting rather than clipping.',false,2,now()-interval '4 hours',now()-interval '4 hours'),
  ('21000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000002',null,
   'Follow the battery manufacturer parallel-commissioning sequence. I would record individual state of charge, rested voltage, firmware, alarm history and cable resistance, then use equal-length branch conductors and verify current sharing under a controlled load.',false,1,now()-interval '5 hours',now()-interval '5 hours'),
  ('21000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000004',null,
   'The structural design and manufacturer manual govern the geometry, but service access is a separate design input. Include room for the specified torque tool, vegetation equipment and a safe path that does not require stepping under unsupported modules.',false,1,now()-interval '13 hours',now()-interval '13 hours'),
  ('21000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000005',null,
   'The torque log is excellent. Adding the final insulation-resistance and polarity results would make this an especially useful commissioning reference.',false,1,now()-interval '7 hours',now()-interval '7 hours')
on conflict(id) do nothing;

update forum_threads t
set first_post_id=p.id
from forum_posts p
where p.thread_id=t.id and p.is_original and t.first_post_id is null;

update forum_threads t
set last_post_id=coalesce((
      select p.id from forum_posts p
      where p.thread_id=t.id and p.status='visible'
      order by p.position desc,p.created_at desc,p.id desc limit 1
    ),t.first_post_id),
    reply_count=(select count(*) from forum_posts p where p.thread_id=t.id and not p.is_original and p.status='visible'),
    last_activity_at=coalesce((
      select max(p.created_at) from forum_posts p where p.thread_id=t.id and p.status='visible'
    ),t.created_at);

update forum_threads
set accepted_post_id='21000000-0000-0000-0000-000000000006'
where id='10000000-0000-0000-0000-000000000003' and accepted_post_id is null;

insert into reactions(id,user_id,post_id,reaction,created_at)
values
  ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','helpful',now()-interval '5 days'),
  ('30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000001','insightful',now()-interval '4 days'),
  ('30000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000003','21000000-0000-0000-0000-000000000001','thanks',now()-interval '3 days'),
  ('30000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','21000000-0000-0000-0000-000000000005','field_tested',now()-interval '2 days'),
  ('30000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000006','21000000-0000-0000-0000-000000000006','helpful',now()-interval '3 hours'),
  ('30000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000008','insightful',now()-interval '6 hours')
on conflict(user_id,post_id) do nothing;

insert into forum_thread_bookmarks(user_id,thread_id)
values
  ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003')
on conflict do nothing;

insert into forum_thread_follows(user_id,thread_id)
values
  ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000005')
on conflict do nothing;

update forum_posts p
set reaction_count=(select count(*) from reactions r where r.post_id=p.id);

update forum_threads t
set reaction_count=(select count(*) from reactions r join forum_posts p on p.id=r.post_id where p.thread_id=t.id),
    bookmark_count=(select count(*) from forum_thread_bookmarks b where b.thread_id=t.id),
    follower_count=(select count(*) from forum_thread_follows f where f.thread_id=t.id);

insert into schema_migrations(version) values('002-community') on conflict(version) do nothing;
