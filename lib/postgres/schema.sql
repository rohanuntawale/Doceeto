-- ─────────────────────────────────────────────────────────────
-- Iyashi — Postgres schema (Neon, Supabase, or any Postgres).
--
-- Idempotent: safe to run on every boot / deploy. Mirrors the domain types in
-- lib/types/domain.ts one table per entity. Notes on the shape:
--
--  • ids stay TEXT ("doc-<uuid>", "patient-<uuid>") so rows carry the same ids
--    across backends and a migration from the graph needs no remapping.
--  • timestamps are TIMESTAMPTZ; the repo converts to/from ISO strings at the
--    boundary, because the whole app speaks ISO.
--  • JSON-shaped fields (availability, order items) are JSONB.
--  • authorization is enforced in the API route handlers, not with RLS — the
--    app connects as one role, exactly as it did with the graph.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('patient','doctor','ops')),
  name           TEXT NOT NULL,
  address        TEXT,
  lat            DOUBLE PRECISION,
  lng            DOUBLE PRECISION,
  -- Aggregate rating this patient received from doctors (mutual ratings).
  rating         DOUBLE PRECISION,
  rating_count   INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sessions are rows, not signed cookies: the browser holds only `id`, so the
-- database decides who you are and deleting the row ends the session at once.
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  -- The one enforced foreign key (see the note below): a session must belong to
  -- a real account, and deleting the account must end its sessions.
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('patient','doctor','ops')),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx  ON sessions(expires_at);

-- NOTE on foreign keys: only sessions.user_id enforces one, because that is
-- where integrity actually protects something (a session must belong to a real
-- account). Everywhere else the domain allows parentless rows — catalog doctors
-- carry no login, and a request keeps its patient_name after an account goes —
-- so those columns are plain TEXT with an index, exactly as loose as the graph
-- they came from. A hard FK here would reject legitimate rows on migration.
CREATE TABLE IF NOT EXISTS doctors (
  id               TEXT PRIMARY KEY,
  full_name        TEXT NOT NULL,
  specialty        TEXT NOT NULL,
  kind             TEXT NOT NULL CHECK (kind IN ('resident','practising')),
  gender           TEXT NOT NULL CHECK (gender IN ('female','male')),
  age              INTEGER,
  experience_years INTEGER NOT NULL DEFAULT 0,
  languages        TEXT[] NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online','offline','busy')),
  verified         BOOLEAN NOT NULL DEFAULT false,
  rating           DOUBLE PRECISION NOT NULL DEFAULT 0,
  consult_fee      INTEGER NOT NULL DEFAULT 0,
  home_visit_fee   INTEGER NOT NULL DEFAULT 0,
  avatar_color     TEXT NOT NULL,
  lat              DOUBLE PRECISION NOT NULL,
  lng              DOUBLE PRECISION NOT NULL,
  last_seen        TIMESTAMPTZ NOT NULL DEFAULT now(),
  qualifications   TEXT,
  education        TEXT,
  about            TEXT,
  registration_no  TEXT,
  clinic_address   TEXT,
  availability     JSONB
);
CREATE INDEX IF NOT EXISTS doctors_status_idx ON doctors(status);
-- Geo filtering (?near=lat,lng&km=10) sorts by distance from a point. Without
-- PostGIS this is a plain lat/lng index plus a bounding-box prefilter in SQL.
CREATE INDEX IF NOT EXISTS doctors_latlng_idx ON doctors(lat, lng);

CREATE TABLE IF NOT EXISTS gigs (
  id               TEXT PRIMARY KEY,
  doctor_id        TEXT NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  type             TEXT NOT NULL CHECK (type IN ('video','home_visit','clinic')),
  price            INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL,
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS gigs_doctor_idx ON gigs(doctor_id, status);

CREATE TABLE IF NOT EXISTS ambulances (
  id          TEXT PRIMARY KEY,
  vehicle_no  TEXT NOT NULL,
  driver_name TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'free' CHECK (status IN ('free','dispatched','busy')),
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS sos_events (
  id           TEXT PRIMARY KEY,
  patient_id   TEXT,
  patient_name TEXT NOT NULL DEFAULT 'Unknown',
  category     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'open',
  address      TEXT NOT NULL DEFAULT '',
  lat          DOUBLE PRECISION NOT NULL,
  lng          DOUBLE PRECISION NOT NULL,
  ambulance_id TEXT,
  doctor_id    TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS sos_status_idx ON sos_events(status);
CREATE INDEX IF NOT EXISTS sos_latlng_idx ON sos_events(lat, lng);

CREATE TABLE IF NOT EXISTS consult_requests (
  id             TEXT PRIMARY KEY,
  patient_id     TEXT,
  patient_name   TEXT NOT NULL DEFAULT 'Patient',
  doctor_id      TEXT,
  type           TEXT NOT NULL CHECK (type IN ('video','home_visit','clinic')),
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','accepted','declined','completed','cancelled')),
  symptoms       TEXT NOT NULL DEFAULT '',
  payment_method TEXT CHECK (payment_method IN ('online','cash')),
  fee            INTEGER NOT NULL DEFAULT 0,
  address        TEXT NOT NULL DEFAULT '',
  lat            DOUBLE PRECISION NOT NULL DEFAULT 0,
  lng            DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  mode           TEXT CHECK (mode IN ('emergency','scheduled','gig')),
  gig_id         TEXT,
  gig_title      TEXT,
  broadcast      BOOLEAN NOT NULL DEFAULT false,
  trip_stage     TEXT CHECK (trip_stage IN ('accepted','enroute','arrived','in_progress')),
  trip_stage_at  TIMESTAMPTZ,
  scheduled_at   TIMESTAMPTZ,
  scheduled_end  TIMESTAMPTZ,
  slot_minutes   INTEGER,
  accepted_at    TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  cancelled_at   TIMESTAMPTZ,
  cancelled_by   TEXT CHECK (cancelled_by IN ('patient','doctor')),
  cancel_reason  TEXT,
  -- Doctors who passed on a broadcast; they are never offered it again.
  passed_by      TEXT[] NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS requests_status_idx    ON consult_requests(status);
CREATE INDEX IF NOT EXISTS requests_doctor_idx    ON consult_requests(doctor_id, status);
CREATE INDEX IF NOT EXISTS requests_patient_idx   ON consult_requests(patient_id);
CREATE INDEX IF NOT EXISTS requests_scheduled_idx ON consult_requests(doctor_id, scheduled_at);

CREATE TABLE IF NOT EXISTS orders (
  id           TEXT PRIMARY KEY,
  patient_id   TEXT,
  patient_name TEXT NOT NULL DEFAULT 'Patient',
  status       TEXT NOT NULL DEFAULT 'placed',
  items        JSONB NOT NULL DEFAULT '[]'::jsonb,
  total        INTEGER NOT NULL DEFAULT 0,
  address      TEXT NOT NULL DEFAULT '',
  dark_store   TEXT NOT NULL DEFAULT '',
  eta_mins     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_patient_idx ON orders(patient_id);

-- A patient's review of a doctor, one per completed consult.
CREATE TABLE IF NOT EXISTS reviews (
  id           TEXT PRIMARY KEY,
  doctor_id    TEXT NOT NULL,
  request_id   TEXT,
  patient_id   TEXT,
  patient_name TEXT NOT NULL DEFAULT 'Patient',
  rating       DOUBLE PRECISION NOT NULL,
  comment      TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reviews_doctor_idx ON reviews(doctor_id);
CREATE UNIQUE INDEX IF NOT EXISTS reviews_request_uniq ON reviews(request_id) WHERE request_id IS NOT NULL;

-- The other direction: a doctor's rating of a patient after a consult.
CREATE TABLE IF NOT EXISTS patient_reviews (
  id          TEXT PRIMARY KEY,
  request_id  TEXT,
  patient_id  TEXT NOT NULL,
  doctor_id   TEXT NOT NULL,
  doctor_name TEXT NOT NULL DEFAULT '',
  rating      DOUBLE PRECISION NOT NULL,
  comment     TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS patient_reviews_patient_idx ON patient_reviews(patient_id);
CREATE UNIQUE INDEX IF NOT EXISTS patient_reviews_request_uniq ON patient_reviews(request_id) WHERE request_id IS NOT NULL;

-- Doctor wallet ledger: an earning from a completed visit, or a payout.
CREATE TABLE IF NOT EXISTS transactions (
  id           TEXT PRIMARY KEY,
  doctor_id    TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('earning','payout')),
  request_id   TEXT,
  patient_name TEXT,
  method       TEXT CHECK (method IN ('online','cash')),
  gross        INTEGER NOT NULL DEFAULT 0,
  commission   INTEGER NOT NULL DEFAULT 0,
  net          INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS transactions_doctor_idx ON transactions(doctor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audits (
  id         BIGSERIAL PRIMARY KEY,
  actor_id   TEXT,
  role       TEXT,
  action     TEXT NOT NULL,
  meta       JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audits_created_idx ON audits(created_at DESC);
