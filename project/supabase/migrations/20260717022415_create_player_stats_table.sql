/*
# Create player_stats table (single-tenant, no auth)

1. New Tables
- `player_stats`
  - `id` (integer, primary key, fixed to 1) — singleton row for the single player
  - `total_credit` (integer, not null, default 0) — cumulative points won across all sessions
  - `total_debit` (integer, not null, default 0) — cumulative points lost across all sessions
  - `updated_at` (timestamptz) — last time the totals were synced

2. Security
- Enable RLS on `player_stats`.
- Allow anon + authenticated CRUD because the data is intentionally shared/public (no sign-in screen).
*/

CREATE TABLE IF NOT EXISTS player_stats (
  id integer PRIMARY KEY DEFAULT 1,
  total_credit integer NOT NULL DEFAULT 0,
  total_debit integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);

ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_player_stats" ON player_stats;
CREATE POLICY "anon_select_player_stats" ON player_stats FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_player_stats" ON player_stats;
CREATE POLICY "anon_insert_player_stats" ON player_stats FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_player_stats" ON player_stats;
CREATE POLICY "anon_update_player_stats" ON player_stats FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_player_stats" ON player_stats;
CREATE POLICY "anon_delete_player_stats" ON player_stats FOR DELETE
  TO anon, authenticated USING (true);