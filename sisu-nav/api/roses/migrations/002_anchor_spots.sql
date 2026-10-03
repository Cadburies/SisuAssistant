-- Anchor-spot wind roses (#187). SisuMate Supabase project (same as #88).
-- Written by sisu-nav-api with the service role; read by SisuMate crew via
-- accessible_boat_ids() (boat owner + boat_members). Idempotent.
--
-- anchor_rose_hours: one row per anchored hour — the idempotent unit (Sisu
--   Nav rewrites recent hours every cycle). counts = sparse {"bin,sector": n},
--   bin = index into spec BINS (2/5/7/10/15/20+ kn on AWS), sector = 10°
--   petal (0 = N). Rows with minutes = 0 are hours that stopped counting.
-- anchor_spots: per-spot summary ready to draw — petals as % of samples
--   (same shape as /api/roses cells), steadiness 0..1 (mean resultant
--   length of TWD; 1 = always one direction), swing_m = p90 distance from the
--   spot. minutes = 0 means the spot no longer has any hours: hide it.
create extension if not exists postgis with schema extensions;

create table if not exists public.anchor_spots (
  boat_id text not null references public.boats("supabaseId") on delete cascade,
  spot_id text not null,
  lat double precision not null,
  lon double precision not null,
  loc extensions.geography(point, 4326),
  minutes int not null default 0,
  visits int not null default 0,
  sample_count int not null default 0,
  calm_frac real not null default 0,
  petals jsonb,
  steadiness real,
  swing_m real,
  max_kn real,
  first_seen timestamptz,
  last_seen timestamptz,
  updated_at timestamptz not null default now(),
  primary key (boat_id, spot_id)
);

create index if not exists anchor_spots_gix on public.anchor_spots using gist (loc);

create table if not exists public.anchor_rose_hours (
  boat_id text not null references public.boats("supabaseId") on delete cascade,
  hour timestamptz not null,
  spot_id text,
  stay_start timestamptz,
  lat double precision not null,
  lon double precision not null,
  source text not null default 'swing' check (source in ('swing', 'alarm')),
  minutes int not null default 0,
  sample_count int not null default 0,
  calm_count int not null default 0,
  counts jsonb not null default '{}'::jsonb,
  sin_sum double precision not null default 0,
  cos_sum double precision not null default 0,
  max_kn real,
  swing_m real,
  updated_at timestamptz not null default now(),
  primary key (boat_id, hour)
);

create index if not exists anchor_rose_hours_spot on public.anchor_rose_hours (boat_id, spot_id);

alter table public.anchor_spots enable row level security;
alter table public.anchor_rose_hours enable row level security;

drop policy if exists anchor_spots_boat_read on public.anchor_spots;
create policy anchor_spots_boat_read on public.anchor_spots
  for select to authenticated
  using (boat_id in (select public.accessible_boat_ids()));

drop policy if exists anchor_rose_hours_boat_read on public.anchor_rose_hours;
create policy anchor_rose_hours_boat_read on public.anchor_rose_hours
  for select to authenticated
  using (boat_id in (select public.accessible_boat_ids()));

revoke all on public.anchor_spots, public.anchor_rose_hours from anon;
grant select on public.anchor_spots, public.anchor_rose_hours to authenticated;
