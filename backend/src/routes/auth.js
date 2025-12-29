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

// Get SSO configuration for frontend
router.get('/sso/config', (req, res) => {
  res.json({
    authUrl: `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/auth`,
    clientId: KEYCLOAK_CLIENT_ID,
    scope: 'openid profile email'
  })
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

    // Generate our own JWT token
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

export default router
