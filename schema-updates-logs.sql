-- ─────────────────────────────────────────────────────────────────────────────
-- Admin Activity Logs
-- Run this in your Supabase SQL editor
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists admin_logs (
  id         bigserial primary key,
  admin_email text not null,
  action      text not null,       -- e.g. 'product.create', 'teller.deactivate'
  description text not null,       -- human-readable summary
  metadata    jsonb,               -- optional structured context (name, id, etc.)
  created_at  timestamptz not null default now()
);

-- Indexes for the logs page queries
create index if not exists admin_logs_created_at_idx  on admin_logs (created_at desc);
create index if not exists admin_logs_admin_email_idx on admin_logs (admin_email);
create index if not exists admin_logs_action_idx      on admin_logs (action);

-- Service-role only: block all public access
alter table admin_logs enable row level security;

-- No RLS policies needed — the admin app uses the service-role key which bypasses RLS.
-- If you want an explicit allow policy for the service role, uncomment below:
-- create policy "service role full access"
--   on admin_logs
--   using (true)
--   with check (true);
