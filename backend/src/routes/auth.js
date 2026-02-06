import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { getDb } from '../db/index.js'
import { authenticateToken, generateToken } from '../middleware/auth.js'
import { logAuditEvent, getClientIp, AUDIT_ACTIONS, AUDIT_CATEGORIES } from './audit.js'
import logger from '../logger.js'
import fs from 'fs/promises'
import path from 'path'

const router = Router()

// Keycloak SSO Configuration
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'https://auth.ghassi.cloud'
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'master'
const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'ghassicloud'



const SSO_CONFIG_FILE = path.resolve('backend', 'data', 'sso-config.json')

async function readSSOConfig() {
  try {
    const raw = await fs.readFile(SSO_CONFIG_FILE, 'utf8')
    const json = JSON.parse(raw)
    return json
  } catch (e) {
    return {
      authUrl: `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/auth`,
      clientId: KEYCLOAK_CLIENT_ID,
      scope: 'openid profile email'
    }
  }
}

async function writeSSOConfig(cfg) {
  try {
    await fs.mkdir(path.dirname(SSO_CONFIG_FILE), { recursive: true })
    await fs.writeFile(SSO_CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8')
    return true
  } catch (e) {
    logger.error('Failed to write SSO config file:', e)
    return false
  }
}

router.get('/sso/config', async (req, res) => {
  try {
    const cfg = await readSSOConfig()
    res.json(cfg)
  } catch (err) {
    logger.error('Error reading SSO config:', err)
    res.status(500).json({ message: 'Failed to read SSO configuration' })
  }
})

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
    logger.error('Update SSO config error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

router.delete('/sso/config', authenticateToken, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' })
    }
    try {
      await fs.unlink(SSO_CONFIG_FILE)
    } catch (e) {
      logger.warn('SSO config file delete warning (may not exist):', e)
    }

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
    logger.error('Reset SSO config error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

// Helper to normalize IP address strings, removing ports and extraneous data - built with AI
function normalizeIp(ip) {
  if (!ip) return null
  let s = String(ip).trim()
  if (!s) return null
  if (s.includes(',')) s = s.split(',')[0].trim()

  const bracketMatch = s.match(/^\[([^\]]+)\](?::(\d+))?$/)
  if (bracketMatch) {
    s = bracketMatch[1]
  }

  const pct = s.indexOf('%')
  if (pct !== -1) s = s.slice(0, pct)

  const mapped = s.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/i)
  if (mapped) s = mapped[1]

  const ipv4WithPort = s.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d+)$/)
  if (ipv4WithPort) {
    s = ipv4WithPort[1]
  }

  s = s.trim()
  if (!s) return null
  if (/^[^\w\d\.\:]+$/.test(s)) return null
  return s.toLowerCase()
}

router.post('/sso/callback', async (req, res) => {
  try {
    const { code, redirectUri, codeVerifier } = req.body

    logger.info({ hasCode: !!code, redirectUri, codeVerifierLength: codeVerifier?.length }, 'SSO callback received')

    if (!code) {
      return res.status(400).json({ message: 'Authorization code required' })
    }

    if (!codeVerifier) {
      return res.status(400).json({ message: 'Code verifier required for PKCE' })
    }

    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: KEYCLOAK_CLIENT_ID,
      code: code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    })

    logger.info({ tokenEndpoint: `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token` }, 'Requesting token from')

    const tokenResponse = await fetch(
      `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams
      }
    )

    const tokenResponseText = await tokenResponse.text()
    logger.info({ status: tokenResponse.status }, 'Token response status')

    if (!tokenResponse.ok) {
      logger.error('Token exchange failed:', tokenResponseText)
      return res.status(401).json({ message: 'Failed to exchange authorization code', details: tokenResponseText })
    }

    let tokens
    try {
      tokens = JSON.parse(tokenResponseText)
    } catch (e) {
      logger.error('Failed to parse token response:', tokenResponseText)
      return res.status(500).json({ message: 'Invalid token response from auth server' })
    }

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

    const db = getDb()
    let user = db.prepare('SELECT * FROM users WHERE email = ? OR username = ?').get(
      userInfo.email,
      userInfo.preferred_username || userInfo.email
    )

    let sessionId = tokens.session_state || tokens.sessionId || tokens.session || null
    try {
      const rawIp = req.ip || (req.headers && (req.headers['x-forwarded-for'] || req.connection?.remoteAddress)) || null
      const ip = normalizeIp(rawIp)
      const userAgent = req.headers?.['user-agent'] || ''

      if (sessionId) {
        try {
          db.prepare(`INSERT OR REPLACE INTO user_sessions (session_id, user_id, client_id, ip, user_agent, last_seen) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`)
            .run(sessionId, user && user.id ? user.id : 'unknown', KEYCLOAK_CLIENT_ID, ip, userAgent)
        } catch (e) {
          logger.warn('Failed to persist SSO session metadata:', e)
        }
      }

    } catch (e) {
      logger.error('Error processing SSO session metadata:', e)
    }

    // Create new user from SSO
    if (!user) {
      const userId = crypto.randomUUID()
      const username = userInfo.preferred_username || userInfo.email.split('@')[0]
      // Generate a random placeholder password for SSO users
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
      if (userInfo.picture && user.avatar !== userInfo.picture) updates.avatar = userInfo.picture
      if (!user.language && (userInfo.locale || userInfo.preferred_locale || userInfo.lang)) updates.language = userInfo.locale || userInfo.preferred_locale || userInfo.lang

      if (Object.keys(updates).length > 0) {
        const params = []
        const sets = []
        Object.entries(updates).forEach(([k, v]) => { sets.push(`${k} = ?`); params.push(v) })
        params.push(user.id)
        db.prepare(`UPDATE users SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...params)
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)
      }
    }

    const token = generateToken(user, sessionId || null)

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
    logger.error('SSO callback error:', err)
    res.status(500).json({ message: 'SSO authentication failed' })
  }
})

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body
    const db = getDb()
    const ipAddress = getClientIp(req)
    const userAgent = req.headers['user-agent']

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' })
    }

    let user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)

    let authenticated = false
    let keycloakTokens = null
    let keycloakUserInfo = null

    const parseBool = (v) => {
      if (typeof v === 'string') return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())
      return Boolean(v)
    }

    const keycloakConfigured = !!(KEYCLOAK_URL && KEYCLOAK_CLIENT_ID && KEYCLOAK_REALM)
    logger.info({ keycloakConfigured: keycloakConfigured, keycloakUrlPresent: !!KEYCLOAK_URL, keycloakClientIdPresent: !!KEYCLOAK_CLIENT_ID }, '[AUTH] Keycloak configured')

    if (keycloakConfigured) {
      try {
        const tokenParams = new URLSearchParams({
          grant_type: 'password',
          client_id: KEYCLOAK_CLIENT_ID,
          username: username,
          password: password,
        })

        if (process.env.KEYCLOAK_CLIENT_SECRET) tokenParams.set('client_secret', process.env.KEYCLOAK_CLIENT_SECRET)
        tokenParams.set('scope', 'openid profile email')

        logger.info({ username, tokenEndpoint: `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token` }, '[AUTH] Attempting Keycloak password grant')

        const tokenRes = await fetch(
          `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenParams
          }
        )

        const tokenText = await tokenRes.text()
        logger.info({ status: tokenRes.status, bodyPreview: tokenText && tokenText.substring ? tokenText.substring(0, 200) : tokenText }, '[AUTH] Keycloak token response')

        if (tokenRes.ok) {
          try {
            keycloakTokens = JSON.parse(tokenText)
          } catch (e) {
            logger.error('Failed to parse Keycloak token response (password grant):', tokenText)
          }
        } else {
          logger.info({ username }, '[AUTH] Keycloak password grant rejected credentials for user')
          const debugEnabled = parseBool(process.env.DEBUG_KEYCLOAK)
          if (debugEnabled) return res.status(401).json({ message: 'Invalid credentials', debug: { keycloakStatus: tokenRes.status, keycloakBody: tokenText } })
          return res.status(401).json({ message: 'Invalid credentials' })
        }

        if (keycloakTokens && keycloakTokens.access_token) {
          const uiRes = await fetch(
            `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/userinfo`,
            {
              headers: { Authorization: `Bearer ${keycloakTokens.access_token}` }
            }
          )

          const uiText = await uiRes.text()
          if (uiRes.ok) {
            try {
              keycloakUserInfo = JSON.parse(uiText)
            } catch (e) {
              logger.error('Failed to parse Keycloak userinfo response:', uiText)
            }
          } else {
            logger.warn('Failed to fetch userinfo from Keycloak after password grant, status:', uiRes.status, 'bodyPreview:', uiText.substring ? uiText.substring(0, 200) : uiText)
          }
        }
      } catch (e) {
        logger.error('Keycloak direct auth attempt failed:', e)
      }

      if (keycloakUserInfo && keycloakUserInfo.email) {
        let found = db.prepare('SELECT * FROM users WHERE email = ? OR username = ?').get(
          keycloakUserInfo.email,
          keycloakUserInfo.preferred_username || keycloakUserInfo.email
        )

        if (!found) {
          const userId = crypto.randomUUID()
          const usernameCandidate = keycloakUserInfo.preferred_username || (keycloakUserInfo.email && keycloakUserInfo.email.split('@')[0])
          const randomPassword = bcrypt.hashSync(crypto.randomUUID(), 10)

          db.prepare(`
            INSERT INTO users (id, username, password, email, display_name, role, sso_provider, sso_id, first_name, last_name, avatar, language)
            VALUES (?, ?, ?, ?, ?, 'user', 'keycloak', ?, ?, ?, ?, ?)
          `).run(
            userId,
            usernameCandidate,
            randomPassword,
            keycloakUserInfo.email,
            keycloakUserInfo.name || keycloakUserInfo.preferred_username,
            keycloakUserInfo.sub,
            keycloakUserInfo.given_name || null,
            keycloakUserInfo.family_name || null,
            keycloakUserInfo.picture || null,
            keycloakUserInfo.locale || keycloakUserInfo.preferred_locale || null
          )

          found = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
        } else {
          const updates = {}
          if (!found.sso_provider) {
            updates.sso_provider = 'keycloak'
            updates.sso_id = keycloakUserInfo.sub
          }
          if (!found.first_name && keycloakUserInfo.given_name) updates.first_name = keycloakUserInfo.given_name
          if (!found.last_name && keycloakUserInfo.family_name) updates.last_name = keycloakUserInfo.family_name
          if (keycloakUserInfo.picture && found.avatar !== keycloakUserInfo.picture) updates.avatar = keycloakUserInfo.picture
          if (!found.language && (keycloakUserInfo.locale || keycloakUserInfo.preferred_locale)) updates.language = keycloakUserInfo.locale || keycloakUserInfo.preferred_locale

          if (Object.keys(updates).length > 0) {
            const params = []
            const sets = []
            Object.entries(updates).forEach(([k, v]) => { sets.push(`${k} = ?`); params.push(v) })
            params.push(found.id)
            db.prepare(`UPDATE users SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...params)
            found = db.prepare('SELECT * FROM users WHERE id = ?').get(found.id)
          }
        }

        user = found
        authenticated = true
      } else {
        if (!keycloakUserInfo) {
          logger.info({ username }, '[AUTH] Keycloak configured but authentication did not return userinfo')
          const debugEnabled = parseBool(process.env.DEBUG_KEYCLOAK)
          if (debugEnabled) return res.status(401).json({ message: 'Invalid credentials', debug: { keycloakTokens: keycloakTokens, keycloakUserInfo: keycloakUserInfo } })
          return res.status(401).json({ message: 'Invalid credentials' })
        }
      }
    } else {
      if (user && user.password) {
        try {
          if (bcrypt.compareSync(password, user.password)) authenticated = true
        } catch (e) { authenticated = false }
      }
    }

    if (!authenticated) {
      if (user) {
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
      } else {
        logAuditEvent({
          username,
          action: AUDIT_ACTIONS.LOGIN_FAILED,
          category: AUDIT_CATEGORIES.AUTH,
          details: { reason: 'User not found' },
          ipAddress,
          userAgent,
          status: 'failure'
        })
      }

      const debugEnabled = parseBool(process.env.DEBUG_KEYCLOAK)
      const debugInfo = {
        authenticated: !!authenticated,
        keycloakConfigured: !!(KEYCLOAK_URL && KEYCLOAK_CLIENT_ID && KEYCLOAK_REALM),
        keycloakTokensPresent: !!keycloakTokens,
        keycloakUserInfoPresent: !!keycloakUserInfo
      }

      if (debugEnabled) {
        return res.status(401).json({ message: 'Invalid credentials', debug: debugInfo })
      }

      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const sessionId = keycloakTokens?.session_state || keycloakTokens?.session || null
    const token = generateToken(user, sessionId)

    logAuditEvent({
      userId: user.id,
      username: user.username,
      action: AUDIT_ACTIONS.LOGIN,
      category: AUDIT_CATEGORIES.AUTH,
      details: { method: keycloakTokens ? 'keycloak' : 'password' },
      ipAddress,
      userAgent,
      status: 'success'
    })

    const prefs = (() => { try { return user.preferences ? JSON.parse(user.preferences) : {} } catch (e) { return {} } })()

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
        theme: prefs.theme || null,
        accent: prefs.accent || null,
        customAccent: prefs.customAccent || null,
        logo: prefs.logo || null,
        preferences: prefs,
        role: user.role,
        ssoProvider: user.sso_provider || null
      }
    })
  } catch (err) {
    logger.error('Login error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

router.get('/me', authenticateToken, (req, res) => {
  try {
    const db = getDb()
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }


    const prefs = (() => { try { return user.preferences ? JSON.parse(user.preferences) : {} } catch (e) { return {} } })()

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
        theme: prefs.theme || null,
        accent: prefs.accent || null,
        customAccent: prefs.customAccent || null,
        logo: prefs.logo || null,
        preferences: prefs,
        role: user.role,
        ssoProvider: user.sso_provider || null
      }
    })
  } catch (err) {
    logger.error('Get user error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

router.get('/export', authenticateToken, (req, res) => {
  try {
    const db = getDb()
    const isAdmin = req.user && req.user.role === 'admin'
    const wantAll = isAdmin && String(req.query.all) === 'true'

    const users = wantAll ? db.prepare('SELECT * FROM users').all() : [db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)]
    const auditLogs = wantAll ? db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC').all() : db.prepare('SELECT * FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id)
    const sessions = wantAll ? db.prepare('SELECT * FROM user_sessions ORDER BY last_seen DESC').all() : db.prepare('SELECT * FROM user_sessions WHERE user_id = ? ORDER BY last_seen DESC').all(req.user.id)

    const settings = db.prepare('SELECT * FROM settings').all()

    const jsonData = { users, auditLogs, sessions, settings, exportedAt: new Date().toISOString() }

    const toCSV = (rows) => {
      if (!rows || rows.length === 0) return ''
      const keys = Object.keys(rows[0])
      const escape = (v) => {
        if (v === null || typeof v === 'undefined') return ''
        let s = String(v)
        s = s.replace(/"/g, '""')
        if (s.includes(',') || s.includes('\n') || s.includes('"')) return `"${s}"`
        return s
      }
      const lines = [keys.join(',')]
      for (const r of rows) lines.push(keys.map(k => escape(r[k])).join(','))
      return lines.join('\n')
    }

    const csv = {
      users: toCSV(users),
      audit_logs: toCSV(auditLogs),
      sessions: toCSV(sessions)
    }

    res.json({ json: jsonData, csv })
  } catch (err) {
    logger.error('Export user data error:', err)
    res.status(500).json({ message: 'Failed to export data' })
  }
})

router.post('/import', authenticateToken, async (req, res) => {
  try {
    const payload = req.body
    if (!payload || !payload.user) return res.status(400).json({ message: 'Invalid import payload' })

    const db = getDb()
    const isAdmin = req.user && req.user.role === 'admin'
    const targetUserId = (isAdmin && payload.user && payload.user.id) ? payload.user.id : req.user.id

    const fieldsToUpdate = {}
    if (payload.user.email) fieldsToUpdate.email = payload.user.email
    if (payload.user.displayName) fieldsToUpdate.display_name = payload.user.displayName
    if (payload.user.firstName) fieldsToUpdate.first_name = payload.user.firstName
    if (payload.user.lastName) fieldsToUpdate.last_name = payload.user.lastName
    if (payload.user.avatar) fieldsToUpdate.avatar = payload.user.avatar
    if (payload.user.language) fieldsToUpdate.language = payload.user.language
    if (payload.user.preferences) fieldsToUpdate.preferences = JSON.stringify(payload.user.preferences)

    if (Object.keys(fieldsToUpdate).length > 0) {
      const sets = []
      const params = []
      Object.entries(fieldsToUpdate).forEach(([k, v]) => { sets.push(`${k} = ?`); params.push(v) })
      params.push(targetUserId)
      db.prepare(`UPDATE users SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...params)
    }

    if (Array.isArray(payload.auditLogs)) {
      for (const log of payload.auditLogs) {
        try {
          const id = log.id || crypto.randomUUID()
          db.prepare(`INSERT OR IGNORE INTO audit_logs (id, user_id, username, action, category, resource_type, resource_id, resource_name, details, ip_address, user_agent, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(id, targetUserId, log.username || null, log.action || null, log.category || null, log.resource_type || null, log.resource_id || null, log.resource_name || null, log.details || null, log.ip_address || null, log.user_agent || null, log.status || null, log.created_at || new Date().toISOString())
        } catch (e) {
          logger.warn('Failed to import audit log entry:', e)
        }
      }
    }

    if (Array.isArray(payload.sessions)) {
      for (const s of payload.sessions) {
        try {
          const sid = s.session_id || crypto.randomUUID()
          db.prepare(`INSERT OR IGNORE INTO user_sessions (session_id, user_id, client_id, ip, user_agent, last_seen, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
            .run(sid, targetUserId, s.client_id || null, s.ip || null, s.user_agent || null, s.last_seen || null, s.created_at || new Date().toISOString())
        } catch (e) {
          logger.warn('Failed to import user session entry:', e)
        }
      }
    }

    logAuditEvent({
      userId: req.user.id,
      username: req.user.username,
      action: 'data_imported',
      category: 'user',
      details: { targetUserId },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      status: 'success'
    })

    res.json({ message: 'Import complete' })
  } catch (err) {
    logger.error('Import error:', err)
    res.status(500).json({ message: 'Failed to import data' })
  }
})

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
    logger.error('Update password error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

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

    const changes = {}
    if (email !== undefined && email !== user.email) changes.email = email
    if (displayName !== undefined && displayName !== user.display_name) changes.displayName = displayName
    if (firstName !== undefined && firstName !== user.first_name) changes.firstName = firstName
    if (lastName !== undefined && lastName !== user.last_name) changes.lastName = lastName
    if (language !== undefined && language !== user.language) changes.language = language

    if (Object.keys(changes).length > 0) {
      logAuditEvent({
        userId: updated.id,
        username: updated.username,
        action: AUDIT_ACTIONS.PROFILE_UPDATED,
        category: AUDIT_CATEGORIES.USER,
        details: { changes },
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        status: 'success'
      })
    }

    const updatedPrefs = (() => { try { return updated.preferences ? JSON.parse(updated.preferences) : {} } catch (e) { return {} } })()

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
        theme: updatedPrefs.theme || null,
        accent: updatedPrefs.accent || null,
        customAccent: updatedPrefs.customAccent || null,
        logo: updatedPrefs.logo || null,
        preferences: updatedPrefs,
        role: updated.role,
        ssoProvider: updated.sso_provider || null
      }
    })
  } catch (err) {
    logger.error('Update profile error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

router.post('/appearance', authenticateToken, (req, res) => {
  try {
    logger.info('POST /api/auth/appearance', { userId: req.user?.id, body: req.body })
    const { theme, accent, customAccent, logo, syncPreferences, clearPreferences } = req.body
    const db = getDb()
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
    if (!user) return res.status(404).json({ message: 'User not found' })

    const existing = (() => { try { return user.preferences ? JSON.parse(user.preferences) : {} } catch (e) { return {} } })()
    let prefs = { ...existing }

    const changes = {}

    if (clearPreferences) {
      prefs = {}
      changes.cleared = true
      if (syncPreferences !== undefined) {
        prefs.syncPreferences = !!syncPreferences
        changes.syncPreferences = prefs.syncPreferences
      } else {
        prefs.syncPreferences = false
        changes.syncPreferences = false
      }
    } else {
      if (syncPreferences !== undefined && syncPreferences !== existing.syncPreferences) {
        prefs.syncPreferences = !!syncPreferences
        changes.syncPreferences = prefs.syncPreferences
      }

      const allowAppearancePersist = !(existing && existing.syncPreferences === false) || (syncPreferences === true)

      if (allowAppearancePersist) {
        if (theme !== undefined && theme !== existing.theme) { prefs.theme = theme; changes.theme = theme }
        if (accent !== undefined && accent !== existing.accent) { prefs.accent = accent; changes.accent = accent }
        if (customAccent !== undefined && customAccent !== existing.customAccent) { prefs.customAccent = customAccent; changes.customAccent = customAccent }
        if (logo !== undefined && logo !== existing.logo) { prefs.logo = logo; changes.logo = logo }
      }
    }

    if (Object.keys(changes).length > 0) {
      db.prepare('UPDATE users SET preferences = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(JSON.stringify(prefs), req.user.id)

      let action = AUDIT_ACTIONS.THEME_CHANGED
      if (changes.cleared) action = AUDIT_ACTIONS.USER_UPDATED
      if (changes.syncPreferences !== undefined) action = AUDIT_ACTIONS.USER_UPDATED
      if (changes.accent !== undefined || changes.customAccent !== undefined) action = AUDIT_ACTIONS.ACCENT_CHANGED
      if (changes.logo !== undefined) action = AUDIT_ACTIONS.LOGO_CHANGED

      logAuditEvent({
        userId: req.user.id,
        username: req.user.username,
        action,
        category: AUDIT_CATEGORIES.APPEARANCE,
        details: { changes },
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        status: 'success'
      })
    }

    res.json({ message: 'Appearance preferences updated', changes, preferences: prefs })
  } catch (err) {
    logger.error('Update appearance error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})


let _kcAdminCache = { token: null, expiresAt: 0 }

async function getKeycloakAdminToken() {
  if (process.env.KEYCLOAK_ADMIN_TOKEN) return process.env.KEYCLOAK_ADMIN_TOKEN

  const clientId = process.env.KEYCLOAK_ADMIN_CLIENT_ID
  const clientSecret = process.env.KEYCLOAK_ADMIN_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Keycloak admin token not configured (set KEYCLOAK_ADMIN_TOKEN or KEYCLOAK_ADMIN_CLIENT_ID+KEYCLOAK_ADMIN_CLIENT_SECRET)')

  if (_kcAdminCache.token && Date.now() < _kcAdminCache.expiresAt) return _kcAdminCache.token

  const tokenUrl = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`
  const params = new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret })
  const res = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Failed to obtain Keycloak admin token: ${res.status} ${txt}`)
  }

  const data = await res.json()
  if (!data.access_token) throw new Error('Invalid token response from Keycloak')

  const expiresIn = Number(data.expires_in || 60)
  _kcAdminCache.token = data.access_token
  _kcAdminCache.expiresAt = Date.now() + Math.max(1000, (expiresIn - 30) * 1000)

  return _kcAdminCache.token
}

async function callKeycloakAdmin(path, options = {}) {
  const token = await getKeycloakAdminToken()
  const url = `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}${path}`
  const opts = Object.assign({ headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }, options)
  return fetch(url, opts)
}

const _kcClientCache = { mapById: new Map(), mapByClientId: new Map(), expiresAt: 0 }
async function resolveKeycloakClientName(key) {
  if (!key) return null
  const now = Date.now()
  if (now > _kcClientCache.expiresAt) {
    _kcClientCache.mapById.clear()
    _kcClientCache.mapByClientId.clear()
    _kcClientCache.expiresAt = now + 60 * 1000
  }

  if (_kcClientCache.mapById.has(key)) return _kcClientCache.mapById.get(key)
  if (_kcClientCache.mapByClientId.has(key)) return _kcClientCache.mapByClientId.get(key)

  try {
    let r = await callKeycloakAdmin(`/clients/${encodeURIComponent(key)}`, { method: 'GET' })
    if (r.ok) {
      const j = await r.json()
      const name = j.name || j.clientId || key
      _kcClientCache.mapById.set(key, name)
      if (j.id) _kcClientCache.mapById.set(j.id, name)
      if (j.clientId) _kcClientCache.mapByClientId.set(j.clientId, name)
      return name
    }
  } catch (e) {
    logger.warn('Failed to resolve Keycloak client name:', e)
  }

  try {
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
    logger.warn('Failed to resolve Keycloak client name:', e)
  }

  return null
}

router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const db = getDb()
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
    if (!user) return res.status(404).json({ message: 'User not found' })

    if (!user.sso_provider || !user.sso_id) return res.json({ sessions: [] })

    try {
      const r = await callKeycloakAdmin(`/users/${encodeURIComponent(user.sso_id)}/sessions`, { method: 'GET' })
      if (!r.ok) {
        const text = await r.text()
        logger.error('Keycloak sessions fetch failed:', r.status, text)
        return res.status(502).json({ message: 'Failed to fetch sessions from SSO provider' })
      }
      const kcSessions = await r.json()

      const local = db.prepare('SELECT * FROM user_sessions WHERE user_id = ?').all(user.id)
      const localMap = new Map(local.map(s => [s.session_id, s]))

      const currentIpRaw = (req.headers && (req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.headers['x-forwarded-host']))
        ? ((req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim())
        : (req.ip || (req.connection && req.connection.remoteAddress) || null)
      const currentIp = normalizeIp(currentIpRaw)
      const currentUA = req.headers && req.headers['user-agent'] ? req.headers['user-agent'] : ''

      const uniqueClients = new Set()
      kcSessions.forEach(k => { const candidate = k.client || k.clientId || (localMap.get(k.id) && localMap.get(k.id).client_id); if (candidate) uniqueClients.add(candidate) })
      const clientDisplay = {}
      await Promise.all(Array.from(uniqueClients).map(async (c) => {
        try {
          const resolved = await resolveKeycloakClientName(c)
          if (resolved) clientDisplay[c] = resolved
        } catch (e) { logger.warn('Failed to resolve Keycloak client name:', e) }
      }))

      const merged = kcSessions.map(k => {
        const matching = localMap.get(k.id)
        const ipAddr = normalizeIp(k.ipAddress) || normalizeIp(k.clientAddress) || normalizeIp(matching && matching.ip) || null
        const ua = matching ? matching.user_agent : null
        const rawClient = k.client || k.clientId || (matching && matching.client_id) || null
        const clientId = clientDisplay[rawClient] || rawClient || null
        const lastAccess = k.lastAccess || null
        const createdAt = matching ? matching.created_at : null

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
          logger.warn('Failed to determine isCurrent for session:', e)
        }

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

      const validSessionIds = new Set(kcSessions.map(k => k.id))
      const staleSessions = local.filter(l => !validSessionIds.has(l.session_id))

      if (staleSessions.length > 0) {
        try {
          const staleIds = staleSessions.map(s => s.session_id)
          db.prepare(`DELETE FROM user_sessions WHERE session_id IN (${staleIds.map(() => '?').join(',')})`).run(...staleIds)
          logger.info(`Cleaned up ${staleSessions.length} stale session(s) for user ${user.id}`)
        } catch (cleanupErr) {
          logger.warn('Failed to cleanup stale sessions:', cleanupErr)
        }
      }
      const validMerged = merged.filter(s => s.ipAddress && s.ipAddress !== ':' && s.ipAddress !== '')

      return res.json({ sessions: validMerged })
    } catch (err) {
      logger.error('Sessions endpoint error:', err)
      return res.status(500).json({ message: 'Failed to fetch sessions' })
    }
  } catch (err) {
    logger.error('Get sessions error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

router.post('/sessions/revoke', authenticateToken, async (req, res) => {
  try {
    const { all, sessionId } = req.body || {}
    const db = getDb()
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
    if (!user) return res.status(404).json({ message: 'User not found' })
    if (!user.sso_provider || !user.sso_id) return res.status(400).json({ message: 'Sessions not available for non-SSO accounts' })

    if (all) {
      try {
        const r = await callKeycloakAdmin(`/users/${encodeURIComponent(user.sso_id)}/logout`, { method: 'POST' })
        if (!r.ok) {
          const text = await r.text()
          logger.error('Keycloak logout-all failed:', r.status, text)
          return res.status(502).json({ message: 'Failed to logout user sessions via SSO provider' })
        }
        try {
          db.prepare('UPDATE users SET tokens_invalid_before = CURRENT_TIMESTAMP WHERE id = ?').run(user.id)
        } catch (e) {
          logger.warn('Failed to set tokens_invalid_before for user:', e)
        }
        try { db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(user.id) } catch (e) { logger.warn('Failed to delete local session metadata:', e) }
        return res.json({ message: 'All sessions revoked' })
      } catch (err) {
        logger.error('Logout all sessions error:', err)
        return res.status(500).json({ message: 'Failed to revoke sessions' })
      }
    }

    if (sessionId) {
      try {
        const r = await callKeycloakAdmin(`/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' })
        if (r.ok) {
          try { db.prepare('DELETE FROM user_sessions WHERE session_id = ?').run(sessionId) } catch (e) { logger.warn('Failed to delete local session metadata:', e) }
          return res.json({ message: 'Session revoked' })
        }
        if (r.status === 404) {
          return res.status(501).json({ message: 'Single-session revocation not supported by this SSO server version' })
        }
        const text = await r.text()
        logger.error('Keycloak revoke session failed:', r.status, text)
        return res.status(502).json({ message: 'Failed to revoke session via SSO provider' })
      } catch (err) {
        logger.error('Revoke session error:', err)
        return res.status(500).json({ message: 'Failed to revoke session' })
      }
    }

    return res.status(400).json({ message: 'Invalid request: provide { all: true } or { sessionId }' })
  } catch (err) {
    logger.error('Revoke sessions error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

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

    const usersWithFixedTimestamps = users.map(user => ({
      ...user,
      created_at: user.created_at ? (user.created_at.endsWith('Z') ? user.created_at : user.created_at + 'Z') : user.created_at
    }))

    res.json({ users: usersWithFixedTimestamps })
  } catch (err) {
    logger.error('Fetch users error:', err)
    res.status(500).json({ message: 'Failed to fetch users' })
  }
})

if (process.env.NODE_ENV !== 'production') {
  router.get('/debug/users', (req, res) => {
    try {
      const db = getDb()
      const rows = db.prepare('SELECT id, username, preferences FROM users ORDER BY created_at DESC').all()
      res.json({ users: rows })
    } catch (err) {
      logger.error('Debug users error:', err)
      res.status(500).json({ message: 'Failed to fetch debug users' })
    }
  })
}

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

    if (parseInt(userId) === req.user.id && role !== 'admin') {
      return res.status(400).json({ message: 'Cannot change your own role' })
    }

    const db = getDb()
    const targetUser = db.prepare('SELECT username FROM users WHERE id = ?').get(userId)

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' })
    }

    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId)

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
    logger.error('Update user role error:', err)
    res.status(500).json({ message: 'Failed to update user role' })
  }
})

router.delete('/users/:userId', authenticateToken, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' })
    }

    const { userId } = req.params

    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' })
    }

    const db = getDb()
    const target = db.prepare('SELECT username FROM users WHERE id = ?').get(userId)
    if (!target) return res.status(404).json({ message: 'User not found' })

    try { db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(userId) } catch (e) { /* ignore */ }
    db.prepare('DELETE FROM users WHERE id = ?').run(userId)

    logAuditEvent({
      userId: req.user.id,
      username: req.user.username,
      action: AUDIT_ACTIONS.USER_DELETED,
      category: AUDIT_CATEGORIES.USER_MANAGEMENT,
      resourceType: 'user',
      resourceId: userId,
      resourceName: target.username,
      details: { deletedUser: target.username },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      status: 'success'
    })

    res.json({ message: 'User deleted' })
  } catch (err) {
    logger.error('Delete user error:', err)
    res.status(500).json({ message: 'Failed to delete user' })
  }
})

// Public endpoint: fetch event QR code configuration (visible to all authenticated users)
router.get('/event-qr', authenticateToken, async (req, res) => {
  try {
    const db = getDb()
    const keys = ['eventQrUrl', 'eventQrLabel', 'eventQrVisible']
    const rows = db.prepare(`SELECT key, value FROM settings WHERE key IN (${keys.map(() => '?').join(',')})`).all(...keys)
    const obj = {}
    rows.forEach(r => { obj[r.key] = r.value })
    res.json({
      url: obj.eventQrUrl || '',
      label: obj.eventQrLabel || '',
      visible: obj.eventQrVisible === 'true'
    })
  } catch (err) {
    logger.error('Get event QR settings error:', err)
    res.status(500).json({ message: 'Failed to fetch event QR settings' })
  }
})

router.get('/admin/settings', authenticateToken, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' })
    const db = getDb()
    const rows = db.prepare('SELECT key, value FROM settings').all()
    const obj = {}
    rows.forEach(r => { obj[r.key] = r.value })
    res.json({ settings: obj })
  } catch (err) {
    logger.error('Get settings error:', err)
    res.status(500).json({ message: 'Failed to fetch settings' })
  }
})

router.get('/admin/settings/:key', authenticateToken, async (req, res) => {
  try {
    const { key } = req.params
    const db = getDb()
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
    if (!row) return res.status(404).json({ message: 'Setting not found' })
    res.json({ key, value: row.value })
  } catch (err) {
    logger.error('Get setting error:', err)
    res.status(500).json({ message: 'Failed to fetch setting' })
  }
})

router.post('/admin/settings', authenticateToken, async (req, res) => {
  try {
    const { key, value } = req.body
    logger.info('POST /api/admin/settings', { userId: req.user?.id, username: req.user?.username, key, value })
    if (!req.user || req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' })
    if (!key) return res.status(400).json({ message: 'Missing key' })
    if (key === 'logLevel') {
      const allowed = ['error', 'warn', 'info', 'debug']
      if (!allowed.includes(String(value))) {
        return res.status(400).json({ message: 'Invalid log level' })
      }
    }

    const db = getDb()
    const existing = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
    if (existing) {
      db.prepare('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?').run(value, key)
    } else {
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, value)
    }

    // If admin changed the global log level, apply it immediately
    if (key === 'logLevel') {
      try {
        const { setLevel } = await import('../logger.js')
        setLevel(String(value))
        process.env.LOG_LEVEL = String(value)
        logger.info({ newLevel: String(value) }, 'Global log level updated')
      } catch (e) {
        logger.error('Failed to apply log level at runtime:', e)
      }
    }

    logAuditEvent({
      userId: req.user.id,
      username: req.user.username,
      action: AUDIT_ACTIONS.SETTINGS_UPDATED,
      category: AUDIT_CATEGORIES.SETTINGS,
      resourceType: 'setting',
      resourceId: key,
      resourceName: key,
      details: { key, value },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      status: 'success'
    })

    res.json({ message: 'Setting saved', key, value })
  } catch (err) {
    logger.error('Save setting error:', err)
    res.status(500).json({ message: 'Failed to save setting' })
  }
})

router.get('/sso/frontchannel-logout', async (req, res) => {
  try {
    const sessionId = req.query.session_state || req.query.session || req.query.sid || null
    if (!sessionId) {
      return res.status(400).send('Missing session identifier')
    }

    const db = getDb()
    const row = db.prepare('SELECT user_id FROM user_sessions WHERE session_id = ?').get(sessionId)
    if (!row || !row.user_id) {
      logger.warn('Frontchannel logout received unknown session:', sessionId)
      return res.status(200).send('Ok')
    }

    const userId = row.user_id

    try {
      db.prepare('DELETE FROM user_sessions WHERE session_id = ?').run(sessionId)
    } catch (e) {
      logger.warn('Failed to delete user_session for frontchannel logout:', e)
    }

    try {
      db.prepare('UPDATE users SET tokens_invalid_before = CURRENT_TIMESTAMP WHERE id = ?').run(userId)
    } catch (e) {
      logger.warn('Failed to set tokens_invalid_before during frontchannel logout:', e)
    }

    logger.info({ sessionId }, 'Frontchannel logout processed for session')
    return res.status(200).send('Ok')
  } catch (err) {
    logger.error('Frontchannel logout handler error:', err)
    return res.status(500).send('Server error')
  }
})

// SSO Session validation endpoint - checks if the user's SSO session is still active
router.get('/sso/validate', authenticateToken, async (req, res) => {
  try {
    const db = getDb()
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)

    if (!user) {
      return res.status(404).json({ valid: false, message: 'User not found' })
    }

    if (!user.sso_provider || !user.sso_id) {
      return res.json({ valid: true, ssoUser: false })
    }
    const sessionId = req.user.sessionId
    if (!sessionId) {
      logger.warn('SSO validate: No session ID in token, assuming valid')
      return res.json({ valid: true, ssoUser: true, sessionId: null })
    }

    try {
      const sessionsRes = await callKeycloakAdmin(`/users/${encodeURIComponent(user.sso_id)}/sessions`, { method: 'GET' })

      if (!sessionsRes.ok) {
        logger.warn('SSO validate: Could not reach Keycloak, assuming valid')
        return res.json({ valid: true, ssoUser: true, checkFailed: true })
      }

      const sessions = await sessionsRes.json()
      const currentSession = sessions.find(s => s.id === sessionId)

      if (!currentSession) {
        return res.json({ valid: false, ssoUser: true, reason: 'session_expired' })
      }

      let expiresIn = null
      if (currentSession.lastAccess) {
        const ssoIdleTimeout = parseInt(process.env.KEYCLOAK_SSO_IDLE_TIMEOUT) || 1800
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
      logger.error('SSO validate Keycloak error:', kcErr)
      return res.json({ valid: true, ssoUser: true, checkFailed: true })
    }
  } catch (err) {
    logger.error('SSO validate error:', err)
    res.status(500).json({ valid: false, message: 'Validation failed' })
  }
})

router.get('/sso/refresh-config', authenticateToken, async (req, res) => {
  try {
    const db = getDb()
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)

    if (!user || !user.sso_provider) {
      return res.status(400).json({ message: 'Not an SSO user' })
    }

    const cfg = await readSSOConfig()

    res.json({
      authUrl: cfg.authUrl,
      clientId: cfg.clientId,
      scope: cfg.scope,
      silentCheckSsoRedirectUri: `${req.protocol}://${req.get('host')}/sso-callback`
    })
  } catch (err) {
    logger.error('SSO refresh config error:', err)
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

    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg')

    const buffer = await response.arrayBuffer()
    res.send(Buffer.from(buffer))
  } catch (err) {
    logger.error('Avatar proxy error:', err)
    res.status(500).json({ message: 'Failed to proxy avatar' })
  }
})


const geoCache = new Map()
const GEO_CACHE_TTL = 1000 * 60 * 60 * 24

// Helper function to get geolocation for an IP
async function getIpGeolocation(ip) {
  if (!ip) return { error: 'No IP provided' }

  if (!/^[\d.:a-fA-F]+$/.test(ip)) {
    return { error: 'Invalid IP address format' }
  }

  // Check if it's a private/local IP
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

  const cached = geoCache.get(ip)
  if (cached && Date.now() - cached.timestamp < GEO_CACHE_TTL) {
    return cached.data
  }

  try {
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

    geoCache.set(ip, { timestamp: Date.now(), data: result })

    return result
  } catch (err) {
    logger.error('IP geolocation fetch error:', err)
    return { error: 'Failed to fetch geolocation' }
  }
}

router.get('/ip-geo', authenticateToken, async (req, res) => {
  try {
    const rawIp = req.query.ip
    if (!rawIp) {
      return res.status(400).json({ message: 'IP address required' })
    }

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
    logger.error('IP geolocation error:', err)
    res.status(500).json({ message: 'Failed to fetch geolocation' })
  }
})

router.get('/ip-geo/:ip', authenticateToken, async (req, res) => {
  try {
    const rawIp = req.params.ip

    if (!rawIp) {
      return res.status(400).json({ message: 'Invalid IP address' })
    }

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
    logger.error('IP geolocation error:', err)
    res.status(500).json({ message: 'Failed to fetch geolocation' })
  }
})


const mapCache = new Map()
const MAP_CACHE_TTL = 1000 * 60 * 60 * 24 * 7

function latLonToTile(lat, lon, zoom) {
  const n = Math.pow(2, zoom)
  const x = Math.floor((lon + 180) / 360 * n)
  const latRad = lat * Math.PI / 180
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n)
  return { x, y }
}

// Get static map image - built with AI
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

    const cached = mapCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < MAP_CACHE_TTL) {
      res.setHeader('Content-Type', 'image/png')
      res.setHeader('Cache-Control', 'public, max-age=604800')
      return res.send(cached.data)
    }

    const { x, y } = latLonToTile(latitude, longitude, zoom)

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
      logger.error('OSM tile fetch failed:', response.status)
      return res.status(502).json({ message: 'Map service unavailable' })
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    mapCache.set(cacheKey, { timestamp: Date.now(), data: buffer })

    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=604800')
    res.send(buffer)
  } catch (err) {
    logger.error('Static map error:', err)
    res.status(500).json({ message: 'Failed to generate map' })
  }
})

export default router
