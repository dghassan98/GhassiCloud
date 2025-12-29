import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

export function authenticateToken(req, res, next) {
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
        const { getDb } = await import('../db/index.js')
        const db = getDb()
        const row = db.prepare('SELECT session_id FROM user_sessions WHERE session_id = ? AND user_id = ?').get(payload.sessionId, payload.id)
        if (!row) return res.status(403).json({ message: 'Session revoked' })
      } catch (e) {
        console.error('Session check failed:', e)
        // Allow fallback (don't block) if DB check fails unexpectedly
      }
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
