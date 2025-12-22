import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { getDb } from '../db/index.js'
import { authenticateToken, generateToken } from '../middleware/auth.js'

const router = Router()

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
        role: user.role
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
        role: user.role
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
    const { email, displayName } = req.body
    const db = getDb()

    db.prepare('UPDATE users SET email = ?, display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(email || null, displayName || null, req.user.id)

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        role: user.role
      }
    })
  } catch (err) {
    console.error('Update profile error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

export default router
