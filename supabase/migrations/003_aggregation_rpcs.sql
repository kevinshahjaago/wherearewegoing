-- Efficient aggregation functions — replace O(N) JS-side counting with DB-level aggregation.
-- Called via supabase.rpc() in lib/services/earth.ts.

CREATE OR REPLACE FUNCTION count_distinct_countries()
RETURNS bigint AS $$
  SELECT COUNT(DISTINCT country_code)
  FROM contributions
  WHERE country_code IS NOT NULL;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION count_total_principles()
RETURNS bigint AS $$
  SELECT COALESCE(SUM(array_length(principles, 1)), 0)
  FROM contributions
  WHERE principles IS NOT NULL AND principles != '{}';
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION count_unique_contributors()
RETURNS bigint AS $$
  SELECT COUNT(DISTINCT visitor_id)
  FROM contributions
  WHERE visitor_id IS NOT NULL;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
