
import { Router } from 'express'
import { getDb } from '../db/index.js'
import { v4 as uuidv4 } from 'uuid'
import { authenticateToken } from '../middleware/auth.js'
import fetch from 'node-fetch'
import { logAuditEvent, getClientIp, AUDIT_ACTIONS, AUDIT_CATEGORIES } from './audit.js'

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
    logger.error('Ping services error:', err)
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
    logger.error('Check services error:', err)
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
    logger.error('Get services error:', err)
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
    logger.error('Get service error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

// Create service
router.post('/', authenticateToken, (req, res) => {
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
    
    // Log service creation
    logAuditEvent({
      userId: req.user.id,
      username: req.user.username,
      action: AUDIT_ACTIONS.SERVICE_CREATED,
      category: AUDIT_CATEGORIES.SERVICE,
      resourceType: 'service',
      resourceId: id,
      resourceName: name,
      details: { url, category },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      status: 'success'
    })
    
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
    logger.error('Create service error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

// Update service
router.put('/:id', authenticateToken, (req, res) => {
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
    
    // Log service update
    logAuditEvent({
      userId: req.user.id,
      username: req.user.username,
      action: AUDIT_ACTIONS.SERVICE_UPDATED,
      category: AUDIT_CATEGORIES.SERVICE,
      resourceType: 'service',
      resourceId: service.id,
      resourceName: service.name,
      details: { 
        changes: {
          name: name !== existing.name ? name : undefined,
          url: url !== existing.url ? url : undefined,
          pinned: pinned !== (existing.pinned === 1) ? pinned : undefined
        }
      },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      status: 'success'
    })
    
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
    logger.error('Update service error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

// Delete service
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb()
    const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id)
    
    if (!existing) {
      return res.status(404).json({ message: 'Service not found' })
    }
    
    db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id)
    
    // Log service deletion
    logAuditEvent({
      userId: req.user.id,
      username: req.user.username,
      action: AUDIT_ACTIONS.SERVICE_DELETED,
      category: AUDIT_CATEGORIES.SERVICE,
      resourceType: 'service',
      resourceId: existing.id,
      resourceName: existing.name,
      details: { url: existing.url },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      status: 'success'
    })
    
    res.json({ message: 'Service deleted successfully' })
  } catch (err) {
    logger.error('Delete service error:', err)
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
    logger.error('Bulk update error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

// Reset all services (protected)
router.delete('/reset/all', authenticateToken, (req, res) => {
  try {
    const db = getDb()
    
    // Count services before deletion for audit log
    const countResult = db.prepare('SELECT COUNT(*) as count FROM services').get()
    const count = countResult?.count || 0
    
    db.prepare('DELETE FROM services').run()
    
    // Log services reset
    logAuditEvent({
      userId: req.user.id,
      username: req.user.username,
      action: AUDIT_ACTIONS.SERVICES_RESET,
      category: AUDIT_CATEGORIES.SERVICE,
      resourceType: 'services',
      details: { deletedCount: count },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
      status: 'success'
    })
    
    res.json({ message: 'All services have been reset' })
  } catch (err) {
    logger.error('Reset services error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

export default router
