-- Takumi: bật đồng bộ dữ liệu quản trị trên Cloudflare D1
-- Chạy một lần trong D1 Console của lophoctiengnhat-db.
CREATE TABLE IF NOT EXISTS app_state (
  state_key TEXT PRIMARY KEY CHECK (state_key IN ('cls', 'cl', 'sts', 'jr', 'mine', 'leads')),
  payload TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (updated_by) REFERENCES teachers(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_app_state_updated ON app_state(updated_at);
