CREATE TABLE IF NOT EXISTS licenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key_hash TEXT NOT NULL UNIQUE,
  device_id TEXT,
  plan TEXT NOT NULL DEFAULT 'monthly',
  duration_days INTEGER NOT NULL DEFAULT 30,
  activated_at TEXT,
  expires_at TEXT,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_licenses_key_hash ON licenses(key_hash);
