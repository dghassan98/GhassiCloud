import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import logger from '../logger.js'

const JWT_SECRET = process.env.JWT_SECRET || (() => {
  const secret = crypto.randomBytes(64).toString('hex')
  logger.warn('⚠️  No JWT_SECRET provided. Auto-generated secret (this will change on restart):')
  logger.warn('   Set JWT_SECRET in .env to persist across restarts')
  return secret
})()

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ message: 'Access token required' })
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET)
    // Check if session is still valid (if sessionId is present)
    if (payload.sessionId && payload.id) {
      try {
        const dbModule = await import('../db/index.js')
        const db = dbModule.getDb()
        const row = db.prepare('SELECT session_id FROM user_sessions WHERE session_id = ? AND user_id = ?').get(payload.sessionId, payload.id)

        if (!row) {
          const anySessions = db.prepare('SELECT COUNT(*) as count FROM user_sessions WHERE user_id = ?').get(payload.id)
          if (anySessions && anySessions.count > 0) {
            return res.status(403).json({ message: 'Session revoked' })
          }
        }
      } catch (e) {
        logger.error('Session check failed:', e)
      }
    }

    try {
      const dbModule = await import('../db/index.js')
      const db = dbModule.getDb()
      const u = db.prepare('SELECT tokens_invalid_before FROM users WHERE id = ?').get(payload.id)
      if (u && u.tokens_invalid_before) {
        const invalidBefore = new Date(u.tokens_invalid_before).getTime()
        if (!isNaN(invalidBefore) && payload.iat && (payload.iat * 1000) < invalidBefore) {
          return res.status(403).json({ message: 'Token invalidated' })
        }
      }
    } catch (e) {
      logger.error('Token invalidation check failed:', e)
    }

    req.user = payload
    next()
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired token' })
  }
}

export function generateToken(user, sessionId = null) {
  const payload = { id: user.id, username: user.username, role: user.role }
  if (sessionId) payload.sessionId = sessionId
  const expiresIn = process.env.JWT_EXPIRES_IN || '365d'
  return jwt.sign(payload, JWT_SECRET, { expiresIn })
}