const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './database/primetrade.db';
const dbDir = path.dirname(DB_PATH);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const initSchema = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'cancelled')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
      due_date TEXT,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Self-healing admin seed:
  // If admin doesn't exist → create it.
  // If admin exists but password is wrong → fix it.
  const ADMIN_EMAIL = 'admin@primetrade.ai';
  const ADMIN_PASS  = 'Admin@1234';

  const existing = db.prepare('SELECT id, password FROM users WHERE email = ?').get(ADMIN_EMAIL);

  if (!existing) {
    const hash = bcrypt.hashSync(ADMIN_PASS, 12);
    db.prepare(
      'INSERT INTO users (id, username, email, password, role) VALUES (?, ?, ?, ?, ?)'
    ).run('admin-seed-001', 'admin', ADMIN_EMAIL, hash, 'admin');
    console.log('✅ Admin created: admin@primetrade.ai / Admin@1234');
  } else {
    const ok = bcrypt.compareSync(ADMIN_PASS, existing.password);
    if (!ok) {
      const hash = bcrypt.hashSync(ADMIN_PASS, 12);
      db.prepare('UPDATE users SET password = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run(hash, existing.id);
      console.log('🔧 Admin password corrected: admin@primetrade.ai / Admin@1234');
    }
  }
};

initSchema();

module.exports = db;
