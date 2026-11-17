-- Nhật Ngữ Takumi: schema đầy đủ cho Cloudflare D1
-- Chạy bằng cách dán toàn bộ nội dung vào D1 Console > Console.

CREATE TABLE IF NOT EXISTS teachers (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'teacher')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'locked')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_teacher ON sessions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS registrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  level TEXT NOT NULL,
  interested_class TEXT,
  goal TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_registrations_created ON registrations(created_at);
CREATE INDEX IF NOT EXISTS idx_registrations_phone ON registrations(phone);

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
