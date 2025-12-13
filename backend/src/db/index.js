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

const db = new Database(dbPath)

export function initDatabase() {
  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT,
      display_name TEXT,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

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
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

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
}

export default db
