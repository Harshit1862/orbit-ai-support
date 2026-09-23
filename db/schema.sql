-- Orbit's database. Run with `npm run db:setup` (safe to run more than once).
--
-- One row per demo workspace. The workspace itself (projects, tasks, members,
-- invoices, tickets, ...) is stored as one JSON document in `data`, in the
-- same shape the app uses (OrbitData in src/lib/orbit/model.ts). A production
-- app would split it into proper tables (projects, tasks, invoices, ...).

CREATE TABLE IF NOT EXISTS workspaces (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- SHA-256 of the visitor's session cookie. The cookie itself is never
  -- stored, so a leaked database can't be used to impersonate anyone.
  session_hash  text        NOT NULL UNIQUE,
  data          jsonb       NOT NULL,
  -- Bumped on every save. A save only succeeds if the version hasn't changed
  -- since the data was read, so two tabs can't overwrite each other's work.
  version       integer     NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- Refreshed on every visit; workspaces unseen for 7 days are deleted.
  last_seen_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspaces_last_seen_at_idx ON workspaces (last_seen_at);
