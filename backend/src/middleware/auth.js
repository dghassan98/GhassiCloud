import jwt from 'jsonwebtoken'
import crypto from 'crypto'

// Auto-generate a persistent JWT secret if not provided
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  const secret = crypto.randomBytes(64).toString('hex')
  console.log('⚠️  No JWT_SECRET provided. Auto-generated secret (this will change on restart):')
  console.log('   Set JWT_SECRET in .env to persist across restarts')
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
    // If token contains a sessionId, ensure it still exists (prevents use after session revocation)
    if (payload.sessionId && payload.id) {
      try {
        const dbModule = await import('../db/index.js')
        const db = dbModule.getDb()
        const row = db.prepare('SELECT session_id FROM user_sessions WHERE session_id = ? AND user_id = ?').get(payload.sessionId, payload.id)
        if (!row) return res.status(403).json({ message: 'Session revoked' })
      } catch (e) {
        console.error('Session check failed:', e)
        // Allow fallback (don't block) if DB check fails unexpectedly
      }
    }

    // Also ensure token issue time is after user's tokens_invalid_before (for global revokes)
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
      console.error('Token invalidation check failed:', e)
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
