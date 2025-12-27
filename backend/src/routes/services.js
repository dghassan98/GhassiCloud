
import { Router } from 'express'
import { getDb } from '../db/index.js'
import { v4 as uuidv4 } from 'uuid'
import { authenticateToken } from '../middleware/auth.js'
import fetch from 'node-fetch'

const router = Router()

// Check online status of all services (ping)
router.get('/status/ping', async (req, res) => {
  try {
    const db = getDb()
    const services = db.prepare('SELECT id, name, url, description, icon, color FROM services').all()
    const results = await Promise.all(services.map(async (s) => {
      let online = false
      try {
        const response = await fetch(s.url, { method: 'GET', timeout: 4000 })
        online = response.ok
      } catch (e) {
        online = false
      }
      return { id: s.id, name: s.name, url: s.url, description: s.description, icon: s.icon, color: s.color, online }
    }))
    res.json({ status: 'ok', checkedAt: new Date().toISOString(), services: results })
  } catch (err) {
    console.error('Ping services error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

// Check online status for provided services (body: { services: [{id,name,url,...}] })
router.post('/status/check', async (req, res) => {
  try {
    const items = Array.isArray(req.body?.services) ? req.body.services : []
    // if nothing provided, return empty
    const results = await Promise.all(items.map(async (s) => {
      let online = false
      try {
        const response = await fetch(s.url, { method: 'GET', timeout: 4000 })
        online = response.ok
      } catch (e) {
        online = false
      }
      return { id: s.id, name: s.name, url: s.url, online }
    }))
    res.json({ status: 'ok', checkedAt: new Date().toISOString(), services: results })
  } catch (err) {
    console.error('Check services error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get all services
router.get('/', (req, res) => {
  try {
    const db = getDb()
    const services = db.prepare('SELECT * FROM services ORDER BY pinned DESC, sort_order, created_at DESC').all()
    
    res.json(services.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      url: s.url,
      icon: s.icon,
      color: s.color,
      status: s.status,
      category: s.category,
      useFavicon: s.use_favicon !== 0,
      pinned: s.pinned === 1
    })))
  } catch (err) {
    console.error('Get services error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get single service
router.get('/:id', (req, res) => {
  try {
    const db = getDb()
    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id)
    
    if (!service) {
      return res.status(404).json({ message: 'Service not found' })
    }
    
    res.json({
      id: service.id,
      name: service.name,
      description: service.description,
      url: service.url,
      icon: service.icon,
      color: service.color,
      status: service.status,
      category: service.category
    })
  } catch (err) {
    console.error('Get service error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

// Create service
router.post('/', (req, res) => {
  try {
    const { name, description, url, icon, color, status, category, useFavicon, pinned } = req.body
    const db = getDb()
    
    if (!name || !url) {
      return res.status(400).json({ message: 'Name and URL are required' })
    }
    
    const id = uuidv4()
    
    db.prepare(`
      INSERT INTO services (id, name, description, url, icon, color, status, category, use_favicon, pinned)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name,
      description || null,
      url,
      icon || 'cloud',
      color || '#6366f1',
      status || 'online',
      category || null,
      useFavicon !== false ? 1 : 0,
      pinned ? 1 : 0
    )
    
    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(id)
    
    res.status(201).json({
      id: service.id,
      name: service.name,
      description: service.description,
      url: service.url,
      icon: service.icon,
      color: service.color,
      status: service.status,
      category: service.category,
      useFavicon: service.use_favicon !== 0,
      pinned: service.pinned === 1
    })
  } catch (err) {
    console.error('Create service error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

// Update service
router.put('/:id', (req, res) => {
  try {
    const { name, description, url, icon, color, status, category, sortOrder, useFavicon, pinned } = req.body
    const db = getDb()
    
    const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id)
    
    if (!existing) {
      return res.status(404).json({ message: 'Service not found' })
    }
    
    db.prepare(`
      UPDATE services 
      SET name = ?, description = ?, url = ?, icon = ?, color = ?, status = ?, category = ?, sort_order = ?, use_favicon = ?, pinned = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name || existing.name,
      description !== undefined ? description : existing.description,
      url || existing.url,
      icon || existing.icon,
      color || existing.color,
      status || existing.status,
      category !== undefined ? category : existing.category,
      sortOrder !== undefined ? sortOrder : existing.sort_order,
      useFavicon !== undefined ? (useFavicon ? 1 : 0) : existing.use_favicon,
      pinned !== undefined ? (pinned ? 1 : 0) : existing.pinned,
      req.params.id
    )
    
    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id)
    
    res.json({
      id: service.id,
      name: service.name,
      description: service.description,
      url: service.url,
      icon: service.icon,
      color: service.color,
      status: service.status,
      category: service.category,
      useFavicon: service.use_favicon !== 0,
      pinned: service.pinned === 1
    })
  } catch (err) {
    console.error('Update service error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

// Delete service
router.delete('/:id', (req, res) => {
  try {
    const db = getDb()
    const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id)
    
    if (!existing) {
      return res.status(404).json({ message: 'Service not found' })
    }
    
    db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id)
    
    res.json({ message: 'Service deleted successfully' })
  } catch (err) {
    console.error('Delete service error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

// Bulk update order
router.put('/order/bulk', (req, res) => {
  try {
    const { services } = req.body
    const db = getDb()
    
    if (!Array.isArray(services)) {
      return res.status(400).json({ message: 'Services array required' })
    }
    
    // Update each service's sort order
    for (const item of services) {
      db.prepare('UPDATE services SET sort_order = ? WHERE id = ?').run(item.sortOrder, item.id)
    }
    
    res.json({ message: 'Order updated successfully' })
  } catch (err) {
    console.error('Bulk update error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

// Reset all services (protected)
router.delete('/reset/all', authenticateToken, (req, res) => {
  try {
    const db = getDb()
    db.prepare('DELETE FROM services').run()
    res.json({ message: 'All services have been reset' })
  } catch (err) {
    console.error('Reset services error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

export default router
