PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  username TEXT,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  is_banned INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS admins (
  telegram_id INTEGER PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('OWNER','ADMIN')),
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS membership_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  game_name TEXT, real_name TEXT, age TEXT, government_activity TEXT,
  optional_family_member TEXT, previous_family_reason TEXT, status TEXT NOT NULL DEFAULT 'OPEN',
  reject_reason TEXT, reviewed_at TEXT, reviewed_by INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_membership_status ON membership_requests(status);
CREATE INDEX IF NOT EXISTS idx_membership_user_status ON membership_requests(user_id, status);
CREATE TABLE IF NOT EXISTS membership_request_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT, request_id INTEGER NOT NULL REFERENCES membership_requests(id) ON DELETE CASCADE,
  telegram_file_id TEXT NOT NULL, telegram_file_unique_id TEXT NOT NULL, storage_key TEXT, metadata_json TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS membership_request_voice (
  request_id INTEGER PRIMARY KEY REFERENCES membership_requests(id) ON DELETE CASCADE,
  telegram_file_id TEXT NOT NULL, telegram_file_unique_id TEXT NOT NULL, duration INTEGER NOT NULL, storage_key TEXT, metadata_json TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS form_sessions (
  user_id INTEGER PRIMARY KEY, kind TEXT NOT NULL, step INTEGER NOT NULL, request_id INTEGER, data_json TEXT NOT NULL DEFAULT '{}',
  expires_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS support_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
  message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_support_status ON support_tickets(status);
CREATE TABLE IF NOT EXISTS support_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id INTEGER, action TEXT NOT NULL, entity_type TEXT,
  entity_id TEXT, payload_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS broadcasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, sender_id INTEGER NOT NULL, body TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0, success INTEGER NOT NULL DEFAULT 0, failed INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL, finished_at TEXT
);
CREATE TABLE IF NOT EXISTS broadcast_recipients (
  broadcast_id INTEGER NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE, user_id INTEGER NOT NULL,
  status TEXT NOT NULL, error TEXT, PRIMARY KEY (broadcast_id, user_id)
);
INSERT OR IGNORE INTO settings(key, value, updated_at) VALUES ('membership_requests_enabled', 'true', datetime('now'));
INSERT OR IGNORE INTO settings(key, value, updated_at) VALUES ('membership_disabled_reason', '', datetime('now'));
