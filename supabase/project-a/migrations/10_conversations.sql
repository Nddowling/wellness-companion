-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Wellness Companion — 10_conversations.sql                                  ║
-- ║                                                                            ║
-- ║ Durable, account-scoped chat transcripts for the seeker Companion (/match).║
-- ║                                                                            ║
-- ║ ⚠ PHI. The full transcript can contain health detail, so this lives with   ║
-- ║   the other vault_* tables: deny-all RLS, reachable ONLY via the server-    ║
-- ║   side service-role client (src/lib/supabase/vault.ts). In production it    ║
-- ║   moves to the isolated, BAA-covered project alongside the rest of the      ║
-- ║   vault. Only write with a signed BAA + HIPAA add-on + 42 CFR Part 2 /      ║
-- ║   EKRA review (HANDOFF_BAA_SIGNED=true).                                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create table if not exists vault_conversations (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete cascade,
  title        text,
  messages     jsonb not null default '[]'::jsonb,   -- [{ role, content }]
  match_id     uuid references matches(id) on delete set null,
  matched_facilities jsonb not null default '[]'::jsonb,  -- snapshot of programs shown
  face_sheet   jsonb not null default '{}'::jsonb,
  status       text not null default 'active' check (status in ('active', 'archived')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_vault_conversations_user
  on vault_conversations (auth_user_id, created_at desc);

drop trigger if exists trg_vault_conversations_updated_at on vault_conversations;
create trigger trg_vault_conversations_updated_at before update on vault_conversations
  for each row execute function set_updated_at();

-- Deny-all: RLS on, no policies → only the service role (which bypasses RLS) can access.
alter table vault_conversations enable row level security;
