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
    console.error(err.stack)
    res.status(500).json({ message: 'Something went wrong!' })
  })

  app.listen(PORT, () => {
    console.log(`🚀 GhassiCloud API running on http://localhost:${PORT}`)
  })
}

startServer().catch(console.error)
