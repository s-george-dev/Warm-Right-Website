create table if not exists public.feedback_surveys (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_email text not null default '',
  customer_phone text not null default '',
  job_number text not null default '',
  customer_address text not null default '',
  engineer_name text not null default '',
  insurer_agent_name text not null default '',
  main_body_communication integer not null default 3 check (main_body_communication between 1 and 5),
  main_body_experience integer not null default 3 check (main_body_experience between 1 and 5),
  main_body_comments text not null default '',
  engineer_communication integer not null default 3 check (engineer_communication between 1 and 5),
  engineer_experience integer not null default 3 check (engineer_experience between 1 and 5),
  engineer_comments text not null default '',
  final_remarks text not null default '',
  wants_contact boolean not null default false,
  source text not null default 'direct',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.feedback_surveys enable row level security;

drop policy if exists "Authenticated can manage feedback surveys" on public.feedback_surveys;
create policy "Authenticated can manage feedback surveys"
on public.feedback_surveys for all
to authenticated
using (true)
with check (true);

alter table public.testimonial_submissions
add column if not exists job_number text not null default '';

alter table public.testimonial_submissions
add column if not exists customer_address text not null default '';

insert into public.site_pages
  (page_key, title, url, nav_group, sort_order, is_active)
values
  ('feedback', 'Feedback Survey', 'feedback.html', 'hidden', 0, true)
on conflict (page_key) do update
set title = excluded.title,
    url = excluded.url,
    nav_group = excluded.nav_group,
    sort_order = excluded.sort_order,
    updated_at = now();
