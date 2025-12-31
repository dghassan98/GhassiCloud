import { Router } from 'express'
import fetch from 'node-fetch'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { getDb } from '../db/index.js'

const router = Router()

// Fixed host for this project
const NAV_HOST = process.env.NAV_HOST || 'https://music.ghassandarwish.com'
const API_VERSION = '1.16.1'
const CLIENT_NAME = 'ghassi-cloud'

function md5(input) {
  return crypto.createHash('md5').update(input).digest('hex')
}

// Helper to get saved credential (single-user support)
function getCred(db) {
  try {
    return db.prepare('SELECT * FROM navidrome_credentials LIMIT 1').get()
  } catch (e) {
    return undefined
  }
}

// Helper to check if a column exists in navidrome_credentials (for migrations / older DBs)
function columnExists(db, col) {
  try {
    const rows = db.prepare("PRAGMA table_info(navidrome_credentials)").all()
    return rows.some(r => r.name === col)
  } catch (e) {
    return false
  }
}

// Encryption helpers for storing reversible password when server doesn't return a token
const SECRET_BASE = process.env.NAV_SECRET || process.env.JWT_SECRET || 'ghassi-default-secret'
const ENC_KEY = crypto.createHash('sha256').update(String(SECRET_BASE)).digest()
function encryptText(plain) {
  try {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-cbc', ENC_KEY, iv)
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
    return iv.toString('base64') + ':' + encrypted.toString('base64')
  } catch (e) {
    console.warn('Encryption failed (storing plain fallback):', e)
    return plain
  }
}
function decryptText(payload) {
  try {
    if (!payload || !payload.includes(':')) return payload
    const [ivB64, encB64] = payload.split(':')
    const iv = Buffer.from(ivB64, 'base64')
    const enc = Buffer.from(encB64, 'base64')
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENC_KEY, iv)
    const plain = Buffer.concat([decipher.update(enc), decipher.final()])
    return plain.toString('utf8')
  } catch (e) {
    console.warn('Decryption failed:', e)
    return payload
  }
}

// Try to login to remote server and return token if successful (or fall back to direct auth)
async function remoteLogin(username, password) {
  // Try with MD5 first (common for Subsonic-based servers), then fallback to plain password
  let lastStatus = null
  let lastText = null

  const attempts = [
    { name: 'md5', p: md5(password) },
    { name: 'plain', p: password }
  ]

  // First try to get a token via login.view
  for (const a of attempts) {
    const url = `${NAV_HOST}/rest/login.view?u=${encodeURIComponent(username)}&p=${encodeURIComponent(a.p)}&v=${API_VERSION}&c=${CLIENT_NAME}&f=json`
    try {
      const res = await fetch(url)
      lastStatus = res.status
      const text = await res.text()
      lastText = text
      let json
      try { json = text ? JSON.parse(text) : null } catch (e) { json = null }
      const token = json?.['subsonic-response']?.authToken || json?.['subsonic-response']?.token || json?.['subsonic-response']?.authenticationToken || json?.['subsonic-response']?.auth || null

      if (res.ok && json?.['subsonic-response']?.status === 'ok' && token) {
        return { ok: true, token, raw: json, method: a.name }
      }

    } catch (err) {
      lastText = String(err)
    }
  }

  // If login.view is not available (404) many Navidrome instances accept p=md5 on other endpoints
  // Try calling getNowPlaying with u & p to validate credentials (no token issued)
  for (const a of attempts) {
    const url = `${NAV_HOST}/rest/getNowPlaying.view?u=${encodeURIComponent(username)}&p=${encodeURIComponent(a.p)}&v=${API_VERSION}&c=${CLIENT_NAME}&f=json`
    try {
      const res = await fetch(url)
      lastStatus = res.status
      const text = await res.text()
      lastText = text
      let json
      try { json = text ? JSON.parse(text) : null } catch (e) { json = null }
      if (res.ok && json?.['subsonic-response']?.status === 'ok') {
        // server accepts direct auth via p=, return method=direct with the p value to be stored encrypted
        return { ok: true, token: null, method: 'direct', passwordToUse: a.p, passwordType: a.name }
      }
    } catch (err) {
      lastText = String(err)
    }
  }

  // As a final step: try to validate using MD5(password + salt) token approach
  // Generate a couple of short salts and try them
  const salts = [crypto.randomBytes(3).toString('hex'), crypto.randomBytes(4).toString('hex')]
  for (const s of salts) {
    const tokenCandidate = md5(password + s)
    const url = `${NAV_HOST}/rest/getNowPlaying.view?u=${encodeURIComponent(username)}&t=${encodeURIComponent(tokenCandidate)}&s=${encodeURIComponent(s)}&v=${API_VERSION}&c=${CLIENT_NAME}&f=json`
    try {
      const res = await fetch(url)
      lastStatus = res.status
      const text = await res.text()
      lastText = text
      let json
      try { json = text ? JSON.parse(text) : null } catch (e) { json = null }
      if (res.ok && json?.['subsonic-response']?.status === 'ok') {
        return { ok: true, token: tokenCandidate, salt: s, method: 'token-md5' }
      }
    } catch (err) {
      lastText = String(err)
    }
  }

  throw new Error(`Login request failed: status=${lastStatus} body=${lastText}`)
}

// Proxy getNowPlaying using stored credential
router.get('/nowplaying', async (req, res) => {
  try {
    const db = getDb()
    const cred = getCred(db)
    if (!cred) return res.status(401).json({ message: 'No credentials configured' })
    const username = cred.username
    // Determine auth method - token preferred, otherwise decrypt stored password for direct auth
    let url
    if (cred.auth_method === 'direct' && cred.password_encrypted) {
      const p = decryptText(cred.password_encrypted)
      url = `${NAV_HOST}/rest/getNowPlaying.view?u=${encodeURIComponent(username)}&p=${encodeURIComponent(p)}&v=${API_VERSION}&c=${CLIENT_NAME}&f=json`
    } else if (cred.token) {
      url = `${NAV_HOST}/rest/getNowPlaying.view?u=${encodeURIComponent(username)}&t=${encodeURIComponent(cred.token)}${cred.salt ? `&s=${encodeURIComponent(cred.salt)}` : ''}&v=${API_VERSION}&c=${CLIENT_NAME}&f=json`
    } else {
      return res.status(401).json({ message: 'No credentials configured' })
    }

    const r = await fetch(url)
    if (r.status === 401 || r.status === 403) return res.status(401).json({ message: 'Invalid credentials' })
    const json = await r.json()
    if (!r.ok || json?.['subsonic-response']?.status !== 'ok') {
      // Consider invalid token
      return res.status(401).json({ message: 'Not authenticated' })
    }
    res.json(json)
  } catch (err) {
    console.error('NowPlaying error', err)
    res.status(500).json({ message: 'Server error' })
  }
})

// Cover art proxy so client does not need token
router.get('/cover', async (req, res) => {
  try {
    const { id, size = 160 } = req.query
    if (!id) return res.status(400).json({ message: 'Missing id' })
    const db = getDb()
    const cred = getCred(db)
    if (!cred) return res.status(401).json({ message: 'No credentials configured' })

    const username = cred.username
    let url
    if (cred.auth_method === 'direct' && cred.password_encrypted) {
      const p = decryptText(cred.password_encrypted)
      url = `${NAV_HOST}/rest/getCoverArt.view?id=${encodeURIComponent(id)}&size=${encodeURIComponent(size)}&u=${encodeURIComponent(username)}&p=${encodeURIComponent(p)}&v=${API_VERSION}&c=${CLIENT_NAME}`
    } else if (cred.token) {
      url = `${NAV_HOST}/rest/getCoverArt.view?id=${encodeURIComponent(id)}&size=${encodeURIComponent(size)}&u=${encodeURIComponent(username)}&t=${encodeURIComponent(cred.token)}${cred.salt ? `&s=${encodeURIComponent(cred.salt)}` : ''}&v=${API_VERSION}&c=${CLIENT_NAME}`
    } else {
      return res.status(401).json({ message: 'No credentials configured' })
    }

    const r = await fetch(url)
    if (!r.ok) return res.status(r.status).send('')
    // Pipe response headers
    const contentType = r.headers.get('content-type') || 'image/jpeg'
    res.setHeader('content-type', contentType)
    const buffer = await r.arrayBuffer()
    res.send(Buffer.from(buffer))
  } catch (err) {
    console.error('Cover proxy error', err)
    res.status(500).json({ message: 'Server error' })
  }
})

// Login and save bcrypt-hashed password and token
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {}
    if (!username || !password) return res.status(400).json({ message: 'username and password required' })
    const db = getDb()
    let attempt
    try {
      attempt = await remoteLogin(username, password)
    } catch (err) {
      console.error('Navidrome remote login failed:', err)
      return res.status(401).json({ message: 'Invalid username or password', details: String(err.message || err) })
    }

    const hashed = bcrypt.hashSync(password, 10)

    // Overwrite existing credential(s) with the new successful login
    try {
      db.prepare('DELETE FROM navidrome_credentials').run()
    } catch (e) {
      // ignore
    }

    if (attempt.method === 'direct') {
      const enc = encryptText(attempt.passwordToUse)
      db.prepare(`INSERT INTO navidrome_credentials (username, password_hashed, password_encrypted, password_type, auth_method) VALUES (?, ?, ?, ?, ?)`)
        .run(username, hashed, enc, attempt.passwordType, 'direct')
      console.log('✅ Navidrome credentials saved (direct) for', username)
    } else if (attempt.method === 'token-md5') {
      const token = attempt.token
      const salt = attempt.salt
      db.prepare(`INSERT INTO navidrome_credentials (username, password_hashed, token, salt, auth_method) VALUES (?, ?, ?, ?, ?)`)
        .run(username, hashed, token, salt, 'token-md5')
      console.log('✅ Navidrome credentials saved (token-md5) for', username)
    } else {
      db.prepare(`INSERT INTO navidrome_credentials (username, password_hashed, token, auth_method) VALUES (?, ?, ?, ?)`)
        .run(username, hashed, attempt.token, 'token')
      console.log('✅ Navidrome credentials saved (token) for', username)
    }

    res.json({ status: 'ok', username, method: attempt.method })
  } catch (err) {
    console.error('Navidrome login error', err)
    res.status(500).json({ message: 'Server error' })
  }
})

// Logout / remove saved credentials
router.post('/logout', async (req, res) => {
  try {
    const db = getDb()
    // We only store a single credential row; delete all entries to clear
    db.prepare('DELETE FROM navidrome_credentials').run()
    res.json({ status: 'ok' })
  } catch (err) {
    console.error('Navidrome logout error', err)
    res.status(500).json({ message: 'Server error' })
  }
})

// Attempt to re-authenticate using stored (encrypted) password if available
router.post('/reauth', async (req, res) => {
  try {
    const db = getDb()
    const cred = getCred(db)
    if (!cred) return res.status(401).json({ message: 'No credentials configured' })
    const username = cred.username

    // Only possible to reauth if we have an encrypted password stored
    if (!(cred.password_encrypted)) {
      return res.status(400).json({ message: 'No stored password available for re-authentication' })
    }

    const decrypted = decryptText(cred.password_encrypted)

    let attempt
    try {
      attempt = await remoteLogin(username, decrypted)
    } catch (err) {
      console.error('Navidrome reauth failed:', err)
      return res.status(401).json({ message: 'Reauth failed', details: String(err.message || err) })
    }

    // Replace stored cred with new result (same logic as /login)
    try { db.prepare('DELETE FROM navidrome_credentials').run() } catch (e) {}

    if (attempt.method === 'direct') {
      const enc = encryptText(attempt.passwordToUse)
      db.prepare(`INSERT INTO navidrome_credentials (username, password_hashed, password_encrypted, password_type, auth_method) VALUES (?, ?, ?, ?, ?)`)
        .run(username, cred.password_hashed || '', enc, attempt.passwordType, 'direct')
      console.log('🔄 Navidrome re-auth saved (direct) for', username)
    } else if (attempt.method === 'token-md5') {
      const token = attempt.token
      const salt = attempt.salt
      db.prepare(`INSERT INTO navidrome_credentials (username, password_hashed, token, salt, auth_method) VALUES (?, ?, ?, ?, ?)`)
        .run(username, cred.password_hashed || '', token, salt, 'token-md5')
      console.log('🔄 Navidrome re-auth saved (token-md5) for', username)
    } else {
      db.prepare(`INSERT INTO navidrome_credentials (username, password_hashed, token, auth_method) VALUES (?, ?, ?, ?)`)
        .run(username, cred.password_hashed || '', attempt.token, 'token')
      console.log('🔄 Navidrome re-auth saved (token) for', username)
    }

    res.json({ status: 'ok', username, method: attempt.method })
  } catch (err) {
    console.error('Navidrome reauth error', err)
    res.status(500).json({ message: 'Server error' })
  }
})

// Check validity of saved credentials
router.get('/check', async (req, res) => {
  try {
    const db = getDb()
    const cred = getCred(db)
    if (!cred) return res.status(401).json({ message: 'No credentials' })
    // Try nowplaying as a lightweight check
    const username = cred.username
    let url
    if (cred.auth_method === 'direct' && cred.password_encrypted) {
      const p = decryptText(cred.password_encrypted)
      url = `${NAV_HOST}/rest/getNowPlaying.view?u=${encodeURIComponent(username)}&p=${encodeURIComponent(p)}&v=${API_VERSION}&c=${CLIENT_NAME}&f=json`
    } else if (cred.token) {
      url = `${NAV_HOST}/rest/getNowPlaying.view?u=${encodeURIComponent(username)}&t=${encodeURIComponent(cred.token)}${cred.salt ? `&s=${encodeURIComponent(cred.salt)}` : ''}&v=${API_VERSION}&c=${CLIENT_NAME}&f=json`
    } else {
      return res.status(401).json({ message: 'No credentials' })
    }

    const r = await fetch(url)
    if (!r.ok) return res.status(401).json({ message: 'Not authenticated' })
    const json = await r.json()
    if (json?.['subsonic-response']?.status !== 'ok') return res.status(401).json({ message: 'Not authenticated' })
    res.json({ status: 'ok', username: cred.username })
  } catch (err) {
    console.error('Navidrome check error', err)
    res.status(500).json({ message: 'Server error' })
  }
})

export default router
