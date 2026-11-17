CREATE TABLE IF NOT EXISTS test_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  test TEXT NOT NULL,
  title TEXT,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  percent INTEGER NOT NULL,
  rec TEXT,
  details TEXT,
  ip_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_tr_ip ON test_results (ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_tr_created ON test_results (created_at);
