-- ============================================
--  X-Roleplay Hub – Supabase Datenbank Setup
--  Einmalig ausführen im SQL Editor
-- ============================================

-- 1. Snapshots Tabelle (jede Minute ein Eintrag pro Streamer)
CREATE TABLE IF NOT EXISTS stream_snapshots (
  id          BIGSERIAL PRIMARY KEY,
  login       TEXT NOT NULL,
  is_live     BOOLEAN DEFAULT false,
  title       TEXT,
  game        TEXT,
  server      TEXT,
  viewers     INTEGER DEFAULT 0,
  started_at  TIMESTAMPTZ,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index für schnelle Abfragen
CREATE INDEX IF NOT EXISTS idx_snapshots_login      ON stream_snapshots(login);
CREATE INDEX IF NOT EXISTS idx_snapshots_recorded   ON stream_snapshots(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_live       ON stream_snapshots(is_live);

-- 2. Aktueller Status (eine Zeile pro Streamer, wird überschrieben)
CREATE TABLE IF NOT EXISTS streamer_status (
  login       TEXT PRIMARY KEY,
  is_live     BOOLEAN DEFAULT false,
  title       TEXT,
  game        TEXT,
  server      TEXT,
  viewers     INTEGER DEFAULT 0,
  started_at  TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Öffentlichen Lesezugriff erlauben (anon key)
ALTER TABLE stream_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE streamer_status   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read snapshots"
  ON stream_snapshots FOR SELECT USING (true);

CREATE POLICY "Public read status"
  ON streamer_status FOR SELECT USING (true);

CREATE POLICY "Service insert snapshots"
  ON stream_snapshots FOR INSERT WITH CHECK (true);

CREATE POLICY "Service upsert status"
  ON streamer_status FOR ALL USING (true);
