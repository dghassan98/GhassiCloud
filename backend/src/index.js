import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { initDatabase } from './db/index.js'
import authRoutes from './routes/auth.js'
import servicesRoutes from './routes/services.js'
import navidromeRoutes from './routes/navidrome.js'
import auditRoutes from './routes/audit.js'
import { authenticateToken } from './middleware/auth.js'
import logger from './logger.js'

// Route global console to logger so any remaining console.* calls respect LOG_LEVEL
const originalConsole = global.console
global.console = {
  ...originalConsole,
  error: (...a) => logger.error(...a),
  warn:  (...a) => logger.warn(...a),
  info:  (...a) => logger.info(...a),
  log:   (...a) => logger.info(...a),
  debug: (...a) => logger.debug(...a)
}

// Load environment variables
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Initialize database and start server
async function startServer() {
  await initDatabase()

  // Apply stored global log level (if exists)
  try {
    const db = getDb()
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('logLevel')
    if (row && row.value) {
      import('./logger.js').then(mod => {
        try {
          const { setLevel } = mod
          if (setLevel) setLevel(String(row.value))
          process.env.LOG_LEVEL = String(row.value)
          logger.info({ newLevel: String(row.value) }, 'Applied stored global log level')
        } catch (e) {
          logger.error('Failed to apply stored log level:', e)
        }
      }).catch(e => logger.error('Failed to import logger to apply log level:', e))
    }
  } catch (e) {
    logger.warn('Failed to read stored log level from DB', e)
  }

  // Routes
  app.use('/api/auth', authRoutes)
  app.use('/api/services', servicesRoutes)
  app.use('/api/navidrome', navidromeRoutes)
  app.use('/api/audit', auditRoutes)

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // Error handling
  app.use((err, req, res, next) => {
    logger.error(err.stack)
    res.status(500).json({ message: 'Something went wrong!' })
  })

  app.listen(PORT, () => {
    logger.info(`🚀 GhassiCloud API running on http://localhost:${PORT}`)
  })
}

startServer().catch(err => logger.error(err))
