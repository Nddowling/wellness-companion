-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Wellness Companion — Project B ("Vault") — 02_conversations.sql             ║
-- ║                                                                            ║
-- ║ 🔴 PHI. DO NOT APPLY AT BETA. Authored for review only.                     ║
-- ║                                                                            ║
-- ║ Apply ONLY after: Supabase Team plan + signed BAA + HIPAA add-on +          ║
-- ║ security risk assessment + healthcare-attorney sign-off. See README.md.     ║
-- ║                                                                            ║
-- ║ Account-scoped seeker chat transcripts. Lives in the SAME isolated project  ║
-- ║ as the rest of the vault. match_id is a logical (cross-project) reference   ║
-- ║ to Project A `matches.id`, resolved server-side ONLY.                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create extension if not exists pgcrypto;

create table if not exists vault_conversations (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid,                                  -- → auth.users.id
  title        text,
  messages     jsonb not null default '[]'::jsonb,    -- [{ role, content }]
  match_id     uuid,                                  -- → Project A matches.id (cross-project)
  matched_facilities jsonb not null default '[]'::jsonb,  -- snapshot of programs shown
  face_sheet   jsonb not null default '{}'::jsonb,
  status       text not null default 'active',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_vault_conversations_user
  on vault_conversations (auth_user_id, created_at desc);

-- RLS: deny-all by default. Only the tightly-scoped server service role may touch it.
alter table vault_conversations enable row level security;
