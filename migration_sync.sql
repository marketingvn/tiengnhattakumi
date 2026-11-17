-- Nâng cấp bảng app_state để hỗ trợ điểm danh và thư viện bài giảng YouTube.
-- Chạy một lần trong D1 Console của lophoctiengnhat-db.
-- Migration giữ nguyên toàn bộ dữ liệu hiện có.
BEGIN TRANSACTION;

CREATE TABLE app_state_v2 (
  state_key TEXT PRIMARY KEY CHECK (state_key IN ('cls', 'cl', 'sts', 'jr', 'mine', 'leads', 'att', 'lessons')),
  payload TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (updated_by) REFERENCES teachers(id) ON DELETE SET NULL
);

INSERT INTO app_state_v2 (state_key, payload, revision, updated_by, updated_at)
SELECT state_key, payload, revision, updated_by, updated_at FROM app_state;

DROP TABLE app_state;
ALTER TABLE app_state_v2 RENAME TO app_state;

CREATE INDEX IF NOT EXISTS idx_app_state_updated ON app_state(updated_at);

COMMIT;
