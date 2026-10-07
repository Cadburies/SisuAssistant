-- Anchor-spot wind roses (#187). SisuMate Supabase project (same as #88).
-- User-level: Sisu Nav signs in as the boat's own Supabase user and writes
-- through RLS, the same way SisuMate crew read (and may edit) it — boat owner
-- + boat_members via accessible_boat_ids(). No service role. Idempotent.
--
-- anchor_rose_hours: one row per anchored hour — the idempotent unit (Sisu
--   Nav rewrites recent hours every cycle). counts = sparse {"bin,sector": n},
--   bin = index into spec BINS (2/5/7/10/15/20+ kn on AWS), sector = 10°
--   petal (0 = N). Rows with minutes = 0 are hours that stopped counting.
-- anchor_spots: per-spot summary ready to draw — petals as % of samples
--   (same shape as /api/roses cells), steadiness 0..1 (mean resultant
--   length of TWD; 1 = always one direction), swing_m = p90 distance from the
--   spot. minutes = 0 means the spot no longer has any hours: hide it.
--   kind = 'anchor' | 'berth' (marina slip/dock; only synced when the
--   owner opted in to berths). heading_deg = mean bow heading — fixed in a
--   slip, so petals vs heading say how the wind lies on the boat.
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
  kind text not null default 'anchor' check (kind in ('anchor', 'berth')),
  heading_deg real,
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
  source text not null default 'swing' check (source in ('swing', 'alarm', 'berth')),
  minutes int not null default 0,
  sample_count int not null default 0,
  calm_count int not null default 0,
  counts jsonb not null default '{}'::jsonb,
  sin_sum double precision not null default 0,
  cos_sum double precision not null default 0,
  max_kn real,
  swing_m real,
  h_sin double precision not null default 0,
  h_cos double precision not null default 0,
  updated_at timestamptz not null default now(),
  primary key (boat_id, hour)
);

create index if not exists anchor_rose_hours_spot on public.anchor_rose_hours (boat_id, spot_id);

alter table public.anchor_spots enable row level security;
alter table public.anchor_rose_hours enable row level security;

drop policy if exists anchor_spots_boat_read on public.anchor_spots;
drop policy if exists anchor_spots_boat_crew on public.anchor_spots;
create policy anchor_spots_boat_crew on public.anchor_spots
  for all to authenticated
  using (boat_id in (select public.accessible_boat_ids()))
  with check (boat_id in (select public.accessible_boat_ids()));

drop policy if exists anchor_rose_hours_boat_read on public.anchor_rose_hours;
drop policy if exists anchor_rose_hours_boat_crew on public.anchor_rose_hours;
create policy anchor_rose_hours_boat_crew on public.anchor_rose_hours
  for all to authenticated
  using (boat_id in (select public.accessible_boat_ids()))
  with check (boat_id in (select public.accessible_boat_ids()));

revoke all on public.anchor_spots, public.anchor_rose_hours from anon;
grant select, insert, update, delete on public.anchor_spots, public.anchor_rose_hours to authenticated;
