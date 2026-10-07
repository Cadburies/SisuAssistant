-- Community wind roses go user-level (#187). Run after 001 (already live)
-- and 002. Idempotent.
--
-- One shared community, many apps (Sisu Nav, SisuMate, ...), each acting as
-- its own signed-in user:
--   wind_rose_uploads  one row per (boat, geohash, month): a boat's own
--                      contribution. Crew of that boat may insert/update/
--                      delete it (accessible_boat_ids()); nobody else sees it.
--   wind_rose_cells    the merged roses everyone reads and may import. Rebuilt
--                      by a security-definer trigger from all uploads of the
--                      cell, so no client needs write access. Public once
--                      boat_count >= 3 (k-anonymity, #88).
-- month 0 = all year, 1-12 = that month.

-- uploads: boat_id is SisuMate's boats."supabaseId" (text), month not null
do $$
begin
  if (select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'wind_rose_uploads' and column_name = 'boat_id') = 'uuid' then
    alter table public.wind_rose_uploads alter column boat_id type text using boat_id::text;
  end if;
end $$;
update public.wind_rose_uploads set month = 0 where month is null;
alter table public.wind_rose_uploads alter column month set default 0;
alter table public.wind_rose_uploads alter column month set not null;
-- Pre-#187 rows came from a service role with random ids — not real boats.
delete from public.wind_rose_uploads u
  where not exists (select 1 from public.boats b where b."supabaseId" = u.boat_id);
alter table public.wind_rose_uploads add column if not exists contributor uuid default auth.uid();
drop index if exists public.wind_rose_uploads_boat_cell;
do $$
begin
  alter table public.wind_rose_uploads
    add constraint wind_rose_uploads_boat_geohash_month unique (boat_id, geohash, month);
exception when duplicate_object or duplicate_table then null;
end $$;
do $$
begin
  alter table public.wind_rose_uploads
    add constraint wind_rose_uploads_boat_fk foreign key (boat_id)
    references public.boats("supabaseId") on delete cascade;
exception when duplicate_object then null;
end $$;

-- cells: month 0..12, not null, plain unique key for the trigger's upsert
alter table public.wind_rose_cells drop constraint if exists wind_rose_cells_month_check;
update public.wind_rose_cells set month = 0 where month is null;
alter table public.wind_rose_cells alter column month set default 0;
alter table public.wind_rose_cells alter column month set not null;
do $$
begin
  alter table public.wind_rose_cells add constraint wind_rose_cells_month_range check (month between 0 and 12);
exception when duplicate_object then null;
end $$;
drop index if exists public.wind_rose_cells_geohash_month;
do $$
begin
  alter table public.wind_rose_cells add constraint wind_rose_cells_geohash_month_key unique (geohash, month);
exception when duplicate_object or duplicate_table then null;
end $$;

-- Merge every boat's upload for one cell: sample-weighted petals/bands,
-- position and calm; boat_count = distinct boats.
create or replace function public.wind_rose_rebuild_cell(p_geohash text, p_month smallint)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  n_total double precision;
  n_boats int;
  merged jsonb;
begin
  select coalesce(sum(sample_count), 0), count(distinct boat_id)
    into n_total, n_boats
    from wind_rose_uploads where geohash = p_geohash and month = p_month;
  if n_total <= 0 then
    delete from wind_rose_cells where geohash = p_geohash and month = p_month;
    return;
  end if;

  with p as (
    select u.sample_count::double precision as w,
           (e->>'deg')::int as deg,
           coalesce((e->>'total')::double precision, 0) as total,
           coalesce(e->'bands', '{}'::jsonb) as bands
      from wind_rose_uploads u, jsonb_array_elements(u.petals) e
     where u.geohash = p_geohash and u.month = p_month
  ),
  tot as (select deg, sum(total * w) / n_total as total from p group by deg),
  bnd as (
    select p.deg, b.key, sum(b.value::double precision * p.w) / n_total as v
      from p, jsonb_each_text(p.bands) b group by p.deg, b.key
  ),
  bj as (select deg, jsonb_object_agg(key, v) as bands from bnd group by deg)
  select coalesce(jsonb_agg(jsonb_build_object('deg', tot.deg, 'total', tot.total,
                                               'bands', coalesce(bj.bands, '{}'::jsonb))
                            order by tot.deg), '[]'::jsonb)
    into merged
    from tot left join bj using (deg);

  insert into wind_rose_cells (geohash, month, lat, lon, loc, calm_frac, petals, sample_count, boat_count, updated_at)
  select p_geohash, p_month, x.lat, x.lon,
         st_setsrid(st_makepoint(x.lon, x.lat), 4326)::geography,
         x.calm, merged, n_total::int, n_boats, now()
    from (
      select sum(lat * sample_count) / n_total as lat,
             sum(lon * sample_count) / n_total as lon,
             sum(calm_frac * sample_count) / n_total as calm
        from wind_rose_uploads where geohash = p_geohash and month = p_month
    ) x
  on conflict (geohash, month) do update set
    lat = excluded.lat, lon = excluded.lon, loc = excluded.loc,
    calm_frac = excluded.calm_frac, petals = excluded.petals,
    sample_count = excluded.sample_count, boat_count = excluded.boat_count,
    updated_at = now();
end $$;

revoke all on function public.wind_rose_rebuild_cell(text, smallint) from public, anon, authenticated;

create or replace function public.wind_rose_uploads_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform wind_rose_rebuild_cell(old.geohash, old.month);
  end if;
  -- AFTER trigger: rebuilding old's cell already sees the new row when the
  -- key is unchanged, so only a new or moved row needs a second rebuild.
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and (new.geohash, new.month) is distinct from (old.geohash, old.month)) then
    perform wind_rose_rebuild_cell(new.geohash, new.month);
  end if;
  return null;
end $$;

drop trigger if exists wind_rose_uploads_merge on public.wind_rose_uploads;
create trigger wind_rose_uploads_merge
  after insert or update or delete on public.wind_rose_uploads
  for each row execute function public.wind_rose_uploads_changed();

-- RLS: own boat's uploads only; cells read-only for everyone (k >= 3)
alter table public.wind_rose_uploads enable row level security;
drop policy if exists wind_rose_uploads_boat_crew on public.wind_rose_uploads;
create policy wind_rose_uploads_boat_crew on public.wind_rose_uploads
  for all to authenticated
  using (boat_id in (select public.accessible_boat_ids()))
  with check (boat_id in (select public.accessible_boat_ids()));
revoke all on public.wind_rose_uploads from anon;
grant select, insert, update, delete on public.wind_rose_uploads to authenticated;

revoke insert, update, delete on public.wind_rose_cells from anon, authenticated;
grant select on public.wind_rose_cells to anon, authenticated;
