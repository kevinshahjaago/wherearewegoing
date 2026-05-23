-- Forward-only: nullable smallint, safe on existing rows (no backfill needed —
-- pre-existing contributions display in default gold until re-submitted)
ALTER TABLE contributions ADD COLUMN hue smallint;
