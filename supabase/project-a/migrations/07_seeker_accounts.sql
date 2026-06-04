-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Wellness Companion — 07_seeker_accounts.sql                                ║
-- ║                                                                            ║
-- ║ Link a seeker's saved vault record to a created auth account, so they can  ║
-- ║ log back in and revisit their matched programs (/me dashboard). Still PHI; ║
-- ║ deny-all RLS unchanged — only the server-side service role reads it.       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

alter table vault_seekers
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;
create index if not exists idx_vault_seekers_auth on vault_seekers (auth_user_id);
