-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Clear Bed Recovery — 27_drop_phi_columns.sql                              ║
-- ║                                                                          ║
-- ║ PATH A — "don't hold PHI". Reverses 05_vault_face_sheet.sql.             ║
-- ║                                                                          ║
-- ║ WHY: project-b/README documented the beta design as "seeker PHI is       ║
-- ║ collected client-side, forwarded to the facility, and persisted NOWHERE  ║
-- ║ on our side", gated behind a BAA + HIPAA add-on + 42 CFR Part 2 / EKRA   ║
-- ║ sign-off. In practice HANDOFF_BAA_SIGNED=true was set without a BAA and  ║
-- ║ VAULT_SUPABASE_URL was never configured, so vault writes fell back to    ║
-- ║ THIS (Core, non-BAA) project and accumulated a clinical intake record.   ║
-- ║                                                                          ║
-- ║ This drops the clinical/identifying columns so the data cannot re-        ║
-- ║ accumulate. vault_seekers survives as a LEAD record holding only what a  ║
-- ║ connector needs to make an introduction:                                 ║
-- ║   name, email, phone, insurance (carrier/category), coverage_status,     ║
-- ║   consents, status  — no HIPAA identifiers, no clinical detail.          ║
-- ║                                                                          ║
-- ║ Row data was already deleted (all 19 rows were the founder's own tests). ║
-- ║ Re-enabling PHI storage requires the project-b preconditions, not a flag.║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Date of birth: a HIPAA identifier. Combined with SUD interest it is Part 2 material.
alter table vault_seekers drop column if exists dob;

-- The face sheet: a full clinical intake record (substances, last use, medications,
-- allergies, co-occurring MH, prior treatment, member/group IDs, subscriber identity,
-- emergency contacts, court-ordered status, free-text notes). Its only consumer was the
-- facility hand-off email, which is hard-disabled (FACESHEET_SEND_DISABLED). Removed.
alter table vault_seekers drop column if exists face_sheet;
alter table vault_conversations drop column if exists face_sheet;
