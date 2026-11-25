PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS login_links (
  digest TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS login_email_expiry ON login_links(email, expires);
CREATE TABLE IF NOT EXISTS sessions (
  digest TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS works (
  id TEXT PRIMARY KEY,
  author_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK(type IN ('character', 'dlc')),
  draft TEXT NOT NULL,
  published TEXT,
  status TEXT NOT NULL CHECK(status IN ('draft','pending','approved','rejected')),
  revision INTEGER NOT NULL DEFAULT 1,
  review_note TEXT NOT NULL DEFAULT '',
  reviewed_by INTEGER REFERENCES users(id),
  updated_at INTEGER NOT NULL,
  published_at INTEGER
);
CREATE INDEX IF NOT EXISTS works_catalog ON works(type, published_at DESC, id);
CREATE INDEX IF NOT EXISTS works_owner ON works(author_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS launch_examples (
  slug TEXT PRIMARY KEY,
  work_id TEXT NOT NULL UNIQUE REFERENCES works(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS installs (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  PRIMARY KEY(user_id, work_id)
);
CREATE TABLE IF NOT EXISTS passwords (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  salt TEXT NOT NULL,
  hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS account_actions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  admin_id INTEGER NOT NULL REFERENCES users(id),
  action TEXT NOT NULL CHECK(action IN ('warn','ban','unban')),
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS account_actions_user ON account_actions(user_id, id DESC);
CREATE TABLE IF NOT EXISTS likes (
  user_id INTEGER NOT NULL REFERENCES users(id),
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  PRIMARY KEY(work_id, user_id)
);
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS comments_work ON comments(work_id, status, id DESC);
CREATE TABLE IF NOT EXISTS work_categories (
  work_id TEXT PRIMARY KEY REFERENCES works(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK(category IN ('character','world','simulator','mod')),
  public_title TEXT,
  public_summary TEXT
);
CREATE INDEX IF NOT EXISTS work_categories_filter ON work_categories(category, work_id);
CREATE TABLE IF NOT EXISTS creator_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bio TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS creator_follows (
  follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  remind_since INTEGER,
  PRIMARY KEY(follower_id, creator_id)
);
CREATE TABLE IF NOT EXISTS creator_avatars (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  image TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS workshop_inbox (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  seen_at INTEGER NOT NULL
);
