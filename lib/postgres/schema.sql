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
  -- Nullable: an account created through Google has no password to store.
  -- The login route refuses a password sign-in when this is null, so a
  -- Google-only account can never be entered with a guessed empty password.
  password_hash  TEXT,
  role           TEXT NOT NULL CHECK (role IN ('patient','doctor','nurse','ops')),
  name           TEXT NOT NULL,
  address        TEXT,
  lat            DOUBLE PRECISION,
  lng            DOUBLE PRECISION,
  -- Aggregate rating this patient received from doctors (mutual ratings).
  rating         DOUBLE PRECISION,
  rating_count   INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Google sign-in, added after the first deploys — so these run as ALTERs for a
-- database that already has a users table, and are no-ops on a fresh one.
--   google_id  the "sub" claim, Google's stable id for the person. Matching on
--              it rather than the address survives a Google email change.
--   avatar_url their Google picture, used when they have no uploaded one.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
DO $$ BEGIN
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
  ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('patient','doctor','nurse','ops'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id  TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
-- The patient's health profile (height, weight, blood group, allergies,
-- conditions, medication, history, lifestyle, emergency contact) as one JSONB
-- blob — the shape lives in lib/health/profile.ts and is sanitized on write.
-- The patient's full postal address (house number and street included), beside
-- `address`, which stays the short "Sadar, Nagpur" label the patient's own
-- header shows. A provider driving to a home needs the door, not the suburb.
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_full TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS health_profile JSONB;
-- The patient's symptom-checker chat history (a capped, newest-first list of
-- sessions) as one JSONB blob — shape lives in lib/care/history.ts and is
-- sanitized on write. Server-side so it survives refreshes and devices.
ALTER TABLE users ADD COLUMN IF NOT EXISTS chat_history JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_key ON users (google_id)
  WHERE google_id IS NOT NULL;

-- A Google sign-in that has proved WHO someone is but has not yet produced an
-- account. Doctors must fill in their own specialty, credentials and fees, so
-- nothing is invented on their behalf — the account is created only when that
-- form is submitted, and an abandoned sign-up simply expires here.
CREATE TABLE IF NOT EXISTS pending_signups (
  id          TEXT PRIMARY KEY,
  google_id   TEXT NOT NULL,
  email       TEXT NOT NULL,
  name        TEXT NOT NULL,
  avatar_url  TEXT,
  role        TEXT NOT NULL CHECK (role IN ('patient','doctor','nurse')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
-- Nurses sign up through the same Google flow as doctors, and like them must
-- finish a professional profile before an account exists. Rebuilt rather than
-- declared inline so databases created before nurses accept the new role.
DO $$ BEGIN
  ALTER TABLE pending_signups DROP CONSTRAINT IF EXISTS pending_signups_role_check;
  ALTER TABLE pending_signups ADD CONSTRAINT pending_signups_role_check
    CHECK (role IN ('patient','doctor','nurse'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS pending_signups_expiry_idx ON pending_signups(expires_at);

-- Longitudinal vitals log — one row per measurement, never overwritten, so
-- weight (and later BP/glucose) can be TRENDED rather than only snapshotted.
-- Fed automatically: every health-profile save with a changed weight appends.
CREATE TABLE IF NOT EXISTS vitals (
  id          TEXT PRIMARY KEY,
  patient_id  TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('weight')),
  value       DOUBLE PRECISION NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vitals_patient_idx ON vitals(patient_id, kind, recorded_at DESC);

-- Sessions are rows, not signed cookies: the browser holds only `id`, so the
-- database decides who you are and deleting the row ends the session at once.
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  -- The one enforced foreign key (see the note below): a session must belong to
  -- a real account, and deleting the account must end its sessions.
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('patient','doctor','nurse','ops')),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
-- Nurse sessions were added after the first schema version. Rebuild the
-- idempotent constraint so existing databases can accept the new role too.
DO $$ BEGIN
  ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_role_check;
  ALTER TABLE sessions ADD CONSTRAINT sessions_role_check CHECK (role IN ('patient','doctor','nurse','ops'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
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
-- Profile photo, added later — an ALTER for databases that predate it. Stored
-- on the doctor row (not just users) because every patient-facing read goes
-- through doctors, and a photo is part of what patients see.
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Onboarding timestamp — when this doctor joined the platform. Added later, so
-- it lands nullable rather than defaulting every existing row to "now" and
-- claiming the whole roster onboarded at migration time. New rows get now();
-- existing registered doctors are backfilled from their account (a registered
-- doctor's id IS their users.id). Seeded catalog doctors have no account and
-- stay NULL, which the ops UI renders honestly as "—".
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
ALTER TABLE doctors ALTER COLUMN created_at SET DEFAULT now();
UPDATE doctors d
   SET created_at = u.created_at
  FROM users u
 WHERE u.id = d.id
   AND d.created_at IS NULL;

-- Provider cadre. This table is the single PROVIDER registry, not a doctors-only
-- one: a nurse is the same shape with a different cadre, so gigs, availability,
-- trips, the wallet ledger and mutual ratings all work for them unchanged rather
-- than needing a parallel stack. Defaulting to 'doctor' leaves every existing
-- row correct, and the patient-facing doctor search filters on it so nurses
-- never surface as doctors.
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS cadre TEXT NOT NULL DEFAULT 'doctor';
DO $$ BEGIN
  ALTER TABLE doctors DROP CONSTRAINT IF EXISTS doctors_cadre_check;
  ALTER TABLE doctors ADD CONSTRAINT doctors_cadre_check CHECK (cadre IN ('doctor','nurse'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- What a nurse is qualified to do at home — the searchable service tags patients
-- filter on. Ids live in lib/nurse.ts. Empty for doctors, who are found by
-- specialty instead.
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS skills TEXT[] NOT NULL DEFAULT '{}';

-- Where the doctor's CLINIC stands, as opposed to where the doctor is.
--
-- `lat`/`lng` above is a live position: it moves with the person and is the
-- most sensitive field on the row, which is why the anonymous /api/public
-- projection refuses to publish it. A clinic is the opposite — a business
-- address a doctor advertises so patients can find them — so it is safe to
-- show on a public map, and it is what the landing page pins.
--
-- Nullable on purpose. A purely home-visit or teleconsult doctor has no clinic,
-- and must not be forced to invent coordinates to appear in search.
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS clinic_lat DOUBLE PRECISION;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS clinic_lng DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS doctors_status_idx ON doctors(status);
CREATE INDEX IF NOT EXISTS doctors_cadre_idx  ON doctors(cadre, status);
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
-- Arrival confirmation, the ride-hailing pattern: on acceptance the server
-- mints a 4-digit code that ONLY the patient can see. The doctor types what
-- the patient reads out, which is simultaneous proof that the doctor showed
-- up, the patient was there, and treatment actually began (started_at).
--   start_code          the digits; never returned to a doctor or ops
--   start_code_attempts wrong guesses so far; 5 locks the code until reissued
--   started_at          when the consult was really confirmed to have begun
ALTER TABLE consult_requests ADD COLUMN IF NOT EXISTS start_code          TEXT;
ALTER TABLE consult_requests ADD COLUMN IF NOT EXISTS start_code_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE consult_requests ADD COLUMN IF NOT EXISTS started_at          TIMESTAMPTZ;

-- Which cadre this request is for. A broadcast for a nurse must never land in a
-- doctor's inbox and vice versa, and `doctor_id` alone cannot say so while the
-- request is still unclaimed. Defaults to 'doctor' so every pre-existing row
-- keeps its current audience. Read through visibleToProvider() in
-- lib/scheduling/slots.ts, never raw.
ALTER TABLE consult_requests
  ADD COLUMN IF NOT EXISTS target_cadre TEXT NOT NULL DEFAULT 'doctor';
DO $$ BEGIN
  ALTER TABLE consult_requests DROP CONSTRAINT IF EXISTS requests_target_cadre_check;
  ALTER TABLE consult_requests ADD CONSTRAINT requests_target_cadre_check
    CHECK (target_cadre IN ('doctor','nurse'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS requests_status_idx    ON consult_requests(status);
CREATE INDEX IF NOT EXISTS requests_cadre_idx     ON consult_requests(target_cadre, status);
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
-- The prescription a basket was filled from, when the patient ordered straight
-- off a doctor's Rx rather than browsing the store. Null for a self-serve
-- order. This is the link fulfilment reads to compare prescribed against
-- dispensed. Nullable and added by ALTER, so existing orders stay valid.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS prescription_id TEXT;
CREATE INDEX IF NOT EXISTS orders_prescription_idx ON orders(prescription_id)
  WHERE prescription_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- Prescriptions: what a doctor issues at the end of a consult.
--
-- A SNAPSHOT table. The doctor's name, qualifications and council registration
-- are columns here rather than a join to doctors, because this document gets
-- printed, forwarded on WhatsApp and carried to a chemist months later — it
-- must keep saying what it said on the day, even after the doctor edits their
-- profile or leaves the platform. Same reasoning as consult_requests keeping
-- patient_name and gig_title.
--
-- `items` is JSONB: a medicine line (name, dose, "1-0-1" schedule, duration,
-- timing, note) is only ever read as a whole list belonging to one document,
-- never queried across prescriptions, so a child table would buy nothing. The
-- shape lives in lib/prescriptions/rules.ts and is sanitized on write.
--
-- `share_token` is the unguessable segment behind /rx/<token>. It is the ONE
-- credential that opens this document without a session, so it is indexed
-- uniquely and never returned to anyone but the patient and the prescriber.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prescriptions (
  id                       TEXT PRIMARY KEY,
  code                     TEXT NOT NULL,
  request_id               TEXT NOT NULL,
  patient_id               TEXT,
  patient_name             TEXT NOT NULL DEFAULT 'Patient',
  patient_age              INTEGER,
  patient_gender           TEXT,
  patient_allergies        TEXT,
  doctor_id                TEXT NOT NULL,
  doctor_name              TEXT NOT NULL DEFAULT '',
  doctor_specialty         TEXT NOT NULL DEFAULT '',
  doctor_qualifications    TEXT,
  doctor_registration_no   TEXT,
  diagnosis                TEXT NOT NULL DEFAULT '',
  items                    JSONB NOT NULL DEFAULT '[]'::jsonb,
  advice                   TEXT NOT NULL DEFAULT '',
  follow_up_days           INTEGER,
  issued_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  share_token              TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS prescriptions_patient_idx ON prescriptions(patient_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS prescriptions_doctor_idx  ON prescriptions(doctor_id, issued_at DESC);
-- One prescription per consult: the doctor writes it once, as an act of closing
-- the visit. A second attempt is a duplicate submit, not a revision.
CREATE UNIQUE INDEX IF NOT EXISTS prescriptions_request_uniq ON prescriptions(request_id);
CREATE UNIQUE INDEX IF NOT EXISTS prescriptions_token_uniq   ON prescriptions(share_token);
CREATE UNIQUE INDEX IF NOT EXISTS prescriptions_code_uniq    ON prescriptions(code);

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
