-- Replace the increment-by-1 trigger with a recalculating trigger.
-- Using COUNT(*) on every INSERT means the cache is always exactly right,
-- even if rows are inserted outside of the app (migrations, admin edits, etc.).
-- At current scale the COUNT(*) overhead is negligible.

CREATE OR REPLACE FUNCTION sync_contribution_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE contribution_stats
  SET total = (SELECT COUNT(*) FROM contributions),
      updated_at = now()
  WHERE id = 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-point the trigger to the new function
DROP TRIGGER IF EXISTS on_contribution_insert ON contributions;

CREATE TRIGGER on_contribution_insert
  AFTER INSERT OR DELETE ON contributions
  FOR EACH STATEMENT EXECUTE FUNCTION sync_contribution_count();
