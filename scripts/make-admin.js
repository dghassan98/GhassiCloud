// Simple script to make a user admin
// Run with: node backend/src/make-admin-user.js <username>

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import initSqlJs from 'sql.js'
import logger from '../backend/src/logger.js'

const dbPath = process.env.DATABASE_PATH || 'backend/data/ghassicloud.db'

async function makeAdmin(username) {
  try {
    // Check if database exists
    if (!existsSync(dbPath)) {
      logger.error(`❌ Database not found at: ${dbPath}`)
      logger.error('Please start the backend server first to initialize the database.')
      process.exit(1)
    }

    // Load the database
    const SQL = await initSqlJs()
    const fileBuffer = readFileSync(dbPath)
    const db = new SQL.Database(fileBuffer)

    // Find the user
    const userStmt = db.prepare('SELECT * FROM users WHERE username = ?')
    userStmt.bind([username])
    
    let user = null
    if (userStmt.step()) {
      user = userStmt.getAsObject()
    }
    userStmt.free()

    if (!user) {
      logger.error(`❌ User "${username}" not found in the database.`)
      logger.info('\nAvailable users:')
      const allUsersStmt = db.prepare('SELECT username, email, role FROM users')
      while (allUsersStmt.step()) {
        const u = allUsersStmt.getAsObject()
        logger.info(`  - ${u.username} (${u.email || 'no email'}) - Role: ${u.role}`)
      }
      allUsersStmt.free()
      db.close()
      process.exit(1)
    }

    if (user.role === 'admin') {
      logger.info(`✅ User "${username}" is already an admin.`)
      db.close()
      process.exit(0)
    }

    // Update user role to admin
    const updateStmt = db.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?')
    updateStmt.bind(['admin', username])
    updateStmt.step()
    updateStmt.free()
    
    // CRITICAL: Save the database immediately after the update
    const data = db.export()
    const buffer = Buffer.from(data)
    writeFileSync(dbPath, buffer)

    logger.info(`✅ Successfully updated "${username}" to admin role!`)
    
    // Verify the change
    const verifyStmt = db.prepare('SELECT username, email, role FROM users WHERE username = ?')
    verifyStmt.bind([username])
    if (verifyStmt.step()) {
      const updatedUser = verifyStmt.getAsObject()
      logger.info(`\nUser details:`)
      logger.info(`  Username: ${updatedUser.username}`)
      logger.info(`  Email: ${updatedUser.email || 'N/A'}`)
      logger.info(`  Role: ${updatedUser.role}`)
    }
    verifyStmt.free()

    db.close()
  } catch (error) {
    logger.error('❌ Error:', error.message)
    logger.error(error.stack)
    process.exit(1)
  }
}

// Get username from command line arguments
const username = process.argv[2]

if (!username) {
  logger.error('Usage: node scripts/make-admin.js <username>')
  logger.error('Example: node scripts/make-admin.js "Ghassan Darwish"')
  process.exit(1)
}

makeAdmin(username)

