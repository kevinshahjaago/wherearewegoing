-- ── Tables ──────────────────────────────────────────────────────────────────

-- One row per device/session — id matches supabase auth.users.id
CREATE TABLE visitors (
  id           uuid PRIMARY KEY,
  fingerprint  text,
  created_at   timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  visit_count  int DEFAULT 1,
  country_code text,
  geolocation  jsonb
);

-- One row per completed journey
CREATE TABLE contributions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id     uuid REFERENCES visitors(id) ON DELETE SET NULL,
  mission        text NOT NULL,
  principles     text[] DEFAULT '{}',
  commitment     text,
  created_at     timestamptz DEFAULT now(),
  country_code   text,
  geolocation    jsonb,
  config_version int NOT NULL
);

-- O(1) earth fill reads — updated by trigger, never COUNT(*)
CREATE TABLE contribution_stats (
  id         int PRIMARY KEY DEFAULT 1,
  total      int DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO contribution_stats (id, total) VALUES (1, 0);

-- ── Trigger: increment counter on each contribution ──────────────────────────

CREATE OR REPLACE FUNCTION increment_contribution_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE contribution_stats
  SET total = total + 1, updated_at = now()
  WHERE id = 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_contribution_insert
  AFTER INSERT ON contributions
  FOR EACH ROW EXECUTE FUNCTION increment_contribution_count();

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_contributions_visitor_id   ON contributions(visitor_id);
CREATE INDEX idx_contributions_created_at   ON contributions(created_at DESC);
CREATE INDEX idx_contributions_country_code ON contributions(country_code);
CREATE INDEX idx_visitors_fingerprint       ON visitors(fingerprint);

-- ── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE visitors            ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE contribution_stats  ENABLE ROW LEVEL SECURITY;

-- Visitors: own row only
CREATE POLICY "visitors_select_own" ON visitors
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "visitors_insert_own" ON visitors
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "visitors_update_own" ON visitors
  FOR UPDATE USING (auth.uid() = id);

-- Contributions: insert own; read all (voices are public)
CREATE POLICY "contributions_insert_own" ON contributions
  FOR INSERT WITH CHECK (auth.uid() = visitor_id);

CREATE POLICY "contributions_select_all" ON contributions
  FOR SELECT USING (true);

-- Contribution stats: read by all
CREATE POLICY "stats_select_all" ON contribution_stats
  FOR SELECT USING (true);

-- ── Real-time ────────────────────────────────────────────────────────────────

-- Enable postgres_changes events so the live earth feed receives INSERT events
ALTER PUBLICATION supabase_realtime ADD TABLE contributions;
