-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Wellness Companion — 09_facility_plan_seats.sql                            ║
-- ║                                                                            ║
-- ║ Seat add-on on each facility: `extra_seats` counts purchased staff seats   ║
-- ║ beyond the seats included with the plan ($69.99/mo each). Additive.        ║
-- ║ (plan / plan_status columns are managed by the Stripe billing migration.)  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

alter table facilities
  add column if not exists extra_seats integer not null default 0 check (extra_seats >= 0);
