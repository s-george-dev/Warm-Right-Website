-- Warm Right site management setup
-- Run this in Supabase SQL Editor before using the website management admin tools.

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

create table if not exists public.site_offers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text not null default '',
  content_html text not null default '',
  image_url text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_coverage_zones (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  shape_type text not null check (shape_type in ('polygon', 'circle')),
  color text not null default '#0a2c66',
  geometry jsonb not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_content_cards (
  id uuid primary key default gen_random_uuid(),
  card_key text not null unique,
  page_key text not null,
  title text not null default '',
  body_html text not null default '',
  image_url text not null default '',
  image_position_x integer not null default 50 check (image_position_x between 0 and 100),
  image_position_y integer not null default 50 check (image_position_y between 0 and 100),
  image_zoom integer not null default 115 check (image_zoom between 100 and 180),
  mobile_image_position_x integer not null default 50 check (mobile_image_position_x between 0 and 100),
  mobile_image_position_y integer not null default 50 check (mobile_image_position_y between 0 and 100),
  mobile_image_zoom integer not null default 115 check (mobile_image_zoom between 100 and 180),
  show_button boolean not null default true,
  button_label text not null default '',
  button_url text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_heroes (
  id uuid primary key default gen_random_uuid(),
  page_key text not null,
  hero_key text not null default 'hero-1',
  title text not null default '',
  subtitle text not null default '',
  image_url text not null default '',
  image_position_x integer not null default 50 check (image_position_x between 0 and 100),
  image_position_y integer not null default 50 check (image_position_y between 0 and 100),
  image_zoom integer not null default 100 check (image_zoom between 100 and 200),
  mobile_image_position_x integer not null default 50 check (mobile_image_position_x between 0 and 100),
  mobile_image_position_y integer not null default 50 check (mobile_image_position_y between 0 and 100),
  mobile_image_zoom integer not null default 100 check (mobile_image_zoom between 100 and 200),
  link_url text not null default '',
  link_label text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_heroes_unique_key unique (page_key, hero_key)
);

create table if not exists public.site_settings (
  setting_key text primary key,
  setting_value text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.testimonial_submissions (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_email text not null default '',
  customer_phone text not null default '',
  review_date date not null default current_date,
  rating integer not null default 5 check (rating between 1 and 5),
  subject text not null default '',
  content text not null default '',
  image_urls text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_notes text not null default '',
  approved_testimonial_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  related_table text not null default '',
  related_id uuid,
  from_email text not null default '',
  to_email text not null default '',
  subject text not null default '',
  text_body text not null default '',
  html_body text not null default '',
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  error_message text not null default '',
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.site_pages enable row level security;
alter table public.site_carousel_tiles enable row level security;
alter table public.site_offers enable row level security;
alter table public.site_coverage_zones enable row level security;
alter table public.site_content_cards enable row level security;
alter table public.site_heroes enable row level security;
alter table public.site_settings enable row level security;
alter table public.testimonial_submissions enable row level security;
alter table public.email_outbox enable row level security;

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

drop policy if exists "Public can read active offers" on public.site_offers;
create policy "Public can read active offers"
on public.site_offers for select
to anon
using (is_active = true);

drop policy if exists "Authenticated can manage offers" on public.site_offers;
create policy "Authenticated can manage offers"
on public.site_offers for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can read active coverage zones" on public.site_coverage_zones;
create policy "Public can read active coverage zones"
on public.site_coverage_zones for select
to anon
using (is_active = true);

drop policy if exists "Authenticated can manage coverage zones" on public.site_coverage_zones;
create policy "Authenticated can manage coverage zones"
on public.site_coverage_zones for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can read active content cards" on public.site_content_cards;
create policy "Public can read active content cards"
on public.site_content_cards for select
to anon
using (is_active = true);

drop policy if exists "Authenticated can manage content cards" on public.site_content_cards;
create policy "Authenticated can manage content cards"
on public.site_content_cards for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can read active heroes" on public.site_heroes;
create policy "Public can read active heroes"
on public.site_heroes for select
to anon
using (is_active = true);

drop policy if exists "Authenticated can manage heroes" on public.site_heroes;
create policy "Authenticated can manage heroes"
on public.site_heroes for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated can read site settings" on public.site_settings;
create policy "Authenticated can read site settings"
on public.site_settings for select
to authenticated
using (true);

drop policy if exists "Authenticated can manage site settings" on public.site_settings;
create policy "Authenticated can manage site settings"
on public.site_settings for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated can manage testimonial submissions" on public.testimonial_submissions;
create policy "Authenticated can manage testimonial submissions"
on public.testimonial_submissions for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated can manage email outbox" on public.email_outbox;
create policy "Authenticated can manage email outbox"
on public.email_outbox for all
to authenticated
using (true)
with check (true);

alter table public.site_content_cards
add column if not exists show_button boolean not null default true;

alter table public.site_content_cards
add column if not exists mobile_image_position_x integer not null default 50;

alter table public.site_content_cards
add column if not exists mobile_image_position_y integer not null default 50;

alter table public.site_content_cards
add column if not exists mobile_image_zoom integer not null default 115;

alter table public.site_heroes
add column if not exists hero_key text not null default 'hero-1';

alter table public.site_heroes
add column if not exists sort_order integer not null default 0;

alter table public.site_heroes
drop constraint if exists site_heroes_page_key_key;

alter table public.site_heroes
add constraint site_heroes_unique_key unique (page_key, hero_key);

insert into public.site_pages
  (page_key, title, url, nav_group, sort_order, is_active)
values
  ('home', 'Home', 'index.html', 'main', 0, true),
  ('about', 'About Us', 'about.html', 'main', 1, true),
  ('breakdowns', 'Breakdowns', 'services/breakdowns.html', 'services', 0, true),
  ('repairs', 'Repairs', 'services/repairs.html', 'services', 1, true),
  ('annual-servicing', 'Annual Servicing', 'services/annual-servicing.html', 'services', 2, true),
  ('landlords-certificates', 'Landlords Certificates', 'services/landlords-certificates.html', 'services', 3, true),
  ('boiler-installation', 'Boiler Installations', 'services/boiler-installation.html', 'services', 4, true),
  ('general-maintenance', 'Plumbing', 'services/general-maintenance.html', 'services', 5, true),
  ('kitchens-bathrooms', 'Kitchens and Bathrooms', 'services/kitchens-bathrooms.html', 'services', 6, true),
  ('powerflushing-descaling', 'Powerflushing and Descaling', 'services/powerflushing-descaling.html', 'services', 7, true),
  ('second-opinion', 'Second Opinions', 'services/second-opinion.html', 'services', 8, true),
  ('common-faults', 'Common Faults', 'support/common-faults.html', 'support', 0, true),
  ('offers', 'Offers', 'offers.html', 'main', 4, true),
  ('schedule-of-rates', 'Our Rates', 'schedule-of-rates.html', 'main', 3, true)
on conflict (page_key) do update
set title = excluded.title,
    url = excluded.url,
    nav_group = excluded.nav_group,
    sort_order = excluded.sort_order,
    updated_at = now();

insert into public.site_content_cards
  (card_key, page_key, title, body_html, image_url, image_position_x, image_position_y, image_zoom, mobile_image_position_x, mobile_image_position_y, mobile_image_zoom, show_button, button_label, button_url, sort_order, is_active)
values
  (
    'home:intro',
    'home',
    'Welcome to Warm Right',
    'Your home deserves reliable heat, safe systems, and clear advice - and that is exactly what we deliver. We are fully Gas Safe registered, working across Gas, LPG and Oil systems for homeowners, landlords, estate agents, and insurance companies who trust our standards.<br><br>Whether you need a new installation, a system service, or a second opinion, you are in expert hands.<br><br>Feel free to browse our services and support pages for guidance, safety tips, and more information about what we do.',
    'assets/images/professional.jpg',
    50,
    42,
    118,
    50,
    50,
    118,
    true,
    'Book a Visit',
    'book-a-visit.html',
    0,
    true
  ),
  (
    'home:support',
    'home',
    'Need help?',
    'We have created our own fault guides that are easy for anyone to navigate.<br><br>If you need assistance and want to chat, visit our Contact Us page or why not start a live web chat?',
    'assets/images/fault-finder.png',
    50,
    50,
    115,
    50,
    50,
    115,
    true,
    'Contact Us',
    '/contact.html',
    1,
    true
  ),
  ('about:card-1', 'about', 'About Us', '', 'assets/images/professional.jpg', 50, 50, 115, 50, 50, 115, false, '', 'about.html', 0, false),
  ('breakdowns:card-1', 'breakdowns', 'Breakdowns', '', 'assets/images/professional.jpg', 50, 50, 115, 50, 50, 115, false, '', 'services/breakdowns.html', 0, false),
  ('repairs:card-1', 'repairs', 'Repairs', '', 'assets/images/professional.jpg', 50, 50, 115, 50, 50, 115, false, '', 'services/repairs.html', 0, false),
  ('annual-servicing:card-1', 'annual-servicing', 'Annual Servicing', '', 'assets/images/professional.jpg', 50, 50, 115, 50, 50, 115, false, '', 'services/annual-servicing.html', 0, false),
  ('landlords-certificates:card-1', 'landlords-certificates', 'Landlords Certificates', '', 'assets/images/professional.jpg', 50, 50, 115, 50, 50, 115, false, '', 'services/landlords-certificates.html', 0, false),
  ('boiler-installation:card-1', 'boiler-installation', 'Boiler Installations', '', 'assets/images/professional.jpg', 50, 50, 115, 50, 50, 115, false, '', 'services/boiler-installation.html', 0, false),
  ('general-maintenance:card-1', 'general-maintenance', 'Plumbing', '', 'assets/images/professional.jpg', 50, 50, 115, 50, 50, 115, false, '', 'services/general-maintenance.html', 0, false),
  ('kitchens-bathrooms:card-1', 'kitchens-bathrooms', 'Kitchens and Bathrooms', '', 'assets/images/professional.jpg', 50, 50, 115, 50, 50, 115, false, '', 'services/kitchens-bathrooms.html', 0, false),
  ('powerflushing-descaling:card-1', 'powerflushing-descaling', 'Powerflushing and Descaling', '', 'assets/images/professional.jpg', 50, 50, 115, 50, 50, 115, false, '', 'services/powerflushing-descaling.html', 0, false),
  ('second-opinion:card-1', 'second-opinion', 'Second Opinions', '', 'assets/images/professional.jpg', 50, 50, 115, 50, 50, 115, false, '', 'services/second-opinion.html', 0, false),
  ('common-faults:card-1', 'common-faults', 'Common Faults', '', 'assets/images/professional.jpg', 50, 50, 115, 50, 50, 115, false, '', 'support/common-faults.html', 0, false),
  ('offers:card-1', 'offers', 'Offers', '', 'assets/images/professional.jpg', 50, 50, 115, 50, 50, 115, false, '', 'offers.html', 0, false),
  ('schedule-of-rates:card-1', 'schedule-of-rates', 'Our Rates', '', 'assets/images/professional.jpg', 50, 50, 115, 50, 50, 115, false, '', 'schedule-of-rates.html', 0, false)
on conflict (card_key) do nothing;

insert into public.site_settings (setting_key, setting_value)
values ('testimonial_team_email', 'info@warmright.uk')
on conflict (setting_key) do nothing;
