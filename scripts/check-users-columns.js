import { initDatabase, getDb } from '../backend/src/db/index.js'
import logger from '../backend/src/logger.js'

async function main() {
  await initDatabase()
  const db = getDb()
  const cols = db.prepare("PRAGMA table_info(users)").all()
  logger.info('Users table columns:')
  cols.forEach(c => logger.info('-', c.name))
}

main().catch(err => { logger.error(err); process.exit(1) })
