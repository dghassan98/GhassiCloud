import { readFileSync } from 'fs'
import initSqlJs from 'sql.js'
import logger from '../backend/src/logger.js'

const SQL = await initSqlJs()
const fileBuffer = readFileSync('backend/data/ghassicloud.db')
const db = new SQL.Database(fileBuffer)

const stmt = db.prepare('SELECT username, role FROM users')
logger.info('All users:')
while (stmt.step()) {
  const u = stmt.getAsObject()
  logger.info(`  ${u.username} -> ${u.role}`)
}
stmt.free()
db.close()
