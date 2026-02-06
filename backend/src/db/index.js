import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdirSync, existsSync } from 'fs'
import logger from '../logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dbPath = process.env.DATABASE_PATH || join(__dirname, '../../data/ghassicloud.db')

const dataDir = dirname(dbPath)
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}

let db = null

export async function initDatabase() {
  db = new Database(dbPath)
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  try {
    db.exec(`ALTER TABLE users ADD COLUMN sso_provider TEXT`)
  } catch (e) {
    logger.debug('sso_provider column already exists, skipping')
  }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN sso_id TEXT`)
  } catch (e) {
    logger.debug('sso_id column already exists, skipping')
  }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN first_name TEXT`)
  } catch (e) {
    logger.debug('first_name column already exists, skipping')
  }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN last_name TEXT`)
  } catch (e) {
    logger.debug('last_name column already exists, skipping')
  }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN avatar TEXT`)
  } catch (e) {
    logger.debug('avatar column already exists, skipping')
  }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN language TEXT`)
  } catch (e) {
    logger.debug('language column already exists, skipping')
  }

  try {
    db.exec(`ALTER TABLE users ADD COLUMN tokens_invalid_before DATETIME`)
  } catch (e) {
    logger.debug('tokens_invalid_before column already exists, skipping')
  }

  try {
    db.exec(`ALTER TABLE services ADD COLUMN pinned INTEGER DEFAULT 0`)
  } catch (e) {
    logger.debug('pinned column already exists in services, skipping')
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  try {
    db.exec(`ALTER TABLE services ADD COLUMN use_favicon INTEGER DEFAULT 1`)
  } catch (e) {
    logger.debug('use_favicon column already exists in services, skipping')
  }

  // Create settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  try {
    db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('pwaDevtoolsEnabled', 'false')
  } catch (e) {
    logger.warn('Failed to initialize default settings:', e)
  }

  // Event QR code defaults
  try {
    db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('eventQrUrl', '')
    db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('eventQrLabel', '')
    db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('eventQrVisible', 'false')
  } catch (e) {
    logger.warn('Failed to initialize event QR settings:', e)
  }

  // deprecated: navidrome_credentials table
  // db.exec(`
  //   CREATE TABLE IF NOT EXISTS navidrome_credentials (
  //     id TEXT PRIMARY KEY,
  //     username TEXT NOT NULL,
  //     password_hashed TEXT,
  //     password_encrypted TEXT,
  //     auth_method TEXT DEFAULT 'token',
  //     password_type TEXT,
  //     token TEXT,
  //     salt TEXT,
  //     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  //     updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  //   )
  // `)

  // Create table to persist user session metadata captured during SSO login
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      session_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      client_id TEXT,
      ip TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)`)
  } catch (e) {
    logger.error(e)
  }
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`)
  } catch (e) {
    logger.error(e)
  }
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category)`)
  } catch (e) {
    logger.error(e)
  }
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)`)
  } catch (e) {
    logger.error(e)
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
    logger.info('✅ Default admin user created')
  }

  logger.info('✅ Database initialized')

  return db
}

export function getDb() {
  return db
}

export default { initDatabase, getDb }