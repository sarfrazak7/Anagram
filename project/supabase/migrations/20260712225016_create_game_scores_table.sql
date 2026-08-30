/*
# Create game_scores table (single-tenant, no auth)

1. New Tables
- `game_scores`
  - `id` (uuid, primary key)
  - `player_name` (text, not null) — display name entered by the player
  - `score` (integer, not null) — total points earned in the round
  - `puzzle_letters` (text) — the 10-letter pool for that round
  - `words_found` (text[]) — the words the player submitted
  - `created_at` (timestamp)

2. Security
- Enable RLS on `game_scores`.
- Allow anon + authenticated CRUD because the data is intentionally shared/public (no sign-in screen).
*/

CREATE TABLE IF NOT EXISTS game_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name text NOT NULL DEFAULT 'Anonymous',
  score integer NOT NULL DEFAULT 0,
  puzzle_letters text,
  words_found text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE game_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_game_scores" ON game_scores;
CREATE POLICY "anon_select_game_scores" ON game_scores FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_game_scores" ON game_scores;
CREATE POLICY "anon_insert_game_scores" ON game_scores FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_game_scores" ON game_scores;
CREATE POLICY "anon_update_game_scores" ON game_scores FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_game_scores" ON game_scores;
CREATE POLICY "anon_delete_game_scores" ON game_scores FOR DELETE
  TO anon, authenticated USING (true);
