import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { getDb } from '../db/index.js'
import { authenticateToken, generateToken } from '../middleware/auth.js'

const router = Router()

// Keycloak SSO Configuration
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'https://auth.ghassandarwish.com'
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'master'
const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'ghassicloud'

// File-backed SSO configuration helpers
import fs from 'fs/promises'
import path from 'path'

const SSO_CONFIG_FILE = path.resolve('backend', 'data', 'sso-config.json')

async function readSSOConfig() {
  try {
    const raw = await fs.readFile(SSO_CONFIG_FILE, 'utf8')
    const json = JSON.parse(raw)
    return json
  } catch (e) {
    // fallback to environment defaults
    return {
      authUrl: `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/auth`,
      clientId: KEYCLOAK_CLIENT_ID,
      scope: 'openid profile email'
    }
  }
}

async function writeSSOConfig(cfg) {
  try {
    // Ensure folder exists
    await fs.mkdir(path.dirname(SSO_CONFIG_FILE), { recursive: true })
    await fs.writeFile(SSO_CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8')
    return true
  } catch (e) {
    console.error('Failed to write SSO config file:', e)
    return false
  }
}

// Get SSO configuration for frontend (returns file-backed or env defaults)
router.get('/sso/config', async (req, res) => {
  try {
    const cfg = await readSSOConfig()
    res.json(cfg)
  } catch (err) {
    console.error('Error reading SSO config:', err)
    res.status(500).json({ message: 'Failed to read SSO configuration' })
  }
})

// Update SSO configuration (admin-only)
router.put('/sso/config', authenticateToken, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' })
    }

    const { authUrl, clientId, scope } = req.body
    if (!authUrl || !clientId) {
      return res.status(400).json({ message: 'authUrl and clientId are required' })
    }

    const newCfg = { authUrl, clientId, scope: scope || 'openid profile email' }
    const ok = await writeSSOConfig(newCfg)
    if (!ok) return res.status(500).json({ message: 'Failed to save SSO configuration' })

    res.json(newCfg)
  } catch (err) {
    console.error('Update SSO config error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

// Reset SSO configuration (delete file, fall back to env defaults) - admin-only
router.delete('/sso/config', authenticateToken, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' })
    }
    try {
      await fs.unlink(SSO_CONFIG_FILE)
    } catch (e) {
      // ignore if missing
    }
    const cfg = await readSSOConfig()
    res.json(cfg)
  } catch (err) {
    console.error('Reset SSO config error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

// Exchange authorization code for tokens and create/login user (PKCE flow)
router.post('/sso/callback', async (req, res) => {
  try {
    const { code, redirectUri, codeVerifier } = req.body

    console.log('SSO callback received:', { 
      hasCode: !!code, 
      redirectUri, 
      codeVerifierLength: codeVerifier?.length 
    })

    if (!code) {
      return res.status(400).json({ message: 'Authorization code required' })
    }

    if (!codeVerifier) {
      return res.status(400).json({ message: 'Code verifier required for PKCE' })
    }

    // Exchange code for tokens using PKCE
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: KEYCLOAK_CLIENT_ID,
      code: code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    })

    console.log('Requesting token from:', `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`)

    const tokenResponse = await fetch(
      `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams
      }
    )

    const tokenResponseText = await tokenResponse.text()
    console.log('Token response status:', tokenResponse.status)
    
    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokenResponseText)
      return res.status(401).json({ message: 'Failed to exchange authorization code', details: tokenResponseText })
    }

    let tokens
    try {
      tokens = JSON.parse(tokenResponseText)
    } catch (e) {
      console.error('Failed to parse token response:', tokenResponseText)
      return res.status(500).json({ message: 'Invalid token response from auth server' })
    }

    // Get user info from Keycloak
    const userInfoResponse = await fetch(
      `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/userinfo`,
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      }
    )

    if (!userInfoResponse.ok) {
      return res.status(401).json({ message: 'Failed to get user info' })
    }

    const userInfo = await userInfoResponse.json()

    // Find or create user in database
    const db = getDb()
    let user = db.prepare('SELECT * FROM users WHERE email = ? OR username = ?').get(
      userInfo.email,
      userInfo.preferred_username || userInfo.email
    )

    // Capture session metadata for Active Sessions UI
    try {
      // token response may include session_state or similar identifier
      const sessionId = tokens.session_state || tokens.sessionId || tokens.session || null
      const ip = req.ip || (req.headers && (req.headers['x-forwarded-for'] || req.connection?.remoteAddress)) || null
      const userAgent = req.headers?.['user-agent'] || ''

      if (sessionId) {
        try {
          db.prepare(`INSERT OR REPLACE INTO user_sessions (session_id, user_id, client_id, ip, user_agent, last_seen) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`)
            .run(sessionId, user && user.id ? user.id : 'unknown', KEYCLOAK_CLIENT_ID, ip, userAgent)
        } catch (e) {
          // ignore failures to avoid breaking SSO login flow
          console.warn('Failed to persist SSO session metadata:', e)
        }
      }
    } catch (e) {
      // non-fatal
    }

    if (!user) {
      // Create new user from SSO
      const userId = crypto.randomUUID()
      const username = userInfo.preferred_username || userInfo.email.split('@')[0]
      // Generate a random password for SSO users (they won't use it)
      const randomPassword = bcrypt.hashSync(crypto.randomUUID(), 10)
      const firstName = userInfo.given_name || null
      const lastName = userInfo.family_name || null
      const avatar = userInfo.picture || null
      const language = userInfo.locale || userInfo.preferred_locale || userInfo.lang || null

      db.prepare(`
        INSERT INTO users (id, username, password, email, display_name, role, sso_provider, sso_id, first_name, last_name, avatar, language)
        VALUES (?, ?, ?, ?, ?, 'user', 'keycloak', ?, ?, ?, ?, ?)
      `).run(
        userId,
        username,
        randomPassword,
        userInfo.email,
        userInfo.name || userInfo.preferred_username,
        userInfo.sub,
        firstName,
        lastName,
        avatar,
        language
      )

      user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
    } else {
      // Update SSO info if not set and fill missing profile info
      const updates = {}
      if (!user.sso_provider) {
        updates.sso_provider = 'keycloak'
        updates.sso_id = userInfo.sub
      }
      if (!user.first_name && userInfo.given_name) updates.first_name = userInfo.given_name
      if (!user.last_name && userInfo.family_name) updates.last_name = userInfo.family_name
      // Always update avatar from SSO if provided and different from existing — prefer the provider's image
      if (userInfo.picture && user.avatar !== userInfo.picture) updates.avatar = userInfo.picture
      if (!user.language && (userInfo.locale || userInfo.preferred_locale || userInfo.lang)) updates.language = userInfo.locale || userInfo.preferred_locale || userInfo.lang

      if (Object.keys(updates).length > 0) {
        const params = []
        const sets = []
        Object.entries(updates).forEach(([k,v]) => { sets.push(`${k} = ?`); params.push(v) })
        params.push(user.id)
        db.prepare(`UPDATE users SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...params)
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)
      }
    }

    // Generate our own JWT token and include Keycloak session id when available
    const sessionId = tokens.session_state || tokens.sessionId || tokens.session || null
    const token = generateToken(user, sessionId)

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        firstName: user.first_name || null,
        lastName: user.last_name || null,
        avatar: user.avatar || null,
        language: user.language || null,
        role: user.role,
        ssoProvider: user.sso_provider || null
      }
    })
  } catch (err) {
    console.error('SSO callback error:', err)
    res.status(500).json({ message: 'SSO authentication failed' })
  }
})

// Login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body
    const db = getDb()

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' })
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const validPassword = bcrypt.compareSync(password, user.password)

    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const token = generateToken(user)

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        firstName: user.first_name || null,
        lastName: user.last_name || null,
        avatar: user.avatar || null,
        language: user.language || null,
        role: user.role,
        ssoProvider: user.sso_provider || null
      }
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get current user
router.get('/me', authenticateToken, (req, res) => {
  try {
    const db = getDb()
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        firstName: user.first_name || null,
        lastName: user.last_name || null,
        avatar: user.avatar || null,
        language: user.language || null,
        role: user.role,
        ssoProvider: user.sso_provider || null
      }
    })
  } catch (err) {
    console.error('Get user error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

// Update password
router.put('/password', authenticateToken, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    const db = getDb()

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password required' })
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Prevent password changes for SSO users
    if (user.sso_provider) {
      return res.status(400).json({ message: 'Password cannot be changed for SSO users. Change your password via your identity provider.' })
    }

    const validPassword = bcrypt.compareSync(currentPassword, user.password)

    if (!validPassword) {
      return res.status(401).json({ message: 'Current password is incorrect' })
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10)

    db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(hashedPassword, req.user.id)

    res.json({ message: 'Password updated successfully' })
  } catch (err) {
    console.error('Update password error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

// Update profile
router.put('/profile', authenticateToken, (req, res) => {
  try {
    const { email, displayName, firstName, lastName, avatar, language } = req.body
    const db = getDb()

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)

    // Prevent changing email (and username) for SSO users
    if (user.sso_provider && email && email !== user.email) {
      return res.status(400).json({ message: 'Email cannot be changed for SSO users' })
    }

    const finalEmail = user.sso_provider ? user.email : (email || user.email)
    const finalDisplay = (typeof displayName === 'undefined') ? user.display_name : displayName || null
    const finalFirst = (typeof firstName === 'undefined') ? user.first_name : (firstName || null)
    const finalLast = (typeof lastName === 'undefined') ? user.last_name : (lastName || null)
    const finalAvatar = (typeof avatar === 'undefined') ? user.avatar : (avatar || null)
    const finalLanguage = (typeof language === 'undefined') ? user.language : (language || null)

    db.prepare('UPDATE users SET email = ?, display_name = ?, first_name = ?, last_name = ?, avatar = ?, language = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(finalEmail, finalDisplay, finalFirst, finalLast, finalAvatar, finalLanguage, req.user.id)

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)

    res.json({
      user: {
        id: updated.id,
        username: updated.username,
        email: updated.email,
        displayName: updated.display_name,
        firstName: updated.first_name || null,
        lastName: updated.last_name || null,
        avatar: updated.avatar || null,
        language: updated.language || null,
        role: updated.role,
        ssoProvider: updated.sso_provider || null
      }
    })
  } catch (err) {
    console.error('Update profile error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

// --- Sessions and user-level security settings ---

// --- Keycloak admin token helper with client_credentials retrieval & caching ---
let _kcAdminCache = { token: null, expiresAt: 0 }

async function getKeycloakAdminToken() {
  // 1) Prefer explicit admin token provided via env for quick testing
  if (process.env.KEYCLOAK_ADMIN_TOKEN) return process.env.KEYCLOAK_ADMIN_TOKEN

  // 2) Use client credentials flow if client id & secret are configured
  const clientId = process.env.KEYCLOAK_ADMIN_CLIENT_ID
  const clientSecret = process.env.KEYCLOAK_ADMIN_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Keycloak admin token not configured (set KEYCLOAK_ADMIN_TOKEN or KEYCLOAK_ADMIN_CLIENT_ID+KEYCLOAK_ADMIN_CLIENT_SECRET)')

  // Use cached token when still valid
  if (_kcAdminCache.token && Date.now() < _kcAdminCache.expiresAt) return _kcAdminCache.token

  // Request new token
  const tokenUrl = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`
  const params = new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret })
  const res = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Failed to obtain Keycloak admin token: ${res.status} ${txt}`)
  }

  const data = await res.json()
  if (!data.access_token) throw new Error('Invalid token response from Keycloak')

  // Cache token until shortly before expiry
  const expiresIn = Number(data.expires_in || 60)
  _kcAdminCache.token = data.access_token
  _kcAdminCache.expiresAt = Date.now() + Math.max(1000, (expiresIn - 30) * 1000) // refresh 30s before expiry

  return _kcAdminCache.token
}

// Helper to call Keycloak admin endpoints using the retrieved token
async function callKeycloakAdmin(path, options = {}) {
  const token = await getKeycloakAdminToken()
  const url = `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}${path}`
  const opts = Object.assign({ headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }, options)
  return fetch(url, opts)
}

// Get active sessions for current user (Keycloak-backed users only)
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const db = getDb()
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
    if (!user) return res.status(404).json({ message: 'User not found' })

    // Only supported for Keycloak SSO users
    if (!user.sso_provider || !user.sso_id) return res.json({ sessions: [] })

    try {
      const r = await callKeycloakAdmin(`/users/${encodeURIComponent(user.sso_id)}/sessions`, { method: 'GET' })
      if (!r.ok) {
        const text = await r.text()
        console.error('Keycloak sessions fetch failed:', r.status, text)
        return res.status(502).json({ message: 'Failed to fetch sessions from SSO provider' })
      }
      const kcSessions = await r.json()
      // kcSessions is an array of { id, ipAddress, start, lastAccess, client } depending on KC version

      // Fetch local metadata and merge where possible
      const local = db.prepare('SELECT * FROM user_sessions WHERE user_id = ?').all(user.id)
      const localMap = new Map(local.map(s => [s.session_id, s]))

      // Determine requester identifiers for marking current session and risk
      const currentIp = (req.headers && (req.headers['x-forwarded-for'] || req.headers['x-forwarded-host']))
        ? (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
        : (req.ip || (req.connection && req.connection.remoteAddress) || null)
      const currentUA = req.headers && req.headers['user-agent'] ? req.headers['user-agent'] : ''

      const merged = kcSessions.map(k => {
        const matching = localMap.get(k.id)
        const ipAddr = k.ipAddress || k.clientAddress || (matching && matching.ip) || null
        const ua = matching ? matching.user_agent : null
        const clientId = k.client || k.clientId || (matching && matching.client_id) || null
        const lastAccess = k.lastAccess || null
        const createdAt = matching ? matching.created_at : null

        // Heuristic: current session if both IP and UA match (or UA contains matching snippet)
        let isCurrent = false
        try {
          if (ipAddr && currentIp && ipAddr === currentIp) {
            if (!ua || !currentUA) isCurrent = true
            else if (currentUA === ua || currentUA.includes(ua) || ua.includes(currentUA.substring(0, 30))) isCurrent = true
          }
        } catch (e) {
          // ignore
        }

        // Risk flags
        const risk = []
        if (ipAddr && currentIp && ipAddr !== currentIp) risk.push('differentIp')
        if (ua && currentUA && ua !== currentUA && !(currentUA.includes(ua) || ua.includes(currentUA.substring(0, 30)))) risk.push('differentDevice')
        const last = lastAccess || createdAt
        if (last) {
          const lastTs = new Date(last).getTime()
          if (!isNaN(lastTs)) {
            const days = (Date.now() - lastTs) / (1000 * 60 * 60 * 24)
            if (days > 30) risk.push('staleSession')
          }
        }
        if (!clientId) risk.push('unknownClient')

        return {
          id: k.id,
          ipAddress: ipAddr,
          clientId,
          start: k.start || null,
          lastAccess,
          userAgent: ua,
          createdAt,
          local: !!matching,
          isCurrent,
          risk
        }
      })

      // Include any local-only sessions (where KC didn't return an id)
      local.forEach(l => {
        if (!kcSessions.find(k => k.id === l.session_id)) {
          const ipAddr = l.ip
          const ua = l.user_agent
          let isCurrent = false
          try {
            const currentIpHeader = (req.headers && (req.headers['x-forwarded-for'] || req.headers['x-forwarded-host'])) ? (req.headers['x-forwarded-for'] || '').split(',')[0].trim() : (req.ip || (req.connection && req.connection.remoteAddress) || null)
            const currentUAHeader = req.headers && req.headers['user-agent'] ? req.headers['user-agent'] : ''
            if (ipAddr && currentIpHeader && ipAddr === currentIpHeader) {
              if (!ua || !currentUAHeader) isCurrent = true
              else if (currentUAHeader === ua || currentUAHeader.includes(ua) || ua.includes(currentUAHeader.substring(0, 30))) isCurrent = true
            }
          } catch (e) {}

          const risk = []
          if (ipAddr && req.ip && ipAddr !== req.ip) risk.push('differentIp')
          if (ua && req.headers && req.headers['user-agent'] && ua !== req.headers['user-agent'] && !(req.headers['user-agent'].includes(ua) || ua.includes((req.headers['user-agent'] || '').substring(0, 30)))) risk.push('differentDevice')
          const last = l.last_seen || l.created_at
          if (last) {
            const lastTs = new Date(last).getTime()
            if (!isNaN(lastTs)) {
              const days = (Date.now() - lastTs) / (1000 * 60 * 60 * 24)
              if (days > 30) risk.push('staleSession')
            }
          }

          merged.push({ id: l.session_id, ipAddress: ipAddr, clientId: l.client_id, userAgent: ua, createdAt: l.created_at, lastAccess: l.last_seen, local: true, isCurrent, risk })
        }
      })

      return res.json({ sessions: merged })
    } catch (err) {
      console.error('Sessions endpoint error:', err)
      return res.status(500).json({ message: 'Failed to fetch sessions' })
    }
  } catch (err) {
    console.error('Get sessions error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

// Revoke sessions. If body = { all: true } -> logout all sessions.
// If body = { sessionId: '...' } -> attempt to remove a single session (best-effort).
router.post('/sessions/revoke', authenticateToken, async (req, res) => {
  try {
    const { all, sessionId } = req.body || {}
    const db = getDb()
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
    if (!user) return res.status(404).json({ message: 'User not found' })
    if (!user.sso_provider || !user.sso_id) return res.status(400).json({ message: 'Sessions not available for non-SSO accounts' })

    if (all) {
      // Logout all sessions
      try {
        const r = await callKeycloakAdmin(`/users/${encodeURIComponent(user.sso_id)}/logout`, { method: 'POST' })
        if (!r.ok) {
          const text = await r.text()
          console.error('Keycloak logout-all failed:', r.status, text)
          return res.status(502).json({ message: 'Failed to logout user sessions via SSO provider' })
        }
        // Remove local metadata for this user
        try { db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(user.id) } catch (e) { /* ignore */ }
        // Invalidate any tokens issued before now
        try { db.prepare('UPDATE users SET tokens_invalid_before = CURRENT_TIMESTAMP WHERE id = ?').run(user.id) } catch (e) { /* ignore */ }
        return res.json({ message: 'All sessions revoked' })
      } catch (err) {
        console.error('Logout all sessions error:', err)
        return res.status(500).json({ message: 'Failed to revoke sessions' })
      }
    }

    if (sessionId) {
      // Best-effort attempt to remove a single session. Keycloak does not provide a simple
      // documented single session delete across all versions, but newer versions have
      // /sessions/{session} endpoint. We'll attempt it and return a helpful message on failure.
      try {
        const r = await callKeycloakAdmin(`/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' })
        if (r.ok) {
          // remove local metadata if present
          try { db.prepare('DELETE FROM user_sessions WHERE session_id = ?').run(sessionId) } catch (e) { /* ignore */ }
          return res.json({ message: 'Session revoked' })
        }
        if (r.status === 404) {
          return res.status(501).json({ message: 'Single-session revocation not supported by this SSO server version' })
        }
        const text = await r.text()
        console.error('Keycloak revoke session failed:', r.status, text)
        return res.status(502).json({ message: 'Failed to revoke session via SSO provider' })
      } catch (err) {
        console.error('Revoke session error:', err)
        return res.status(500).json({ message: 'Failed to revoke session' })
      }
    }

    return res.status(400).json({ message: 'Invalid request: provide { all: true } or { sessionId }' })
  } catch (err) {
    console.error('Revoke sessions error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get security preferences for current user (e.g., require_reauth)
router.get('/security', authenticateToken, (req, res) => {
  try {
    const db = getDb()
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json({ requireReauth: Boolean(user.require_reauth) })
  } catch (err) {
    console.error('Get security settings error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

// Update security preferences for current user
router.put('/security', authenticateToken, (req, res) => {
  try {
    const { requireReauth } = req.body
    const db = getDb()
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
    if (!user) return res.status(404).json({ message: 'User not found' })
    const flag = requireReauth ? 1 : 0
    db.prepare('UPDATE users SET require_reauth = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(flag, req.user.id)
    res.json({ requireReauth: Boolean(flag) })
  } catch (err) {
    console.error('Update security settings error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

export default router
