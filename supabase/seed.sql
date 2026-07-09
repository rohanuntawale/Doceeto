-- ════════════════════════════════════════════════════════════
-- Iyashi — CATALOG seed (Pune). Run AFTER 0001_init.sql.
-- This seeds ONLY infrastructure: doctors, ambulances, dark stores.
-- It intentionally creates NO activity — SOS events, consult requests
-- and orders are meant to be created by the patient app so you test
-- on real data. (For a pre-filled showcase, add sample rows yourself.)
-- Safe to re-run.
-- Doctors here are catalog rows (no auth user); real doctor logins get
-- their own doctors row via the on_auth_user_created trigger.
-- ════════════════════════════════════════════════════════════

truncate reviews, orders, consult_requests, sos_events, ambulances, dark_stores, doctors restart identity cascade;

insert into doctors (id, full_name, specialty, status, verified, rating, consult_fee, home_visit_fee, lat, lng, last_seen) values
  ('11111111-1111-1111-1111-111111111111','Dr. Ananya Rao','General Physician','online', true, 4.8, 400, 900, 18.5308, 73.8475, now()),
  ('22222222-2222-2222-2222-222222222222','Dr. Vikram Shah','Cardiologist','online', true, 4.9, 800, 1600, 18.5089, 73.8271, now()),
  ('33333333-3333-3333-3333-333333333333','Dr. Meera Iyer','Pediatrician','busy', true, 4.7, 500, 1100, 18.5642, 73.7769, now()),
  ('44444444-4444-4444-4444-444444444444','Dr. Rohan Kulkarni','Orthopedic','offline', true, 4.6, 700, 1400, 18.4967, 73.9089, now()),
  ('55555555-5555-5555-5555-555555555555','Dr. Sana Qureshi','General Physician','online', false, 4.4, 350, 800, 18.5793, 73.8143, now());

insert into ambulances (id, vehicle_no, driver_name, status, lat, lng) values
  ('a1111111-1111-1111-1111-111111111111','MH12 AB 1234','Suresh P.','free', 18.5314, 73.8446),
  ('a2222222-2222-2222-2222-222222222222','MH12 CD 5678','Imran K.','dispatched', 18.5121, 73.8302),
  ('a3333333-3333-3333-3333-333333333333','MH14 EF 9012','Ganesh M.','free', 18.5601, 73.7801),
  ('a4444444-4444-4444-4444-444444444444','MH12 GH 3456','Prakash D.','busy', 18.4989, 73.9051);

insert into dark_stores (name, lat, lng) values
  ('Iyashi Store · Baner', 18.5590, 73.7810),
  ('Iyashi Store · Kothrud', 18.5074, 73.8077),
  ('Iyashi Store · Aundh', 18.5602, 73.8077),
  ('Iyashi Store · Shivaji Nagar', 18.5308, 73.8475);

-- No SOS / consult / order / review rows on purpose.
-- Create them from the patient app (/patient) to test on real data.
