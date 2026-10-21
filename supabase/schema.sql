create table if not exists public.gig_posts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('looking', 'available')),
  role text not null check (char_length(role) between 1 and 60),
  area text not null check (char_length(area) between 1 and 60),
  work_date date not null,
  work_time time,
  work_end_time time,
  photo_url text check (char_length(photo_url) <= 600),
  rate text not null default 'คุยกันได้' check (char_length(rate) <= 50),
  details text not null default '' check (char_length(details) <= 240),
  contact text not null check (char_length(contact) between 1 and 100),
  created_at timestamptz not null default now()
);

alter table public.gig_posts add column if not exists work_time time;
alter table public.gig_posts add column if not exists work_end_time time;
alter table public.gig_posts add column if not exists photo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gig-photos',
  'gig-photos',
  true,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create index if not exists gig_posts_work_date_idx on public.gig_posts (work_date);
create index if not exists gig_posts_created_at_idx on public.gig_posts (created_at desc);

alter table public.gig_posts enable row level security;

grant select, insert on public.gig_posts to anon;

drop policy if exists "Anyone can read gig posts" on public.gig_posts;
create policy "Anyone can read gig posts"
  on public.gig_posts for select
  to anon
  using (true);

drop policy if exists "Anyone can create gig posts" on public.gig_posts;
create policy "Anyone can create gig posts"
  on public.gig_posts for insert
  to anon
  with check (
    work_date >= (now() at time zone 'Asia/Bangkok')::date
    and work_time is not null
    and work_end_time is not null
    and char_length(role) between 1 and 60
    and char_length(area) between 1 and 60
    and char_length(contact) between 1 and 100
  );

drop policy if exists "Anyone can upload gig photos" on storage.objects;
create policy "Anyone can upload gig photos"
  on storage.objects for insert
  to anon
  with check (
    bucket_id = 'gig-photos'
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  );