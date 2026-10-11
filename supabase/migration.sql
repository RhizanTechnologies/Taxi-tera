-- ============================================================
-- Taxi Tera database migration
-- Run in: Supabase SQL Editor
-- ============================================================

-- ── Profiles ─────────────────────────────────────────────────
create table if not exists profiles (
  id            uuid primary key references auth.users on delete cascade,
  display_name  text,
  role          text not null default 'contributor'
                  check (role in ('contributor','trusted','admin')),
  blocked       boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    nullif(split_part(new.email, '@', 1), ''),
    'User'
  );

  insert into public.profiles (id, display_name)
  values (new.id, v_name)
  on conflict (id) do update
    set display_name = coalesce(public.profiles.display_name, excluded.display_name);

  return new;
exception
  when others then
    raise warning 'handle_new_user error for %: %', new.id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Stations ──────────────────────────────────────────────────
create table if not exists stations (
  id               uuid primary key default gen_random_uuid(),
  name_am          text,
  name_en          text,
  lat              double precision not null,
  lng              double precision not null,
  landmark_am      text,
  landmark_en      text,
  status           text not null default 'active'
                     check (status in ('active','closed','hidden')),
  last_verified_at timestamptz,
  created_by       uuid references profiles,
  created_at       timestamptz not null default now()
);

create index if not exists stations_lat_lng_idx on stations (lat, lng);

-- ── Lines ─────────────────────────────────────────────────────
create table if not exists lines (
  id                uuid primary key default gen_random_uuid(),
  station_id        uuid not null references stations on delete cascade,
  destination_am    text,
  destination_en    text,
  fare_birr         integer check (fare_birr >= 0),
  fare_checked_at   timestamptz,
  direction         text,
  return_station_id uuid references stations,
  sort_order        int not null default 0
);

create index if not exists lines_station_id_idx on lines (station_id);

-- ── Station photos ────────────────────────────────────────────
create table if not exists station_photos (
  id          uuid primary key default gen_random_uuid(),
  station_id  uuid not null references stations on delete cascade,
  path        text not null,
  kind        text check (kind in ('wide','close')),
  created_at  timestamptz not null default now()
);

-- ── Submissions ───────────────────────────────────────────────
create table if not exists submissions (
  id              uuid primary key default gen_random_uuid(),
  type            text not null
                    check (type in ('new_station','edit_station','report')),
  station_id      uuid references stations,
  payload         jsonb not null,
  photo_paths     text[] not null default '{}',
  submitter_id    uuid references profiles,
  submitter_lat   double precision,
  submitter_lng   double precision,
  status          text not null default 'pending'
                    check (status in ('pending','approved','rejected')),
  reviewer_id     uuid references profiles,
  reviewer_note   text,
  created_at      timestamptz not null default now(),
  reviewed_at     timestamptz
);

create index if not exists submissions_status_created_idx on submissions (status, created_at);

-- ── Admin log ─────────────────────────────────────────────────
create table if not exists admin_log (
  id         uuid primary key default gen_random_uuid(),
  admin_id   uuid references profiles,
  action     text not null,
  target_id  uuid,
  note       text,
  created_at timestamptz not null default now()
);

-- ── RLS helper ───────────────────────────────────────────────
create or replace function is_admin()
returns boolean language sql security definer as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ── Enable RLS ────────────────────────────────────────────────
alter table stations       enable row level security;
alter table lines          enable row level security;
alter table station_photos enable row level security;
alter table submissions    enable row level security;
alter table profiles       enable row level security;

-- ── Stations policies ─────────────────────────────────────────
-- Anyone can read active/closed stations
drop policy if exists "stations_read_public" on stations;
create policy "stations_read_public" on stations
  for select using (status in ('active','closed'));

-- Only admins write stations directly
drop policy if exists "stations_write_admin" on stations;
create policy "stations_write_admin" on stations
  for all using (is_admin());

-- ── Lines policies ────────────────────────────────────────────
drop policy if exists "lines_read_public" on lines;
create policy "lines_read_public" on lines
  for select using (
    exists (select 1 from stations s where s.id = lines.station_id and s.status in ('active','closed'))
  );

drop policy if exists "lines_write_admin" on lines;
create policy "lines_write_admin" on lines
  for all using (is_admin());

-- ── Photos policies ───────────────────────────────────────────
drop policy if exists "photos_read_public" on station_photos;
create policy "photos_read_public" on station_photos
  for select using (true);

drop policy if exists "photos_write_admin" on station_photos;
create policy "photos_write_admin" on station_photos
  for all using (is_admin());

-- ── Submissions policies ──────────────────────────────────────
-- Contributors can insert their own submissions
drop policy if exists "submissions_insert_contributor" on submissions;
create policy "submissions_insert_contributor" on submissions
  for insert with check (
    auth.uid() is not null
    and submitter_id = auth.uid()
    and not exists (select 1 from profiles where id = auth.uid() and blocked = true)
  );

-- Users can read their own
drop policy if exists "submissions_read_own" on submissions;
create policy "submissions_read_own" on submissions
  for select using (submitter_id = auth.uid() or is_admin());

-- Admins can update any submission
drop policy if exists "submissions_update_admin" on submissions;
create policy "submissions_update_admin" on submissions
  for update using (is_admin());

-- ── Profiles policies ─────────────────────────────────────────
drop policy if exists "profiles_read_own" on profiles;
create policy "profiles_read_own" on profiles
  for select using (id = auth.uid() or is_admin());

drop policy if exists "profiles_insert_own" on profiles;
create policy "profiles_insert_own" on profiles
  for insert with check (id = auth.uid() or is_admin());

drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles_update_admin" on profiles;
create policy "profiles_update_admin" on profiles
  for update using (is_admin());

-- ── approve_submission function ───────────────────────────────
/*
  Expected payload shape for new_station:
  {
    name_am, name_en, landmark_am, landmark_en, lat, lng,
    lines: [{ destination_am, destination_en, fare_birr, direction, return_station_id }]
  }

  For edit_station: same shape, only changed fields needed.

  For report: { action: 'closed' | 'confirm', ... }
*/
create or replace function approve_submission(submission_id uuid)
returns void language plpgsql security definer as $$
declare
  sub         submissions%rowtype;
  new_station_id uuid;
begin
  -- Only admins
  if not is_admin() then raise exception 'Forbidden'; end if;

  select * into sub from submissions where id = submission_id;
  if not found then raise exception 'Submission not found'; end if;

  if sub.type = 'new_station' then
    -- Insert station
    insert into stations (name_am, name_en, lat, lng, landmark_am, landmark_en, status, last_verified_at, created_by)
    values (
      sub.payload->>'name_am',
      sub.payload->>'name_en',
      (sub.payload->>'lat')::double precision,
      (sub.payload->>'lng')::double precision,
      sub.payload->>'landmark_am',
      sub.payload->>'landmark_en',
      'active',
      now(),
      sub.submitter_id
    )
    returning id into new_station_id;

    -- Insert lines
    insert into lines (station_id, destination_am, destination_en, fare_birr, direction, return_station_id, fare_checked_at, sort_order)
    select
      new_station_id,
      l->>'destination_am',
      l->>'destination_en',
      (l->>'fare_birr')::int,
      l->>'direction',
      (l->>'return_station_id')::uuid,
      now(),
      row_number() over ()
    from jsonb_array_elements(sub.payload->'lines') as l;

    -- Move photos
    insert into station_photos (station_id, path, kind)
    select new_station_id, p, 'wide'
    from unnest(sub.photo_paths) as p;

  elsif sub.type = 'edit_station' or sub.type = 'report' then
    -- 1. Full station fields edited
    if sub.payload ? 'name_am' or sub.payload ? 'name_en' then
      update stations set
        name_am          = coalesce(sub.payload->>'name_am', name_am),
        name_en          = coalesce(sub.payload->>'name_en', name_en),
        landmark_am      = coalesce(sub.payload->>'landmark_am', landmark_am),
        landmark_en      = coalesce(sub.payload->>'landmark_en', landmark_en),
        last_verified_at = now()
      where id = sub.station_id;
    end if;

    -- 2. Suggested landmark submitted
    if sub.payload ? 'suggested_landmark' and (sub.payload->>'suggested_landmark') != '' then
      update stations set
        landmark_am      = sub.payload->>'suggested_landmark',
        last_verified_at = now()
      where id = sub.station_id;
    end if;

    -- 3. Replace all lines if full array provided
    if sub.payload ? 'lines' then
      delete from lines where station_id = sub.station_id;
      insert into lines (station_id, destination_am, destination_en, fare_birr, direction, return_station_id, fare_checked_at, sort_order)
      select
        sub.station_id,
        l->>'destination_am',
        l->>'destination_en',
        (l->>'fare_birr')::int,
        l->>'direction',
        (l->>'return_station_id')::uuid,
        now(),
        row_number() over ()
      from jsonb_array_elements(sub.payload->'lines') as l;
    end if;

    -- 4. If a specific line fare was suggested, apply it
    if sub.payload ? 'line_id' and sub.payload->>'suggested_fare' is not null and (sub.payload->>'suggested_fare') != '' then
      update lines
      set fare_birr = (sub.payload->>'suggested_fare')::int,
          fare_checked_at = now()
      where id = (sub.payload->>'line_id')::uuid;

      update stations set last_verified_at = now() where id = sub.station_id;
    end if;

    -- 5. If new destination line suggested
    if (sub.payload->>'category' = 'add_line' or sub.payload ? 'suggested_new_dest') and sub.payload->>'suggested_fare' is not null and (sub.payload->>'suggested_fare') != '' then
      insert into lines (station_id, destination_am, destination_en, fare_birr, fare_checked_at, sort_order)
      values (
        sub.station_id,
        sub.payload->>'suggested_new_dest',
        sub.payload->>'suggested_new_dest',
        (sub.payload->>'suggested_fare')::int,
        now(),
        99
      );
      update stations set last_verified_at = now() where id = sub.station_id;
    end if;

    -- 6. Station closed or confirmed
    if sub.payload->>'category' = 'station_closed' or sub.payload->>'action' = 'closed' then
      update stations set status = 'closed' where id = sub.station_id;
    elsif sub.payload->>'action' = 'confirm' then
      update stations set last_verified_at = now() where id = sub.station_id;
    end if;
  end if;

  -- Mark submission approved
  update submissions set
    status      = 'approved',
    reviewer_id = auth.uid(),
    reviewed_at = now()
  where id = submission_id;

  -- Log admin action
  insert into admin_log (admin_id, action, target_id)
  values (auth.uid(), 'approve_submission', submission_id);
end;
$$;

-- ── reject_submission function ────────────────────────────────
create or replace function reject_submission(submission_id uuid, note text)
returns void language plpgsql security definer as $$
begin
  if not is_admin() then raise exception 'Forbidden'; end if;

  update submissions set
    status        = 'rejected',
    reviewer_id   = auth.uid(),
    reviewer_note = note,
    reviewed_at   = now()
  where id = submission_id;

  insert into admin_log (admin_id, action, target_id, note)
  values (auth.uid(), 'reject_submission', submission_id, note);
end;
$$;

-- ── Rate limit trigger (max 10 submissions/day) ───────────────
create or replace function check_submission_rate()
returns trigger language plpgsql as $$
declare
  count int;
begin
  select count(*) into count
  from submissions
  where submitter_id = new.submitter_id
    and created_at > now() - interval '24 hours';

  if count >= 10 then
    raise exception 'Rate limit exceeded: max 10 submissions per day';
  end if;

  -- Validate coordinates are inside Addis
  if new.submitter_lat is not null then
    if new.submitter_lat < 8.8 or new.submitter_lat > 9.2
      or new.submitter_lng < 38.6 or new.submitter_lng > 38.95 then
      raise exception 'Location outside Addis Ababa bounding box';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists submission_rate_limit on submissions;
create trigger submission_rate_limit
  before insert on submissions
  for each row execute function check_submission_rate();

-- ── Storage Bucket: station-photos ───────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'station-photos',
  'station-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "station_photos_public_read" on storage.objects;
create policy "station_photos_public_read" on storage.objects
  for select using (bucket_id = 'station-photos');

drop policy if exists "station_photos_authenticated_insert" on storage.objects;
create policy "station_photos_authenticated_insert" on storage.objects
  for insert with check (
    bucket_id = 'station-photos'
    and auth.role() = 'authenticated'
  );

drop policy if exists "station_photos_owner_manage" on storage.objects;
create policy "station_photos_owner_manage" on storage.objects
  for all using (
    bucket_id = 'station-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── Sample stations (replace with real data) ──────────────────
-- Uncomment and run after the migration to seed test data.
/*
insert into stations (name_am, name_en, lat, lng, landmark_am, landmark_en, status) values
  ('መስቀል አደባባይ',  'SAMPLE Meskel Square Tera',   9.0107, 38.7636, 'ከቦሌ መንገድ ፊት', 'Near Bole Road', 'active'),
  ('ካዛንቺስ ተራ',    'SAMPLE Kazanchis Tera',        9.0215, 38.7712, 'ኤምባሲ አካባቢ',    'Near embassies',  'active'),
  ('ፒያሳ ጣቢያ',     'SAMPLE Piassa Tera',            9.0333, 38.7495, 'ሸዋ ዳቦ ጎን',     'Next to Shewa Dabo', 'active'),
  ('ቦሌ ተራ',        'SAMPLE Bole Tera',              8.9944, 38.7890, 'ቦሌ ሚካኤል ቤ/ክ', 'Near Bole Michael Church', 'active'),
  ('ሜክሲኮ',          'SAMPLE Mexico Tera',            9.0093, 38.7578, 'ሜክሲኮ ሰቀላ',    'Mexico roundabout', 'active');
*/
