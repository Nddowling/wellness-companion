-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Wellness Companion — Project A — seed.sql                                   ║
-- ║ Sample facilities for local/dev demos. Replace with REAL facilities (start ║
-- ║ with your design-partner) via the /admin UI before any external testing.   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── 1. Bootstrap yourself as a platform admin ────────────────────────────────
-- Sign up once via the app (/login → "Sign up"), then run this with YOUR email:
--
--   insert into platform_admins (user_id)
--   select id from auth.users where email = 'you@example.com'
--   on conflict do nothing;

-- ── 2. Sample facilities (dev only) ──────────────────────────────────────────
with f as (
  insert into facilities
    (name, street, city, state, zip, levels_of_care, specialties, populations_served,
     accreditations, is_published, referral_contact)
  values
    ('Cedar Ridge Recovery', '120 Pine St', 'Asheville', 'NC', '28801',
     '{detox,residential,php}', '{dual_diagnosis,trauma}', '{adults,veterans}',
     '{jcaho}', true,
     '{"name":"Intake Team","email":"intake@cedarridge.example","phone":"828-555-0101"}'),
    ('Harbor Light IOP', '45 Bay Ave', 'Portland', 'ME', '04101',
     '{iop,op}', '{outpatient,medication_assisted}', '{adults,young_adults}',
     '{carf}', true,
     '{"name":"Admissions","email":"admit@harborlight.example","phone":"207-555-0144"}'),
    ('Mesa Vista Adolescent', '900 Desert Rd', 'Tucson', 'AZ', '85701',
     '{residential,php,iop}', '{trauma,family_therapy}', '{adolescent}',
     '{jcaho,carf}', false,
     '{"name":"Family Liaison","email":"family@mesavista.example","phone":"520-555-0188"}')
  returning id, levels_of_care
)
-- zeroed capacity per declared level of care
insert into facility_capacity (facility_id, level_of_care, beds_available, last_updated)
select f.id, lvl, (random() * 8)::int,
       now() - (interval '1 day' * (random() * 9)::int)  -- vary freshness for the dashboard
from f, unnest(f.levels_of_care) as lvl;

-- payers for the published facilities
insert into facility_payers (facility_id, payer_type, in_network)
select id, p, true
from facilities, unnest(array['medicaid','commercial','self_pay']::text[]) as p
where name in ('Cedar Ridge Recovery', 'Harbor Light IOP')
on conflict do nothing;
