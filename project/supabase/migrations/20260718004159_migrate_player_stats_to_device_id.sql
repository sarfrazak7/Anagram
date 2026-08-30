/*
# Migrate player_stats from singleton to per-device rows

## Purpose
Previously `player_stats` held a single shared row (id=1, CHECK id=1) so every
visitor read and wrote the same all-time score. This migration converts it to
one row per device, keyed by a client-generated UUID stored in the browser's
localStorage. Each player now sees and mutates only their own all-time total.

## Changes to `player_stats`
1. Drop the `singleton` CHECK constraint (was `CHECK (id = 1)`) — no longer a
   single-row table.
2. Drop the existing primary-key constraint on the integer `id` column. The
   `id` column itself is NOT dropped (preserving any historical data); it is
   simply no longer the primary key and is left with its harmless DEFAULT 1.
3. Add `device_id` (uuid, NOT NULL, DEFAULT gen_random_uuid()) — the new
   per-device key. Any pre-existing singleton row receives a generated UUID
   automatically so no data is lost.
4. Establish `device_id` as the new primary key.

## Security (RLS)
This is a no-auth app (no sign-in screen). The frontend runs entirely as the
`anon` role, so policies remain `TO anon, authenticated` with `USING (true)`.
Per-device isolation is enforced in the query layer (every SELECT/UPSERT
filters by `device_id`), not in RLS — there is no verified server-side
identity available without auth, and the data (game scores) is intentionally
non-sensitive. This matches the documented no-auth pattern.

## Notes
1. The orphaned pre-existing singleton row (if any) is left in place; it is
   not queried by device_id and is harmless.
2. `id` column is retained (not dropped) to comply with data-safety rules.
*/

ALTER TABLE player_stats DROP CONSTRAINT IF EXISTS singleton;

ALTER TABLE player_stats DROP CONSTRAINT IF EXISTS player_stats_pkey;

ALTER TABLE player_stats
  ADD COLUMN IF NOT EXISTS device_id uuid NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE player_stats
  ADD CONSTRAINT player_stats_pkey PRIMARY KEY (device_id);