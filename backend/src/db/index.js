import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdirSync, existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dbPath = process.env.DATABASE_PATH || join(__dirname, '../../data/ghassicloud.db')

// Ensure data directory exists
const dataDir = dirname(dbPath)
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}

let db = null

export async function initDatabase() {
  db = new Database(dbPath)
  
  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT,
      display_name TEXT,
      role TEXT DEFAULT 'user',
      sso_provider TEXT,
      sso_id TEXT,
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      updated_at DATETIME DEFAULT (datetime('now','localtime'))
    )
  `)
  
  // Add SSO columns if they don't exist (migration for existing DBs)
  try {
    db.exec(`ALTER TABLE users ADD COLUMN sso_provider TEXT`)
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN sso_id TEXT`)
  } catch (e) {
    // Column already exists, ignore
  }
  // Add first_name, last_name and avatar for richer profiles
  try {
    db.exec(`ALTER TABLE users ADD COLUMN first_name TEXT`)
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN last_name TEXT`)
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN avatar TEXT`)
  } catch (e) {
    // Column already exists, ignore
  }
  // Add language column for user preference
  try {
    db.exec(`ALTER TABLE users ADD COLUMN language TEXT`)
  } catch (e) {
    // Column already exists, ignore
  }
  // Add tokens_invalid_before to allow invalidating tokens issued before a time
  try {
    db.exec(`ALTER TABLE users ADD COLUMN tokens_invalid_before DATETIME`)
  } catch (e) {
    // Column already exists, ignore
  }

  // Remove legacy logout_preference column if present (we no longer support this setting)
  try {
    const cols = db.prepare(`PRAGMA table_info(users)`).all()
    const hasLogout = cols && Array.isArray(cols) && cols.some(c => c.name === 'logout_preference')
    if (hasLogout) {
      // Recreate users table without logout_preference column
      db.exec(`BEGIN;
        CREATE TABLE IF NOT EXISTS users_new (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          email TEXT,
          display_name TEXT,
          role TEXT DEFAULT 'user',
          sso_provider TEXT,
          sso_id TEXT,
          created_at DATETIME DEFAULT (datetime('now','localtime')),
          updated_at DATETIME DEFAULT (datetime('now','localtime')),
          first_name TEXT,
          last_name TEXT,
          avatar TEXT,
          language TEXT,
          tokens_invalid_before DATETIME
        );
        INSERT INTO users_new (id, username, password, email, display_name, role, sso_provider, sso_id, created_at, updated_at, first_name, last_name, avatar, language, tokens_invalid_before)
          SELECT id, username, password, email, display_name, role, sso_provider, sso_id, created_at, updated_at, first_name, last_name, avatar, language, tokens_invalid_before FROM users;
        DROP TABLE users;
        ALTER TABLE users_new RENAME TO users;
        COMMIT;`)
    }
  } catch (e) {
    console.warn('Failed to remove logout_preference during migration:', e)
  }
  
  // Add pinned column to services if it doesn't exist
  try {
    db.exec(`ALTER TABLE services ADD COLUMN pinned INTEGER DEFAULT 0`)
  } catch (e) {
    // Column already exists, ignore
  }

  // Create services table
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      url TEXT NOT NULL,
      icon TEXT DEFAULT 'cloud',
      color TEXT DEFAULT '#6366f1',
      status TEXT DEFAULT 'online',
      category TEXT,
      use_favicon INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      updated_at DATETIME DEFAULT (datetime('now','localtime'))
    )
  `)
  
  // Add use_favicon column if it doesn't exist (migration for existing DBs)
  try {
    db.exec(`ALTER TABLE services ADD COLUMN use_favicon INTEGER DEFAULT 1`)
  } catch (e) {
    // Column already exists, ignore
  }

  // Create settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT (datetime('now','localtime'))
    )
  `)

  // Create navidrome credentials table (single credential storage for Now Playing)
  db.exec(`
    CREATE TABLE IF NOT EXISTS navidrome_credentials (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      password_hashed TEXT,
      password_encrypted TEXT,
      auth_method TEXT DEFAULT 'token',
      password_type TEXT,
      token TEXT,
      salt TEXT,
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      updated_at DATETIME DEFAULT (datetime('now','localtime'))
    )
  `)

  // Create table to persist user session metadata captured during SSO login
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      session_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      client_id TEXT,
      ip TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      last_seen DATETIME DEFAULT (datetime('now','localtime'))
    )
  `)

  // Create audit_logs table for tracking all user activities and access changes
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      username TEXT,
      action TEXT NOT NULL,
      category TEXT NOT NULL,
      resource_type TEXT,
      resource_id TEXT,
      resource_name TEXT,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      status TEXT DEFAULT 'success',
      created_at DATETIME DEFAULT (datetime('now','localtime'))
    )
  `)

  // Create index for faster queries on audit_logs
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)`)
  } catch (e) { /* Index may already exist */ }
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`)
  } catch (e) { /* Index may already exist */ }
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category)`)
  } catch (e) { /* Index may already exist */ }
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)`)
  } catch (e) { /* Index may already exist */ }

  // Add new columns if migrating from older DB (safe to run on existing DB)
  try {
    db.exec(`ALTER TABLE navidrome_credentials ADD COLUMN password_hashed TEXT`)
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.exec(`ALTER TABLE navidrome_credentials ADD COLUMN password_encrypted TEXT`)
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.exec(`ALTER TABLE navidrome_credentials ADD COLUMN auth_method TEXT DEFAULT 'token'`)
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.exec(`ALTER TABLE navidrome_credentials ADD COLUMN password_type TEXT`)
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.exec(`ALTER TABLE navidrome_credentials ADD COLUMN token TEXT`)
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.exec(`ALTER TABLE navidrome_credentials ADD COLUMN salt TEXT`)
  } catch (e) {
    // Column already exists, ignore
  }

  // Create default admin user if not exists
  const adminUser = db.prepare('SELECT * FROM users WHERE username = ?').get(
    process.env.DEFAULT_ADMIN_USER || 'admin'
  )

  if (!adminUser) {
    const hashedPassword = bcrypt.hashSync(
      process.env.DEFAULT_ADMIN_PASS || 'admin',
      10
    )
    db.prepare(`
      INSERT INTO users (id, username, password, role, display_name)
      VALUES (?, ?, ?, 'admin', 'Administrator')
    `).run(
      crypto.randomUUID(),
      process.env.DEFAULT_ADMIN_USER || 'admin',
      hashedPassword
    )
    console.log('✅ Default admin user created')
  }

  console.log('✅ Database initialized')
  
  return db
}

export function getDb() {
  return db
}

export default { initDatabase, getDb }
