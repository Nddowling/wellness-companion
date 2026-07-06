-- QA run history — Project A (core, non-PHI). Written by scripts/report-to-supabase.ts
-- after each Playwright run. Source for a future QA dashboard (pass-rate trend, last
-- failures, per-persona health). No PHI ever lands here.

create table if not exists qa_runs (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  target_url text not null,
  total int not null default 0,
  passed int not null default 0,
  failed int not null default 0,
  skipped int not null default 0,
  duration_ms int,
  failures jsonb,            -- [{title, project, error}] for the dashboard
  ci boolean not null default false
);

create index if not exists idx_qa_runs_ran_at on qa_runs (ran_at desc);

-- Service-role writes only (the CI reporter uses the service key). RLS on with no
-- public policy means anon/authenticated clients cannot read or write it.
alter table qa_runs enable row level security;
