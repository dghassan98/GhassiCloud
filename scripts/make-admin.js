// Simple script to make a user admin
// Run with: node backend/src/make-admin-user.js <username>

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import initSqlJs from 'sql.js'

const dbPath = process.env.DATABASE_PATH || 'backend/data/ghassicloud.db'

async function makeAdmin(username) {
  try {
    // Check if database exists
    if (!existsSync(dbPath)) {
      console.error(`❌ Database not found at: ${dbPath}`)
      console.error('Please start the backend server first to initialize the database.')
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
      console.error(`❌ User "${username}" not found in the database.`)
      console.log('\nAvailable users:')
      const allUsersStmt = db.prepare('SELECT username, email, role FROM users')
      while (allUsersStmt.step()) {
        const u = allUsersStmt.getAsObject()
        console.log(`  - ${u.username} (${u.email || 'no email'}) - Role: ${u.role}`)
      }
      allUsersStmt.free()
      db.close()
      process.exit(1)
    }

    if (user.role === 'admin') {
      console.log(`✅ User "${username}" is already an admin.`)
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

    console.log(`✅ Successfully updated "${username}" to admin role!`)
    
    // Verify the change
    const verifyStmt = db.prepare('SELECT username, email, role FROM users WHERE username = ?')
    verifyStmt.bind([username])
    if (verifyStmt.step()) {
      const updatedUser = verifyStmt.getAsObject()
      console.log(`\nUser details:`)
      console.log(`  Username: ${updatedUser.username}`)
      console.log(`  Email: ${updatedUser.email || 'N/A'}`)
      console.log(`  Role: ${updatedUser.role}`)
    }
    verifyStmt.free()

    db.close()
  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Get username from command line arguments
const username = process.argv[2]

if (!username) {
  console.error('Usage: node scripts/make-admin.js <username>')
  console.error('Example: node scripts/make-admin.js "Ghassan Darwish"')
  process.exit(1)
}

makeAdmin(username)

