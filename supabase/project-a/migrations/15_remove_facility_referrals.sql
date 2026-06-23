-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Clear Bed Recovery — 15_remove_facility_referrals.sql                      ║
-- ║                                                                            ║
-- ║ Retires the facility-to-facility referral DISCOUNT/CREDIT program          ║
-- ║ (introduced in 12_facility_referrals.sql). The revenue model changed — we  ║
-- ║ no longer run referral discounts, credits, or free-month rewards.          ║
-- ║                                                                            ║
-- ║ Does NOT touch the core seeker-referral product: facilities.referral_contact║
-- ║ (a facility's admissions contact), matches, or match_routes.               ║
-- ║                                                                            ║
-- ║ Note: Stripe customer-balance credits already granted are not clawed back. ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

drop table if exists facility_referrals;

alter table facilities drop column if exists referral_credits_earned;
