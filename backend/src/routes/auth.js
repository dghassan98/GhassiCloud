import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { getDb } from '../db/index.js'
import { authenticateToken, generateToken } from '../middleware/auth.js'
import { logAuditEvent, getClientIp, AUDIT_ACTIONS, AUDIT_CATEGORIES } from './audit.js'

const router = Router()

// Keycloak SSO Configuration
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'https://auth.ghassi.cloud'
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

    // Log SSO config update
    logAuditEvent({
      userId: req.user.id,
      username: req.user.username,
      action: AUDIT_ACTIONS.SSO_CONFIG_UPDATED,
      category: AUDIT_CATEGORIES.SETTINGS,
      resourceType: 'sso_config',
      details: { clientId },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      status: 'success'
    })

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
    
    // Log SSO config reset
    logAuditEvent({
      userId: req.user.id,
      username: req.user.username,
      action: AUDIT_ACTIONS.SSO_CONFIG_RESET,
      category: AUDIT_CATEGORIES.SETTINGS,
      resourceType: 'sso_config',
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      status: 'success'
    })
    
    const cfg = await readSSOConfig()
    res.json(cfg)
  } catch (err) {
    console.error('Reset SSO config error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

// Exchange authorization code for tokens and create/login user (PKCE flow)
function normalizeIp(ip) {
  if (!ip) return null
  let s = String(ip).trim()
  if (!s) return null

  // If header contains a list (e.g., X-Forwarded-For), take the first value
  if (s.includes(',')) s = s.split(',')[0].trim()

  // Handle [IPv6]:port format - extract IPv6 and optionally strip port
  const bracketMatch = s.match(/^\[([^\]]+)\](?::(\d+))?$/)
  if (bracketMatch) {
    s = bracketMatch[1] // Extract IPv6 from brackets
  }

  // Strip IPv6 zone identifiers (fe80::1%eth0)
  const pct = s.indexOf('%')
  if (pct !== -1) s = s.slice(0, pct)

  // Convert IPv4-mapped IPv6 to IPv4 (e.g., ::ffff:127.0.0.1)
  const mapped = s.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/i)
  if (mapped) s = mapped[1]

  // Only strip port for IPv4 addresses (x.x.x.x:port format)
  // IPv6 addresses contain colons as part of the address, so we can't use lastColon logic
  // IPv6 with port should use [IPv6]:port format which is handled above
  const ipv4WithPort = s.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d+)$/)
  if (ipv4WithPort) {
    s = ipv4WithPort[1]
  }

  s = s.trim()
  if (!s) return null
  // Treat values that are only punctuation (e.g., ":") as invalid
  if (/^[^\w\d\.\:]+$/.test(s)) return null
  return s.toLowerCase()
}

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
    let sessionId = tokens.session_state || tokens.sessionId || tokens.session || null
    try {
      // token response may include session_state or similar identifier
      const rawIp = req.ip || (req.headers && (req.headers['x-forwarded-for'] || req.connection?.remoteAddress)) || null
      const ip = normalizeIp(rawIp)
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

    // Generate our own JWT token and include the SSO session id when available
    const token = generateToken(user, sessionId || null)

    // Log SSO login
    const ssoIp = getClientIp(req)
    logAuditEvent({
      userId: user.id,
      username: user.username,
      action: AUDIT_ACTIONS.SSO_LOGIN,
      category: AUDIT_CATEGORIES.AUTH,
      details: { provider: 'keycloak', email: userInfo.email },
      ipAddress: ssoIp,
      userAgent: req.headers?.['user-agent'],
      status: 'success'
    })

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
    const ipAddress = getClientIp(req)
    const userAgent = req.headers['user-agent']

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' })
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)

    if (!user) {
      // Log failed login attempt
      logAuditEvent({
        username,
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        category: AUDIT_CATEGORIES.AUTH,
        details: { reason: 'User not found' },
        ipAddress,
        userAgent,
        status: 'failure'
      })
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const validPassword = bcrypt.compareSync(password, user.password)

    if (!validPassword) {
      // Log failed login attempt
      logAuditEvent({
        userId: user.id,
        username: user.username,
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        category: AUDIT_CATEGORIES.AUTH,
        details: { reason: 'Invalid password' },
        ipAddress,
        userAgent,
        status: 'failure'
      })
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const token = generateToken(user)

    // Log successful login
    logAuditEvent({
      userId: user.id,
      username: user.username,
      action: AUDIT_ACTIONS.LOGIN,
      category: AUDIT_CATEGORIES.AUTH,
      details: { method: 'password' },
      ipAddress,
      userAgent,
      status: 'success'
    })

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
      // Log failed password change attempt
      logAuditEvent({
        userId: user.id,
        username: user.username,
        action: AUDIT_ACTIONS.PASSWORD_CHANGED,
        category: AUDIT_CATEGORIES.SECURITY,
        details: { reason: 'Invalid current password' },
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        status: 'failure'
      })
      return res.status(401).json({ message: 'Current password is incorrect' })
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10)

    db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(hashedPassword, req.user.id)

    // Log successful password change
    logAuditEvent({
      userId: user.id,
      username: user.username,
      action: AUDIT_ACTIONS.PASSWORD_CHANGED,
      category: AUDIT_CATEGORIES.SECURITY,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      status: 'success'
    })

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

    // Log profile update
    logAuditEvent({
      userId: updated.id,
      username: updated.username,
      action: AUDIT_ACTIONS.PROFILE_UPDATED,
      category: AUDIT_CATEGORIES.USER,
      details: { 
        changes: {
          email: email !== user.email ? email : undefined,
          displayName: displayName !== user.display_name ? displayName : undefined,
          firstName: firstName !== user.first_name ? firstName : undefined,
          lastName: lastName !== user.last_name ? lastName : undefined,
          language: language !== user.language ? language : undefined
        }
      },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      status: 'success'
    })

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

// Simple client name resolver with in-memory cache
const _kcClientCache = { mapById: new Map(), mapByClientId: new Map(), expiresAt: 0 }
async function resolveKeycloakClientName(key) {
  if (!key) return null
  // refresh cache every 60s
  const now = Date.now()
  if (now > _kcClientCache.expiresAt) {
    _kcClientCache.mapById.clear()
    _kcClientCache.mapByClientId.clear()
    _kcClientCache.expiresAt = now + 60 * 1000
  }

  // check caches
  if (_kcClientCache.mapById.has(key)) return _kcClientCache.mapById.get(key)
  if (_kcClientCache.mapByClientId.has(key)) return _kcClientCache.mapByClientId.get(key)

  try {
    // Try treat key as UUID
    let r = await callKeycloakAdmin(`/clients/${encodeURIComponent(key)}`, { method: 'GET' })
    if (r.ok) {
      const j = await r.json()
      // Prefer the admin 'name' (display name) if available, otherwise fall back to clientId
      const name = j.name || j.clientId || key
      _kcClientCache.mapById.set(key, name)
      if (j.id) _kcClientCache.mapById.set(j.id, name)
      if (j.clientId) _kcClientCache.mapByClientId.set(j.clientId, name)
      return name
    }
  } catch (e) {
    // ignore and fallback
  }

  try {
    // Try search by clientId
    const q = `?clientId=${encodeURIComponent(key)}`
    const r2 = await callKeycloakAdmin(`/clients${q}`, { method: 'GET' })
    if (r2.ok) {
      const arr = await r2.json()
      if (Array.isArray(arr) && arr.length > 0) {
        const j = arr[0]
        // Prefer display name when present
        const name = j.name || j.clientId || key
        _kcClientCache.mapByClientId.set(key, name)
        if (j.id) _kcClientCache.mapById.set(j.id, name)
        return name
      }
    }
  } catch (e) {
    // ignore
  }

  // unresolved
  return null
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
      const currentIpRaw = (req.headers && (req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.headers['x-forwarded-host']))
        ? ((req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim())
        : (req.ip || (req.connection && req.connection.remoteAddress) || null)
      const currentIp = normalizeIp(currentIpRaw)
      const currentUA = req.headers && req.headers['user-agent'] ? req.headers['user-agent'] : ''

      // Resolve client display names for better UX
      const uniqueClients = new Set()
      kcSessions.forEach(k => { const candidate = k.client || k.clientId || (localMap.get(k.id) && localMap.get(k.id).client_id); if (candidate) uniqueClients.add(candidate) })
      const clientDisplay = {}
      await Promise.all(Array.from(uniqueClients).map(async (c) => {
        try {
          const resolved = await resolveKeycloakClientName(c)
          if (resolved) clientDisplay[c] = resolved
        } catch (e) { /* ignore */ }
      }))

      const merged = kcSessions.map(k => {
        const matching = localMap.get(k.id)
        const ipAddr = normalizeIp(k.ipAddress) || normalizeIp(k.clientAddress) || normalizeIp(matching && matching.ip) || null
        const ua = matching ? matching.user_agent : null
        const rawClient = k.client || k.clientId || (matching && matching.client_id) || null
        const clientId = clientDisplay[rawClient] || rawClient || null
        const lastAccess = k.lastAccess || null
        const createdAt = matching ? matching.created_at : null

        // Heuristic: current session if sessionId matches this token OR IP and UA match (or UA contains matching snippet)
        let isCurrent = false
        try {
          if (req.user && req.user.sessionId && req.user.sessionId === k.id) {
            isCurrent = true
          }

          if (!isCurrent && ipAddr && currentIp && ipAddr === currentIp) {
            if (!ua || !currentUA) isCurrent = true
            else if (currentUA === ua || currentUA.includes(ua) || ua.includes(currentUA.substring(0, 30))) isCurrent = true
          }
        } catch (e) {
          // ignore
        }

        // Risk flags
        const risk = []
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
          rawClientId: rawClient,
          start: k.start || null,
          lastAccess,
          userAgent: ua,
          createdAt,
          local: !!matching,
          isCurrent,
          risk
        }
      })

      // Clean up stale local sessions that no longer exist in Keycloak
      const validSessionIds = new Set(kcSessions.map(k => k.id))
      const staleSessions = local.filter(l => !validSessionIds.has(l.session_id))
      
      if (staleSessions.length > 0) {
        try {
          const staleIds = staleSessions.map(s => s.session_id)
          db.prepare(`DELETE FROM user_sessions WHERE session_id IN (${staleIds.map(() => '?').join(',')})`).run(...staleIds)
          console.log(`Cleaned up ${staleSessions.length} stale session(s) for user ${user.id}`)
        } catch (cleanupErr) {
          console.warn('Failed to cleanup stale sessions:', cleanupErr)
        }
      }

      // Only filter invalid/empty sessions from the response
      const validMerged = merged.filter(s => s.ipAddress && s.ipAddress !== ':' && s.ipAddress !== '')

      return res.json({ sessions: validMerged })
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
        // Mark tokens invalid before now so existing JWTs cannot be used
        try {
          db.prepare('UPDATE users SET tokens_invalid_before = CURRENT_TIMESTAMP WHERE id = ?').run(user.id)
        } catch (e) {
          console.warn('Failed to set tokens_invalid_before for user:', e)
        }
        // Remove local metadata for this user
        try { db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(user.id) } catch (e) { /* ignore */ }
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

// Get all users (Admin only)
router.get('/users', authenticateToken, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' })
    }

    const db = getDb()
    const users = db.prepare(`
      SELECT id, username, email, display_name, first_name, last_name, 
             role, avatar, sso_provider, created_at 
      FROM users 
      ORDER BY created_at DESC
    `).all()

    // Fix timestamps to include timezone indicator
    const usersWithFixedTimestamps = users.map(user => ({
      ...user,
      created_at: user.created_at ? (user.created_at.endsWith('Z') ? user.created_at : user.created_at + 'Z') : user.created_at
    }))

    res.json({ users: usersWithFixedTimestamps })
  } catch (err) {
    console.error('Fetch users error:', err)
    res.status(500).json({ message: 'Failed to fetch users' })
  }
})

// Update user role (Admin only)
router.patch('/users/:userId/role', authenticateToken, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' })
    }

    const { userId } = req.params
    const { role } = req.body

    if (!role || !['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be "user" or "admin"' })
    }

    // Prevent self-demotion
    if (parseInt(userId) === req.user.id && role !== 'admin') {
      return res.status(400).json({ message: 'Cannot change your own role' })
    }

    const db = getDb()
    const targetUser = db.prepare('SELECT username FROM users WHERE id = ?').get(userId)
    
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' })
    }

    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId)

    // Log role change
    logAuditEvent({
      userId: req.user.id,
      username: req.user.username,
      action: AUDIT_ACTIONS.USER_ROLE_CHANGED,
      category: AUDIT_CATEGORIES.USER_MANAGEMENT,
      resourceType: 'user',
      resourceId: userId,
      resourceName: targetUser.username,
      details: { newRole: role },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      status: 'success'
    })

    res.json({ message: 'User role updated successfully' })
  } catch (err) {
    console.error('Update user role error:', err)
    res.status(500).json({ message: 'Failed to update user role' })
  }
})

// Delete user (Admin only)
router.delete('/users/:userId', authenticateToken, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' })
    }

    const { userId } = req.params

    // Prevent self-deletion
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' })
    }

    const db = getDb()
    const targetUser = db.prepare('SELECT username FROM users WHERE id = ?').get(userId)
    
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' })
    }

    // Delete user and related data
    db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM users WHERE id = ?').run(userId)

    // Log user deletion
    logAuditEvent({
      userId: req.user.id,
      username: req.user.username,
      action: AUDIT_ACTIONS.USER_DELETED,
      category: AUDIT_CATEGORIES.USER_MANAGEMENT,
      resourceType: 'user',
      resourceId: userId,
      resourceName: targetUser.username,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      status: 'success'
    })

    res.json({ message: 'User deleted successfully' })
  } catch (err) {
    console.error('Delete user error:', err)
    res.status(500).json({ message: 'Failed to delete user' })
  }
})

// Front-channel logout endpoint for SSO providers (Keycloak frontchannel logout can redirect here)
// Example GET: /api/auth/sso/frontchannel-logout?session_state=<sessionId>
// This will attempt to revoke the local session metadata for the provided session id and mark tokens invalid for the user.
router.get('/sso/frontchannel-logout', async (req, res) => {
  try {
    const sessionId = req.query.session_state || req.query.session || req.query.sid || null
    if (!sessionId) {
      return res.status(400).send('Missing session identifier')
    }

    const db = getDb()
    const row = db.prepare('SELECT user_id FROM user_sessions WHERE session_id = ?').get(sessionId)
    if (!row || !row.user_id) {
      // Unknown session — respond success to avoid revealing info
      console.warn('Frontchannel logout received unknown session:', sessionId)
      return res.status(200).send('Ok')
    }

    const userId = row.user_id

    // Remove the session metadata
    try {
      db.prepare('DELETE FROM user_sessions WHERE session_id = ?').run(sessionId)
    } catch (e) {
      console.warn('Failed to delete user_session for frontchannel logout:', e)
    }

    // Mark tokens invalid before now so existing JWTs are rejected
    try {
      db.prepare('UPDATE users SET tokens_invalid_before = CURRENT_TIMESTAMP WHERE id = ?').run(userId)
    } catch (e) {
      console.warn('Failed to set tokens_invalid_before during frontchannel logout:', e)
    }

    console.info('Frontchannel logout processed for session:', sessionId)
    return res.status(200).send('Ok')
  } catch (err) {
    console.error('Frontchannel logout handler error:', err)
    return res.status(500).send('Server error')
  }
})

// SSO Session validation endpoint - checks if the user's SSO session is still active
// This uses Keycloak's userinfo endpoint as a lightweight session check
// Returns: { valid: true/false, expiresIn?: number (seconds), canRefresh?: boolean }
router.get('/sso/validate', authenticateToken, async (req, res) => {
  try {
    const db = getDb()
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
    
    if (!user) {
      return res.status(404).json({ valid: false, message: 'User not found' })
    }
    
    // For non-SSO users, always return valid (they use local auth)
    if (!user.sso_provider || !user.sso_id) {
      return res.json({ valid: true, ssoUser: false })
    }
    
    // Check if we have a session ID in the JWT
    const sessionId = req.user.sessionId
    if (!sessionId) {
      // No session ID means we can't validate with Keycloak directly
      // Fall back to checking if the session exists in our local DB
      return res.json({ valid: true, ssoUser: true, sessionId: null })
    }
    
    try {
      // Check if the session still exists in Keycloak
      const sessionsRes = await callKeycloakAdmin(`/users/${encodeURIComponent(user.sso_id)}/sessions`, { method: 'GET' })
      
      if (!sessionsRes.ok) {
        // If we can't reach Keycloak, assume session is valid to avoid false logouts
        console.warn('SSO validate: Could not reach Keycloak, assuming valid')
        return res.json({ valid: true, ssoUser: true, checkFailed: true })
      }
      
      const sessions = await sessionsRes.json()
      const currentSession = sessions.find(s => s.id === sessionId)
      
      if (!currentSession) {
        // Session no longer exists in Keycloak - user should be logged out
        return res.json({ valid: false, ssoUser: true, reason: 'session_expired' })
      }
      
      // Calculate time until session expires (if lastAccess available)
      let expiresIn = null
      if (currentSession.lastAccess) {
        // Keycloak default SSO session idle is 30 minutes
        const ssoIdleTimeout = parseInt(process.env.KEYCLOAK_SSO_IDLE_TIMEOUT) || 1800 // 30 min default
        const lastAccess = new Date(currentSession.lastAccess).getTime()
        const expiresAt = lastAccess + (ssoIdleTimeout * 1000)
        expiresIn = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
      }
      
      return res.json({ 
        valid: true, 
        ssoUser: true, 
        sessionId,
        expiresIn,
        lastAccess: currentSession.lastAccess || null
      })
    } catch (kcErr) {
      console.error('SSO validate Keycloak error:', kcErr)
      // Don't fail the user if Keycloak is temporarily unreachable
      return res.json({ valid: true, ssoUser: true, checkFailed: true })
    }
  } catch (err) {
    console.error('SSO validate error:', err)
    res.status(500).json({ valid: false, message: 'Validation failed' })
  }
})

// SSO Token refresh endpoint - attempts to refresh the SSO session using silent auth
// This initiates a redirect flow that the frontend handles in an iframe
router.get('/sso/refresh-config', authenticateToken, async (req, res) => {
  try {
    const db = getDb()
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
    
    if (!user || !user.sso_provider) {
      return res.status(400).json({ message: 'Not an SSO user' })
    }
    
    // Return the config needed for silent refresh
    const cfg = await readSSOConfig()
    
    res.json({
      authUrl: cfg.authUrl,
      clientId: cfg.clientId,
      scope: cfg.scope,
      // Keycloak supports prompt=none for silent auth
      silentCheckSsoRedirectUri: `${req.protocol}://${req.get('host')}/sso-callback`
    })
  } catch (err) {
    console.error('SSO refresh config error:', err)
    res.status(500).json({ message: 'Failed to get refresh config' })
  }
})

// Avatar proxy endpoint to bypass CORS and rate limiting issues with external avatar URLs
router.get('/avatar-proxy', async (req, res) => {
  try {
    const { url } = req.query
    if (!url) {
      return res.status(400).json({ message: 'URL parameter required' })
    }

    // Only allow specific domains to prevent abuse
    const allowedDomains = ['lh3.googleusercontent.com', 'graph.microsoft.com', 'avatars.githubusercontent.com']
    try {
      const urlObj = new URL(url)
      if (!allowedDomains.some(domain => urlObj.hostname.includes(domain))) {
        return res.status(403).json({ message: 'Domain not allowed' })
      }
    } catch (e) {
      return res.status(400).json({ message: 'Invalid URL' })
    }

    // Fetch the image with a short timeout
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'GhassiCloud/1.0'
      }
    })
    clearTimeout(timeout)

    if (!response.ok) {
      return res.status(response.status).json({ message: 'Failed to fetch avatar' })
    }

    // Set caching headers to reduce requests
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg')
    
    // Stream the image
    const buffer = await response.arrayBuffer()
    res.send(Buffer.from(buffer))
  } catch (err) {
    console.error('Avatar proxy error:', err)
    res.status(500).json({ message: 'Failed to proxy avatar' })
  }
})

// IP Geolocation endpoint - returns lat/lng/city/country for an IP address
// Uses ip-api.com free tier (limited to 45 requests/minute)
const geoCache = new Map()
const GEO_CACHE_TTL = 1000 * 60 * 60 * 24 // 24 hours

// Helper function to get geolocation for an IP
async function getIpGeolocation(ip) {
  // Validate IP format (supports both IPv4 and IPv6)
  if (!ip) return { error: 'No IP provided' }
  
  // More permissive regex for IPv6 (allows colons, dots, hex chars)
  if (!/^[\d.:a-fA-F]+$/.test(ip)) {
    return { error: 'Invalid IP address format' }
  }
  
  // Check if it's a private/local IP (more comprehensive check)
  const isPrivateIP = ip === '127.0.0.1' || 
                      ip === '::1' || 
                      ip === 'localhost' ||
                      ip.startsWith('192.168.') || 
                      ip.startsWith('10.') || 
                      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) ||
                      ip.startsWith('169.254.') ||  // Link-local
                      ip.startsWith('fc') ||        // IPv6 ULA
                      ip.startsWith('fd') ||        // IPv6 ULA
                      ip.startsWith('fe80') ||      // IPv6 link-local
                      ip.startsWith('::ffff:127.') || // IPv4-mapped loopback
                      ip.startsWith('::ffff:192.168.') || // IPv4-mapped private
                      ip.startsWith('::ffff:10.') // IPv4-mapped private
  
  if (isPrivateIP) {
    return { lat: null, lon: null, city: 'Local Network', country: null, private: true }
  }
  
  // Check cache
  const cached = geoCache.get(ip)
  if (cached && Date.now() - cached.timestamp < GEO_CACHE_TTL) {
    return cached.data
  }
  
  try {
    // Fetch from ip-api.com (free, no API key needed, 45 req/min limit)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    
    const response = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,city,lat,lon`, {
      signal: controller.signal
    })
    clearTimeout(timeout)
    
    if (!response.ok) {
      return { error: 'Geolocation service unavailable' }
    }
    
    const data = await response.json()
    
    if (data.status === 'fail') {
      return { lat: null, lon: null, city: null, country: null, error: data.message }
    }
    
    const result = {
      lat: data.lat,
      lon: data.lon,
      city: data.city,
      country: data.country
    }
    
    // Cache the result
    geoCache.set(ip, { timestamp: Date.now(), data: result })
    
    return result
  } catch (err) {
    console.error('IP geolocation fetch error:', err)
    return { error: 'Failed to fetch geolocation' }
  }
}

// Query parameter version (better for IPv6)
router.get('/ip-geo', authenticateToken, async (req, res) => {
  try {
    const rawIp = req.query.ip
    if (!rawIp) {
      return res.status(400).json({ message: 'IP address required' })
    }
    
    // Normalize the IP address (handles brackets, zone IDs, ports, etc.)
    const ip = normalizeIp(rawIp)
    if (!ip) {
      return res.status(400).json({ message: 'Invalid IP address format' })
    }
    
    const result = await getIpGeolocation(ip)
    if (result.error && !result.lat && result.lat !== null) {
      return res.status(400).json({ message: result.error })
    }
    
    res.json(result)
  } catch (err) {
    console.error('IP geolocation error:', err)
    res.status(500).json({ message: 'Failed to fetch geolocation' })
  }
})

// Route parameter version (kept for backwards compatibility, may have issues with IPv6)
router.get('/ip-geo/:ip', authenticateToken, async (req, res) => {
  try {
    const rawIp = req.params.ip
    
    if (!rawIp) {
      return res.status(400).json({ message: 'Invalid IP address' })
    }
    
    // Normalize the IP address
    const ip = normalizeIp(rawIp)
    if (!ip) {
      return res.status(400).json({ message: 'Invalid IP address format' })
    }
    
    const result = await getIpGeolocation(ip)
    if (result.error && !result.lat && result.lat !== null) {
      return res.status(400).json({ message: result.error })
    }
    
    res.json(result)
  } catch (err) {
    console.error('IP geolocation error:', err)
    res.status(500).json({ message: 'Failed to fetch geolocation' })
  }
})

// Static map proxy endpoint - generates a map image for given coordinates
// Uses OpenStreetMap tiles directly
const mapCache = new Map()
const MAP_CACHE_TTL = 1000 * 60 * 60 * 24 * 7 // 7 days

// Convert lat/lon to tile coordinates
function latLonToTile(lat, lon, zoom) {
  const n = Math.pow(2, zoom)
  const x = Math.floor((lon + 180) / 360 * n)
  const latRad = lat * Math.PI / 180
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n)
  return { x, y }
}

router.get('/static-map', async (req, res) => {
  try {
    const { lat, lon } = req.query
    
    if (!lat || !lon || isNaN(parseFloat(lat)) || isNaN(parseFloat(lon))) {
      return res.status(400).json({ message: 'Invalid coordinates' })
    }
    
    const latitude = parseFloat(lat)
    const longitude = parseFloat(lon)
    const zoom = 10
    const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`
    
    // Check cache
    const cached = mapCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < MAP_CACHE_TTL) {
      res.setHeader('Content-Type', 'image/png')
      res.setHeader('Cache-Control', 'public, max-age=604800')
      return res.send(cached.data)
    }
    
    // Get tile coordinates
    const { x, y } = latLonToTile(latitude, longitude, zoom)
    
    // Fetch OSM tile directly (always available, no API key needed)
    const tileUrl = `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`
    
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    
    const response = await fetch(tileUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'GhassiCloud/1.0 (https://ghassi.cloud)'
      }
    })
    clearTimeout(timeout)
    
    if (!response.ok) {
      console.error('OSM tile fetch failed:', response.status)
      return res.status(502).json({ message: 'Map service unavailable' })
    }
    
    const buffer = Buffer.from(await response.arrayBuffer())
    
    // Cache the result
    mapCache.set(cacheKey, { timestamp: Date.now(), data: buffer })
    
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=604800')
    res.send(buffer)
  } catch (err) {
    console.error('Static map error:', err)
    res.status(500).json({ message: 'Failed to generate map' })
  }
})

export default router
