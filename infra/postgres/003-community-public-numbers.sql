create sequence if not exists forum_thread_public_number_seq;

alter table forum_threads
  add column if not exists public_number bigint;

alter sequence forum_thread_public_number_seq
  owned by forum_threads.public_number;

alter table forum_threads
  alter column public_number set default nextval('forum_thread_public_number_seq');

with numbered as (
  select id,row_number() over(order by id) as public_number
  from forum_threads
  where public_number is null
)
update forum_threads t
set public_number=n.public_number
from numbered n
where t.id=n.id;

select setval(
  'forum_thread_public_number_seq',
  coalesce((select max(public_number) from forum_threads),1),
  exists(select 1 from forum_threads)
);

alter table forum_threads
  alter column public_number set not null;

create unique index if not exists forum_threads_public_number_idx
  on forum_threads(public_number);
