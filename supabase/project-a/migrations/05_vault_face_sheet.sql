-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Wellness Companion — 05_vault_face_sheet.sql                                ║
-- ║                                                                            ║
-- ║ The Companion now gathers a full referral face sheet in conversation. The  ║
-- ║ complete structured sheet is stored as JSONB on the seeker vault record    ║
-- ║ (PHI — same deny-all RLS as the rest of vault_*).                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

alter table vault_seekers
  add column if not exists face_sheet jsonb not null default '{}'::jsonb;
