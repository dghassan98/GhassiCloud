import { Router } from 'express'
import { getDb } from '../db/index.js'
import { v4 as uuidv4 } from 'uuid'
import { authenticateToken } from '../middleware/auth.js'

const router = Router()
export const AUDIT_CATEGORIES = {
  AUTH: 'authentication',
  USER: 'user_management',
  SERVICE: 'service_management',
  SETTINGS: 'settings',
  DATA: 'data_management',
  SECURITY: 'security',
  APPEARANCE: 'appearance'
}

export const AUDIT_ACTIONS = {
  LOGIN: 'login',
  LOGIN_FAILED: 'login_failed',
  LOGOUT: 'logout',
  SSO_LOGIN: 'sso_login',
  TOKEN_REFRESH: 'token_refresh',
  SESSION_REVOKED: 'session_revoked',
  
  USER_CREATED: 'user_created',
  USER_UPDATED: 'user_updated',
  USER_DELETED: 'user_deleted',
  USER_ROLE_CHANGED: 'user_role_changed',
  PASSWORD_CHANGED: 'password_changed',
  PROFILE_UPDATED: 'profile_updated',
  ROLE_CHANGED: 'role_changed',
  
  SERVICE_CREATED: 'service_created',
  SERVICE_UPDATED: 'service_updated',
  SERVICE_DELETED: 'service_deleted',
  SERVICE_ACCESSED: 'service_accessed',
  SERVICES_RESET: 'services_reset',
  
  SETTINGS_UPDATED: 'settings_updated',
  SSO_CONFIG_UPDATED: 'sso_config_updated',
  SSO_CONFIG_RESET: 'sso_config_reset',
  
  THEME_CHANGED: 'theme_changed',
  ACCENT_CHANGED: 'accent_changed',
  LOGO_CHANGED: 'logo_changed',
  
  DATA_EXPORTED: 'data_exported',
  DATA_IMPORTED: 'data_imported',
  
  FAILED_AUTH_ATTEMPT: 'failed_auth_attempt',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity'
}

/**
 * Log an audit event
 * @param {Object} params - Audit log parameters
 * @param {string} params.userId - User ID (optional for failed logins)
 * @param {string} params.username - Username
 * @param {string} params.action - Action performed (from AUDIT_ACTIONS)
 * @param {string} params.category - Category (from AUDIT_CATEGORIES)
 * @param {string} params.resourceType - Type of resource affected (optional)
 * @param {string} params.resourceId - ID of resource affected (optional)
 * @param {string} params.resourceName - Name of resource affected (optional)
 * @param {Object|string} params.details - Additional details (optional)
 * @param {string} params.ipAddress - IP address (optional)
 * @param {string} params.userAgent - User agent string (optional)
 * @param {string} params.status - 'success' or 'failure' (default: 'success')
 */
export function logAuditEvent({
  userId = null,
  username = null,
  action,
  category,
  resourceType = null,
  resourceId = null,
  resourceName = null,
  details = null,
  ipAddress = null,
  userAgent = null,
  status = 'success'
}) {
  try {
    const db = getDb()
    const id = uuidv4()
    const detailsStr = details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null
    
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, username, action, category, resource_type, resource_id, resource_name, details, ip_address, user_agent, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      userId,
      username,
      action,
      category,
      resourceType,
      resourceId,
      resourceName,
      detailsStr,
      ipAddress,
      userAgent,
      status
    )
    
    return id
  } catch (err) {
    logger.error('Failed to log audit event:', err)
    return null
  }
}

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) {
    const ips = forwarded.split(',')
    return ips[0].trim()
  }
  return req.ip || req.connection?.remoteAddress || null
}

router.get('/', authenticateToken, (req, res) => {
  try {
    // Only admins can view all logs, users can view their own
    const db = getDb()
    const isAdmin = req.user.role === 'admin'
    
    const {
      page = 1,
      limit = 50,
      userId,
      action,
      category,
      status,
      resourceType,
      startDate,
      endDate,
      search
    } = req.query
    
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50))
    const offset = (pageNum - 1) * limitNum
    
    const conditions = []
    const params = []
    
    // Non-admins can only see their own logs
    if (!isAdmin) {
      conditions.push('user_id = ?')
      params.push(req.user.id)
    } else if (userId) {
      conditions.push('user_id = ?')
      params.push(userId)
    }
    
    if (action) {
      conditions.push('action = ?')
      params.push(action)
    }
    
    if (category) {
      conditions.push('category = ?')
      params.push(category)
    }
    
    if (status) {
      conditions.push('status = ?')
      params.push(status)
    }
    
    if (resourceType) {
      conditions.push('resource_type = ?')
      params.push(resourceType)
    }
    
    if (startDate) {
      conditions.push('created_at >= ?')
      params.push(startDate)
    }
    
    if (endDate) {
      conditions.push('created_at <= ?')
      params.push(endDate)
    }
    
    if (search) {
      conditions.push('(username LIKE ? OR resource_name LIKE ? OR details LIKE ?)')
      const searchPattern = `%${search}%`
      params.push(searchPattern, searchPattern, searchPattern)
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    
    const countQuery = `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`
    const countResult = db.prepare(countQuery).get(...params)
    const total = countResult?.total || 0
    
    const logsQuery = `
      SELECT * FROM audit_logs 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `
    const logs = db.prepare(logsQuery).all(...params, limitNum, offset)
    
    const parsedLogs = logs.map(log => ({
      ...log,
      created_at: log.created_at ? (log.created_at.endsWith('Z') ? log.created_at : log.created_at + 'Z') : log.created_at,
      details: log.details ? tryParseJSON(log.details) : null
    }))
    
    res.json({
      logs: parsedLogs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    })
  } catch (err) {
    logger.error('Get audit logs error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

// Get audit log statistics (admin only)
router.get('/stats', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' })
    }
    
    const db = getDb()
    const { days = 30 } = req.query
    const daysNum = Math.min(365, Math.max(1, parseInt(days, 10) || 30))
    
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysNum)
    const startDateStr = startDate.toISOString()
    
    const totalResult = db.prepare(`
      SELECT COUNT(*) as total FROM audit_logs WHERE created_at >= ?
    `).get(startDateStr)
    
    const byCategory = db.prepare(`
      SELECT category, COUNT(*) as count 
      FROM audit_logs 
      WHERE created_at >= ?
      GROUP BY category
      ORDER BY count DESC
    `).all(startDateStr)
    
    const byAction = db.prepare(`
      SELECT action, COUNT(*) as count 
      FROM audit_logs 
      WHERE created_at >= ?
      GROUP BY action
      ORDER BY count DESC
      LIMIT 10
    `).all(startDateStr)
    
    const byStatus = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM audit_logs 
      WHERE created_at >= ?
      GROUP BY status
    `).all(startDateStr)
    
    const byDay = db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as count 
      FROM audit_logs 
      WHERE created_at >= ?
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `).all(startDateStr)
    
    const topUsers = db.prepare(`
      SELECT username, user_id, COUNT(*) as count 
      FROM audit_logs 
      WHERE created_at >= ? AND username IS NOT NULL
      GROUP BY user_id
      ORDER BY count DESC
      LIMIT 5
    `).all(startDateStr)
    
    const recentFailures = db.prepare(`
      SELECT * FROM audit_logs 
      WHERE status = 'failure' AND created_at >= ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(startDateStr)
    
    const loginStats = db.prepare(`
      SELECT 
        -- Count only SSO successful attempts (sso_login or legacy login with keycloak in details)
        SUM(CASE WHEN (action = 'sso_login' OR (action = 'login' AND details LIKE '%keycloak%')) AND status = 'success' THEN 1 ELSE 0 END) as successful_logins,
        -- Count only SSO-related failures (login_failed, sso_login failures, or legacy login failures that reference keycloak)
        SUM(CASE WHEN (action = 'login_failed' OR (action = 'sso_login' AND status = 'failure') OR (action = 'login' AND status = 'failure' AND details LIKE '%keycloak%')) THEN 1 ELSE 0 END) as failed_logins,
        -- Total sso_login events (regardless of status)
        SUM(CASE WHEN action = 'sso_login' THEN 1 ELSE 0 END) as sso_logins
      FROM audit_logs 
      WHERE created_at >= ?
    `).get(startDateStr)
    
    res.json({
      period: { days: daysNum, startDate: startDateStr },
      total: totalResult?.total || 0,
      byCategory,
      byAction,
      byStatus,
      byDay,
      topUsers,
      recentFailures: recentFailures.map(log => ({
        ...log,
        created_at: log.created_at ? (log.created_at.endsWith('Z') ? log.created_at : log.created_at + 'Z') : log.created_at,
        details: log.details ? tryParseJSON(log.details) : null
      })),
      loginStats: loginStats || { successful_logins: 0, failed_logins: 0, sso_logins: 0 }
    })
  } catch (err) {
    logger.error('Get audit stats error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

// Export audit logs as CSV (admin only)
router.get('/export/csv', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' })
    }
    
    const db = getDb()
    const { startDate, endDate, category, action } = req.query
    
    const conditions = []
    const params = []
    
    if (startDate) {
      conditions.push('created_at >= ?')
      params.push(startDate)
    }
    
    if (endDate) {
      conditions.push('created_at <= ?')
      params.push(endDate)
    }
    
    if (category) {
      conditions.push('category = ?')
      params.push(category)
    }
    
    if (action) {
      conditions.push('action = ?')
      params.push(action)
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    
    const logs = db.prepare(`
      SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT 10000
    `).all(...params)
    
    const headers = ['ID', 'Timestamp', 'User ID', 'Username', 'Action', 'Category', 'Resource Type', 'Resource ID', 'Resource Name', 'Status', 'IP Address', 'User Agent', 'Details']
    const csvRows = [headers.join(',')]
    
    for (const log of logs) {
      const timestamp = log.created_at ? (log.created_at.endsWith('Z') ? log.created_at : log.created_at + 'Z') : ''
      const row = [
        escapeCSV(log.id),
        escapeCSV(timestamp),
        escapeCSV(log.user_id || ''),
        escapeCSV(log.username || ''),
        escapeCSV(log.action),
        escapeCSV(log.category),
        escapeCSV(log.resource_type || ''),
        escapeCSV(log.resource_id || ''),
        escapeCSV(log.resource_name || ''),
        escapeCSV(log.status),
        escapeCSV(log.ip_address || ''),
        escapeCSV(log.user_agent || ''),
        escapeCSV(log.details || '')
      ]
      csvRows.push(row.join(','))
    }
    
    const csvContent = csvRows.join('\n')
    
    logAuditEvent({
      userId: req.user.id,
      username: req.user.username,
      action: AUDIT_ACTIONS.DATA_EXPORTED,
      category: AUDIT_CATEGORIES.DATA,
      resourceType: 'audit_logs',
      details: { format: 'csv', count: logs.length, filters: { startDate, endDate, category, action } },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent']
    })
    
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`)
    res.send(csvContent)
  } catch (err) {
    logger.error('Export CSV error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

router.get('/export/json', authenticateToken, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' })
    }
    
    const db = getDb()
    const { startDate, endDate, category, action } = req.query
    
    const conditions = []
    const params = []
    
    if (startDate) {
      conditions.push('created_at >= ?')
      params.push(startDate)
    }
    
    if (endDate) {
      conditions.push('created_at <= ?')
      params.push(endDate)
    }
    
    if (category) {
      conditions.push('category = ?')
      params.push(category)
    }
    
    if (action) {
      conditions.push('action = ?')
      params.push(action)
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    
    const logs = db.prepare(`
      SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT 10000
    `).all(...params)
    
    const parsedLogs = logs.map(log => ({
      ...log,
      created_at: log.created_at ? (log.created_at.endsWith('Z') ? log.created_at : log.created_at + 'Z') : log.created_at,
      details: log.details ? tryParseJSON(log.details) : null
    }))
    
    logAuditEvent({
      userId: req.user.id,
      username: req.user.username,
      action: AUDIT_ACTIONS.DATA_EXPORTED,
      category: AUDIT_CATEGORIES.DATA,
      resourceType: 'audit_logs',
      details: { format: 'json', count: logs.length, filters: { startDate, endDate, category, action } },
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent']
    })
    
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.json"`)
    res.json({
      exportedAt: new Date().toISOString(),
      exportedBy: req.user.username,
      totalRecords: parsedLogs.length,
      filters: { startDate, endDate, category, action },
      logs: parsedLogs
    })
  } catch (err) {
    logger.error('Export JSON error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

router.get('/filters', authenticateToken, (req, res) => {
  try {
    const db = getDb()
    const isAdmin = req.user.role === 'admin'
    
    const userCondition = isAdmin ? '' : 'WHERE user_id = ?'
    const params = isAdmin ? [] : [req.user.id]
    
    const categories = db.prepare(`SELECT DISTINCT category FROM audit_logs ${userCondition}`).all(...params)
    const actions = db.prepare(`SELECT DISTINCT action FROM audit_logs ${userCondition}`).all(...params)
    const statuses = db.prepare(`SELECT DISTINCT status FROM audit_logs ${userCondition}`).all(...params)
    const resourceTypesCondition = isAdmin ? 'WHERE resource_type IS NOT NULL' : 'WHERE user_id = ? AND resource_type IS NOT NULL'
    const resourceTypesParams = isAdmin ? [] : [req.user.id]
    const resourceTypes = db.prepare(`SELECT DISTINCT resource_type FROM audit_logs ${resourceTypesCondition}`).all(...resourceTypesParams)
    
    let users = []
    if (isAdmin) {
      users = db.prepare(`SELECT DISTINCT user_id, username FROM audit_logs WHERE username IS NOT NULL`).all()
    }
    
    res.json({
      categories: categories.map(c => c.category).filter(Boolean),
      actions: actions.map(a => a.action).filter(Boolean),
      statuses: statuses.map(s => s.status).filter(Boolean),
      resourceTypes: resourceTypes.map(r => r.resource_type).filter(Boolean),
      users
    })
  } catch (err) {
    logger.error('Get filters error:', err)
    res.status(500).json({ message: 'Server error' })
  }
})

function tryParseJSON(str) {
  try {
    return JSON.parse(str)
  } catch {
    return str
  }
}

function escapeCSV(value) {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export default router
