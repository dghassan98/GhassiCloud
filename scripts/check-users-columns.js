import { initDatabase, getDb } from '../backend/src/db/index.js'

async function main() {
  await initDatabase()
  const db = getDb()
  const cols = db.prepare("PRAGMA table_info(users)").all()
  console.log('Users table columns:')
  cols.forEach(c => console.log('-', c.name))
}

main().catch(err => { console.error(err); process.exit(1) })
