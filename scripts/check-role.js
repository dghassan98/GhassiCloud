import { readFileSync } from 'fs'
import initSqlJs from 'sql.js'

const SQL = await initSqlJs()
const fileBuffer = readFileSync('backend/data/ghassicloud.db')
const db = new SQL.Database(fileBuffer)

const stmt = db.prepare('SELECT username, role FROM users')
console.log('All users:')
while (stmt.step()) {
  const u = stmt.getAsObject()
  console.log(`  ${u.username} -> ${u.role}`)
}
stmt.free()
db.close()
