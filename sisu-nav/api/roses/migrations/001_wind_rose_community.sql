-- Community wind roses (#88). Apply via Supabase (PostGIS in extensions).
create extension if not exists postgis with schema extensions;

create table if not exists public.wind_rose_cells (
  id uuid primary key default gen_random_uuid(),
  geohash text not null,
  loc extensions.geography(point, 4326) not null,
  lat double precision,
  lon double precision,
  month smallint check (month is null or (month >= 1 and month <= 12)),
  calm_frac real not null,
  petals jsonb not null,
  sample_count int not null,
  boat_count int not null default 1,
  updated_at timestamptz not null default now()
);

create unique index if not exists wind_rose_cells_geohash_month
  on public.wind_rose_cells (geohash, coalesce(month, 0));
create index if not exists wind_rose_cells_gix
  on public.wind_rose_cells using gist (loc);

create table if not exists public.wind_rose_uploads (
  boat_id uuid not null,
  geohash text not null,
  month smallint,
  lat double precision not null,
  lon double precision not null,
  petals jsonb not null,
  sample_count int not null,
  calm_frac real not null default 0,
  updated_at timestamptz not null default now()
);

create unique index if not exists wind_rose_uploads_boat_cell
  on public.wind_rose_uploads (boat_id, geohash, coalesce(month, 0));

alter table public.wind_rose_cells enable row level security;
alter table public.wind_rose_uploads enable row level security;

drop policy if exists wind_rose_cells_public_read on public.wind_rose_cells;
create policy wind_rose_cells_public_read on public.wind_rose_cells
  for select using (boat_count >= 3);

revoke all on public.wind_rose_uploads from anon, authenticated;
grant select on public.wind_rose_cells to anon, authenticated;
