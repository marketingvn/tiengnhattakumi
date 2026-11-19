-- Tài khoản học viên riêng và phiên đăng nhập
CREATE TABLE IF NOT EXISTS student_accounts (
 id TEXT PRIMARY KEY, student_ref TEXT NOT NULL UNIQUE, username TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL, full_name TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','locked')),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS student_sessions (
 id TEXT PRIMARY KEY, student_account_id TEXT NOT NULL, expires_at INTEGER NOT NULL,
 FOREIGN KEY(student_account_id) REFERENCES student_accounts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_student_sessions_account ON student_sessions(student_account_id);
CREATE INDEX IF NOT EXISTS idx_student_sessions_expiry ON student_sessions(expires_at);