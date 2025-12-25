import initSqlJs from 'sql.js'
import bcrypt from 'bcryptjs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dbPath = process.env.DATABASE_PATH || join(__dirname, '../../data/ghassicloud.db')

// Ensure data directory exists
const dataDir = dirname(dbPath)
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}

let db = null

// Save database to file
function saveDatabase() {
  if (db) {
    const data = db.export()
    const buffer = Buffer.from(data)
    writeFileSync(dbPath, buffer)
  }
}

// Initialize sql.js and load/create database
async function initSqlJsDb() {
  const SQL = await initSqlJs()
  
  if (existsSync(dbPath)) {
    const fileBuffer = readFileSync(dbPath)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }
  
  return db
}

// Wrapper to make sql.js work like better-sqlite3 API
function createDbWrapper(database) {
  return {
    exec: (sql) => {
      database.run(sql)
      saveDatabase()
    },
    prepare: (sql) => ({
      run: (...params) => {
        database.run(sql, params)
        saveDatabase()
      },
      get: (...params) => {
        const stmt = database.prepare(sql)
        stmt.bind(params)
        if (stmt.step()) {
          const row = stmt.getAsObject()
          stmt.free()
          return row
        }
        stmt.free()
        return undefined
      },
      all: (...params) => {
        const stmt = database.prepare(sql)
        stmt.bind(params)
        const results = []
        while (stmt.step()) {
          results.push(stmt.getAsObject())
        }
        stmt.free()
        return results
      }
    })
  }
}

let dbWrapper = null

export async function initDatabase() {
  const database = await initSqlJsDb()
  dbWrapper = createDbWrapper(database)
  
  // Create users table
  dbWrapper.exec(`
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
  
  // Add SSO columns if they don't exist (migration for existing DBs)
  try {
    dbWrapper.exec(`ALTER TABLE users ADD COLUMN sso_provider TEXT`)
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    dbWrapper.exec(`ALTER TABLE users ADD COLUMN sso_id TEXT`)
  } catch (e) {
    // Column already exists, ignore
  }
  
  // Add pinned column to services if it doesn't exist
  try {
    dbWrapper.exec(`ALTER TABLE services ADD COLUMN pinned INTEGER DEFAULT 0`)
  } catch (e) {
    // Column already exists, ignore
  }

  // Create services table
  dbWrapper.exec(`
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
    dbWrapper.exec(`ALTER TABLE services ADD COLUMN use_favicon INTEGER DEFAULT 1`)
  } catch (e) {
    // Column already exists, ignore
  }

  // Create settings table
  dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Create default admin user if not exists
  const adminUser = dbWrapper.prepare('SELECT * FROM users WHERE username = ?').get(
    process.env.DEFAULT_ADMIN_USER || 'admin'
  )

  if (!adminUser) {
    const hashedPassword = bcrypt.hashSync(
      process.env.DEFAULT_ADMIN_PASS || 'admin',
      10
    )
    dbWrapper.prepare(`
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
  
  return dbWrapper
}

export function getDb() {
  return dbWrapper
}

export default { initDatabase, getDb }
