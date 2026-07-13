-- ════════════════════════════════════════════════════════════
-- Iyashi Health — initial schema
-- Modules: Tasuke (SOS), Zumi (freelance doctors), AuraMed (medicine).
-- Kenshin (diagnostics) reserved for a later migration.
-- Run in the Supabase SQL editor, or `supabase db push`.
-- ════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── Enums ───────────────────────────────────────────────────
do $$ begin
  create type role_t as enum ('doctor','ops','admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type doctor_status_t as enum ('online','offline','busy');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sos_category_t as enum ('cardiac','trauma','respiratory','stroke','obstetric','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sos_status_t as enum ('open','assigned','enroute','resolved','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type consult_type_t as enum ('video','home_visit','clinic');
exception when duplicate_object then null; end $$;

do $$ begin
  create type consult_status_t as enum ('pending','accepted','declined','completed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status_t as enum ('placed','packed','out_for_delivery','delivered','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ambulance_status_t as enum ('free','dispatched','busy');
exception when duplicate_object then null; end $$;

-- ── Tables ──────────────────────────────────────────────────
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        role_t not null default 'doctor',
  full_name   text,
  phone       text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

create table if not exists doctors (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid references profiles(id) on delete set null,
  full_name     text not null,
  specialty     text not null default 'General Physician',
  -- 'resident' = licensed junior doctor, not full-time yet.
  -- 'practising' = working doctor taking extra visits for side income.
  kind          text not null default 'practising',
  gender        text not null default 'female',
  experience_years integer not null default 0,
  languages     text[] not null default array['English','Hindi'],
  license_no    text,
  status        doctor_status_t not null default 'offline',
  verified      boolean not null default false,
  rating        numeric(2,1) not null default 0,
  consult_fee   integer not null default 400,
  home_visit_fee integer not null default 900,
  lat           double precision,
  lng           double precision,
  last_seen     timestamptz default now(),
  created_at    timestamptz not null default now()
);

create table if not exists patients (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  phone       text,
  dob         date,
  blood_group text,
  allergies   text,
  created_at  timestamptz not null default now()
);

create table if not exists ambulances (
  id           uuid primary key default gen_random_uuid(),
  vehicle_no   text not null,
  driver_name  text not null,
  status       ambulance_status_t not null default 'free',
  lat          double precision,
  lng          double precision
);

create table if not exists sos_events (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid references patients(id) on delete set null,
  patient_name  text default 'Unknown',
  category      sos_category_t not null default 'other',
  status        sos_status_t not null default 'open',
  address       text,
  lat           double precision not null,
  lng           double precision not null,
  ambulance_id  uuid references ambulances(id) on delete set null,
  doctor_id     uuid references doctors(id) on delete set null,
  notes         text,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

create table if not exists consult_requests (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid references patients(id) on delete set null,
  patient_name  text default 'Patient',
  doctor_id     uuid references doctors(id) on delete set null,
  type          consult_type_t not null default 'video',
  status        consult_status_t not null default 'pending',
  symptoms      text,
  fee           integer not null default 400,
  address       text,
  lat           double precision,
  lng           double precision,
  created_at    timestamptz not null default now()
);

create table if not exists consults (
  id             uuid primary key default gen_random_uuid(),
  request_id     uuid references consult_requests(id) on delete set null,
  doctor_id      uuid references doctors(id) on delete set null,
  patient_id     uuid references patients(id) on delete set null,
  started_at     timestamptz default now(),
  ended_at       timestamptz,
  notes          text
);

create table if not exists prescriptions (
  id          uuid primary key default gen_random_uuid(),
  consult_id  uuid references consults(id) on delete set null,
  doctor_id   uuid references doctors(id) on delete set null,
  patient_id  uuid references patients(id) on delete set null,
  items       jsonb not null default '[]',
  created_at  timestamptz not null default now()
);

create table if not exists dark_stores (
  id      uuid primary key default gen_random_uuid(),
  name    text not null,
  lat     double precision,
  lng     double precision,
  status  text not null default 'open'
);

create table if not exists orders (
  id              uuid primary key default gen_random_uuid(),
  prescription_id uuid references prescriptions(id) on delete set null,
  patient_id      uuid references patients(id) on delete set null,
  patient_name    text default 'Patient',
  dark_store      text,
  status          order_status_t not null default 'placed',
  items           jsonb not null default '[]',
  total           integer not null default 0,
  address         text,
  eta             integer not null default 10,
  created_at      timestamptz not null default now()
);

create table if not exists reviews (
  id           uuid primary key default gen_random_uuid(),
  doctor_id    uuid references doctors(id) on delete cascade,
  patient_id   uuid references patients(id) on delete set null,
  patient_name text default 'Patient',
  rating       integer not null check (rating between 1 and 5),
  comment      text,
  created_at   timestamptz not null default now()
);

-- ── Indexes (latency-critical paths) ────────────────────────
create index if not exists idx_sos_status on sos_events (status);
create index if not exists idx_sos_geo on sos_events (lat, lng);
create index if not exists idx_req_status on consult_requests (status);
create index if not exists idx_req_doctor on consult_requests (doctor_id);
create index if not exists idx_orders_status on orders (status);
create index if not exists idx_doctors_status on doctors (status);

-- ── Role helpers ────────────────────────────────────────────
create or replace function public.role_of(uid uuid)
returns role_t language sql stable security definer set search_path = public as $$
  select role from profiles where id = uid;
$$;

create or replace function public.is_ops()
returns boolean language sql stable as $$
  select coalesce(public.role_of(auth.uid()) in ('ops','admin'), false);
$$;

-- ── New-user trigger: create a profile (+ doctor row) ───────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r role_t := coalesce((new.raw_user_meta_data->>'role')::role_t, 'doctor');
begin
  insert into public.profiles (id, role, full_name, phone)
  values (new.id, r,
          coalesce(new.raw_user_meta_data->>'full_name', 'New user'),
          new.raw_user_meta_data->>'phone');

  if r = 'doctor' then
    insert into public.doctors (profile_id, full_name, specialty, kind)
    values (new.id,
            coalesce(new.raw_user_meta_data->>'full_name', 'New doctor'),
            coalesce(new.raw_user_meta_data->>'specialty', 'General Physician'),
            coalesce(new.raw_user_meta_data->>'kind', 'practising'));
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Nearby SOS (haversine; swap for PostGIS later) ──────────
create or replace function public.nearby_sos(in_lat double precision, in_lng double precision, radius_km double precision)
returns setof sos_events language sql stable as $$
  select * from sos_events s
  where s.status in ('open','assigned','enroute')
    and 6371 * 2 * asin(sqrt(
      power(sin(radians(s.lat - in_lat)/2), 2) +
      cos(radians(in_lat)) * cos(radians(s.lat)) *
      power(sin(radians(s.lng - in_lng)/2), 2)
    )) <= radius_km
  order by s.created_at desc;
$$;

-- ── Row Level Security ──────────────────────────────────────
alter table profiles         enable row level security;
alter table doctors          enable row level security;
alter table patients         enable row level security;
alter table ambulances       enable row level security;
alter table sos_events       enable row level security;
alter table consult_requests enable row level security;
alter table consults         enable row level security;
alter table prescriptions    enable row level security;
alter table dark_stores      enable row level security;
alter table orders           enable row level security;
alter table reviews          enable row level security;

-- profiles: own row, ops see all
create policy "profiles_self_select" on profiles for select
  using (id = auth.uid() or public.is_ops());
create policy "profiles_self_update" on profiles for update
  using (id = auth.uid());

-- doctors: any authenticated user can read the catalog; a doctor edits
-- their own row; ops can do everything.
create policy "doctors_read" on doctors for select
  using (auth.role() = 'authenticated');
create policy "doctors_self_update" on doctors for update
  using (profile_id = auth.uid() or public.is_ops());
create policy "doctors_ops_write" on doctors for insert
  with check (public.is_ops());

-- Operational tables: authenticated read. Writes: ops for everything,
-- doctors may update assignment/status rows. Tighten per policy later.
create policy "sos_read"  on sos_events for select using (auth.role() = 'authenticated');
create policy "sos_write" on sos_events for all
  using (public.is_ops() or auth.role() = 'authenticated')
  with check (public.is_ops() or auth.role() = 'authenticated');

create policy "req_read"  on consult_requests for select using (auth.role() = 'authenticated');
create policy "req_write" on consult_requests for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "orders_read"  on orders for select using (auth.role() = 'authenticated');
create policy "orders_write" on orders for all
  using (public.is_ops()) with check (public.is_ops());

create policy "amb_read"  on ambulances for select using (auth.role() = 'authenticated');
create policy "amb_write" on ambulances for all
  using (public.is_ops()) with check (public.is_ops());

create policy "reviews_read" on reviews for select using (auth.role() = 'authenticated');
create policy "dark_read"    on dark_stores for select using (auth.role() = 'authenticated');
create policy "patients_ops" on patients for all
  using (public.is_ops()) with check (public.is_ops());
create policy "consults_rw"  on consults for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "rx_rw"        on prescriptions for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ── Realtime ────────────────────────────────────────────────
alter publication supabase_realtime add table sos_events;
alter publication supabase_realtime add table consult_requests;
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table doctors;
alter publication supabase_realtime add table ambulances;
