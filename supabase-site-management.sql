-- Warm Right site management setup
-- Run this in Supabase SQL Editor before using admin/site-management.html.

create table if not exists public.site_pages (
  id uuid primary key default gen_random_uuid(),
  page_key text not null unique,
  title text not null,
  url text not null,
  nav_group text not null default 'main',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_carousel_tiles (
  id uuid primary key default gen_random_uuid(),
  carousel_key text not null,
  tile_key text not null,
  title text not null,
  description text not null,
  image_url text not null,
  link_url text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_carousel_tiles_description_len check (char_length(description) <= 150),
  constraint site_carousel_tiles_unique_key unique (carousel_key, tile_key)
);

alter table public.site_pages enable row level security;
alter table public.site_carousel_tiles enable row level security;

drop policy if exists "Public can read active pages" on public.site_pages;
drop policy if exists "Public can read page visibility" on public.site_pages;
create policy "Public can read page visibility"
on public.site_pages for select
to anon
using (true);

drop policy if exists "Authenticated can manage pages" on public.site_pages;
create policy "Authenticated can manage pages"
on public.site_pages for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can read active carousel tiles" on public.site_carousel_tiles;
drop policy if exists "Public can read carousel tile visibility" on public.site_carousel_tiles;
create policy "Public can read carousel tile visibility"
on public.site_carousel_tiles for select
to anon
using (true);

drop policy if exists "Authenticated can manage carousel tiles" on public.site_carousel_tiles;
create policy "Authenticated can manage carousel tiles"
on public.site_carousel_tiles for all
to authenticated
using (true)
with check (true);
