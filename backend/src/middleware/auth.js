import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}
