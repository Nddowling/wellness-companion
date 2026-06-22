-- ═══════════════════════════════════════════════════════════════════════════
-- 13_partners.sql — the Partners lane (white-glove referral directory)
-- ═══════════════════════════════════════════════════════════════════════════
-- "Partners" = people who refer others into help (discharge planners, ER social
-- workers, sober/wellness coaches, clergy, peer support, EAP, drug-court coords).
-- They never pay and have no public profile. Goal: become their default tool.
--
-- Storage reuses the dormant `bd_*` (business-developer) tables — same concept,
-- reframed from sales to clinical/community referral — and adds three net-new
-- tables for shortlists + view history. Code hides the bd_ naming behind a clean
-- `lib/partner` module.
--
-- All Partner data is NON-PHI app data → project-a (NOT the project-b vault).
-- Notes stay "about PLACES, never about patients" (inherited bd_facility_notes
-- guardrail) so no patient identifiers ever land here.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── bd_users → Partner profile ───────────────────────────────────────────────
-- employer already covers organization name; add a structured partner_type
-- (picklist) + optional free-text title so we can greet/segment partners.
-- partner_type is plain text on purpose (NO check constraint): the canonical
-- list lives in src/lib/partner/types.ts and the app validates against it, so
-- the role list can keep growing without a migration each time.
alter table bd_users add column if not exists partner_type text;  -- picklist value, e.g. "hospital_discharge", "judge", "clergy"
alter table bd_users add column if not exists title        text;  -- optional free-text job title, e.g. "Discharge Planner"

-- ── partner_lists ────────────────────────────────────────────────────────────
-- A curated shortlist a Partner builds to hand a Recovery Friend (family/person).
-- share_token, when set, powers a public read-only + printable /share/[token]
-- view. That page is served via the service-role client (no anon RLS hole).
create table if not exists partner_lists (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  title        text not null default 'Recovery options',
  intro        text,                       -- optional warm note shown atop the shared view
  share_token  text unique,                -- null = private; set = shareable
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_partner_lists_owner on partner_lists (owner_id);

drop trigger if exists trg_partner_lists_updated_at on partner_lists;
create trigger trg_partner_lists_updated_at before update on partner_lists
  for each row execute function set_updated_at();

-- ── partner_list_items ───────────────────────────────────────────────────────
create table if not exists partner_list_items (
  list_id     uuid not null references partner_lists(id) on delete cascade,
  facility_id uuid not null references facilities(id)   on delete cascade,
  position    int  not null default 0,
  note        text,                        -- partner's note to the family about THIS place
  created_at  timestamptz not null default now(),
  primary key (list_id, facility_id)
);

create index if not exists idx_partner_list_items_list on partner_list_items (list_id);

-- ── partner_view_history ─────────────────────────────────────────────────────
-- "Recently viewed" / placement history, scoped to the partner. Upsert on view
-- so each facility appears once with its most-recent timestamp.
create table if not exists partner_view_history (
  user_id     uuid not null references auth.users(id) on delete cascade,
  facility_id uuid not null references facilities(id) on delete cascade,
  viewed_at   timestamptz not null default now(),
  primary key (user_id, facility_id)
);

create index if not exists idx_partner_history_recent on partner_view_history (user_id, viewed_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table partner_lists        enable row level security;
alter table partner_list_items   enable row level security;
alter table partner_view_history enable row level security;

-- partner_lists: owner (or admin) only. Public /share reads go through the
-- service-role client server-side, which bypasses RLS — so no anon policy here.
drop policy if exists partner_lists_all on partner_lists;
create policy partner_lists_all on partner_lists for all
  using (is_admin() or owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- partner_list_items: gated by ownership of the parent list.
drop policy if exists partner_list_items_all on partner_list_items;
create policy partner_list_items_all on partner_list_items for all
  using (
    is_admin() or exists (
      select 1 from partner_lists l
      where l.id = partner_list_items.list_id and l.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from partner_lists l
      where l.id = partner_list_items.list_id and l.owner_id = auth.uid()
    )
  );

-- partner_view_history: own rows only.
drop policy if exists partner_history_all on partner_view_history;
create policy partner_history_all on partner_view_history for all
  using (is_admin() or user_id = auth.uid())
  with check (user_id = auth.uid());
