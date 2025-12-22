import { Router } from 'express'
import { getDb } from '../db/index.js'
import { v4 as uuidv4 } from 'uuid'

const router = Router()

// Get all services
router.get('/', (req, res) => {
  try {
    const db = getDb()
    const services = db.prepare('SELECT * FROM services ORDER BY sort_order, created_at DESC').all()
    
    res.json(services.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      url: s.url,
      icon: s.icon,
      color: s.color,
      status: s.status,
      category: s.category,
      useFavicon: s.use_favicon !== 0
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
    const { name, description, url, icon, color, status, category, useFavicon } = req.body
    const db = getDb()
    
    if (!name || !url) {
      return res.status(400).json({ message: 'Name and URL are required' })
    }
    
    const id = uuidv4()
    
    db.prepare(`
      INSERT INTO services (id, name, description, url, icon, color, status, category, use_favicon)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name,
      description || null,
      url,
      icon || 'cloud',
      color || '#6366f1',
      status || 'online',
      category || null,
      useFavicon !== false ? 1 : 0
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
      useFavicon: service.use_favicon !== 0
    })
  } catch (err) {
    console.error('Create service error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

// Update service
router.put('/:id', (req, res) => {
  try {
    const { name, description, url, icon, color, status, category, sortOrder, useFavicon } = req.body
    const db = getDb()
    
    const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id)
    
    if (!existing) {
      return res.status(404).json({ message: 'Service not found' })
    }
    
    db.prepare(`
      UPDATE services 
      SET name = ?, description = ?, url = ?, icon = ?, color = ?, status = ?, category = ?, sort_order = ?, use_favicon = ?, updated_at = CURRENT_TIMESTAMP
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
      useFavicon: service.use_favicon !== 0
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

export default router
