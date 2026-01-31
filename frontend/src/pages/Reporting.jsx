import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  BarChart3, PieChart, TrendingUp, Calendar, Download, Filter, 
  RefreshCw, Search, ChevronLeft, ChevronRight, AlertTriangle,
  CheckCircle, XCircle, User, Shield, Settings, Database,
  LogIn, LogOut, Edit, Trash2, Plus, FileText, Clock, Activity
} from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import logger from '../logger'
import '../styles/reporting.css'

const ACTION_ICONS = {
  login: LogIn,
  login_failed: XCircle,
  logout: LogOut,
  sso_login: LogIn,
  password_changed: Shield,
  profile_updated: User,
  service_created: Plus,
  service_updated: Edit,
  service_deleted: Trash2,
  services_reset: Database,
  settings_updated: Settings,
  data_exported: Download,
  data_imported: FileText,
  default: Activity
}

const CATEGORY_COLORS = {
  authentication: '#3b82f6',
  user_management: '#8b5cf6',
  service_management: '#10b981',
  settings: '#f59e0b',
  data_management: '#06b6d4',
  security: '#ef4444',
  appearance: '#ec4899'
}

export default function Reporting() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  
  const [activeTab, setActiveTab] = useState('activity')
  const [logs, setLogs] = useState([])
  const [stats, setStats] = useState(null)
  const [filters, setFilters] = useState(null)
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedAction, setSelectedAction] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [showFilters, setShowFilters] = useState(false)
  
  const [exporting, setExporting] = useState(false)
  
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedLog, setSelectedLog] = useState(null)
  
  const token = localStorage.getItem('ghassicloud-token')
  
  const fetchLogs = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams({ page, limit: 25 })
      if (selectedCategory) params.append('category', selectedCategory)
      if (selectedAction) params.append('action', selectedAction)
      if (selectedStatus) params.append('status', selectedStatus)
      if (selectedUser) params.append('userId', selectedUser)
      if (searchQuery) params.append('search', searchQuery)
      if (dateRange.start) params.append('startDate', dateRange.start)
      if (dateRange.end) params.append('endDate', dateRange.end)
      
      const res = await fetch(`/api/audit?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (!res.ok) throw new Error('Failed to fetch audit logs')
      
      const data = await res.json()
      setLogs(data.logs || [])
      setTotalPages(data.pagination?.totalPages || 1)
      setTotal(data.pagination?.total || 0)
    } catch (err) {
      logger.error('Fetch logs error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token, page, selectedCategory, selectedAction, selectedStatus, selectedUser, searchQuery, dateRange])
  
  const fetchStats = useCallback(async () => {
    if (!token || !isAdmin) {
      setStatsLoading(false)
      return
    }
    setStatsLoading(true)
    
    try {
      const res = await fetch('/api/audit/stats?days=30', {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (!res.ok) throw new Error('Failed to fetch stats')
      
      const data = await res.json()
      setStats(data)
    } catch (err) {
      logger.error('Fetch stats error:', err)
    } finally {
      setStatsLoading(false)
    }
  }, [token, isAdmin])
  
  const fetchFilters = useCallback(async () => {
    if (!token) return
    
    try {
      const res = await fetch('/api/audit/filters', {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (res.ok) {
        const data = await res.json()
        setFilters(data)
      }
    } catch (err) {
      logger.error('Fetch filters error:', err)
    }
  }, [token])
  
  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])
  
  useEffect(() => {
    fetchStats()
    fetchFilters()
  }, [fetchStats, fetchFilters])
  
  const handleExport = async (format) => {
    if (!token || !isAdmin) return
    setExporting(true)
    
    try {
      const params = new URLSearchParams()
      if (selectedCategory) params.append('category', selectedCategory)
      if (selectedAction) params.append('action', selectedAction)
      if (dateRange.start) params.append('startDate', dateRange.start)
      if (dateRange.end) params.append('endDate', dateRange.end)
      
      const res = await fetch(`/api/audit/export/${format}?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Export failed' }))
        logger.error('Export error:', res.status, errorData)
        throw new Error(errorData.message || `Export failed with status ${res.status}`)
      }
      
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      a.remove()
      setError(null)
    } catch (err) {
      logger.error('Export error:', err)
      setError(err.message || 'Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }
  
  const formatTimestamp = (ts) => {
    if (!ts) return '-'
    const date = new Date(ts)
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  
  const formatAction = (action) => {
    if (!action) return '-'
    return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace(/\bSso\b/g, 'SSO')
  }
  
  const formatCategory = (category) => {
    if (!category) return '-'
    return category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }
  
  const getActionIcon = (action) => {
    const IconComponent = ACTION_ICONS[action] || ACTION_ICONS.default
    return <IconComponent size={16} />
  }
  
  const clearFilters = () => {
    setSelectedCategory('')
    setSelectedAction('')
    setSelectedStatus('')
    setSelectedUser('')
    setSearchQuery('')
    setDateRange({ start: '', end: '' })
    setPage(1)
  }
  
  const hasActiveFilters = selectedCategory || selectedAction || selectedStatus || selectedUser || searchQuery || dateRange.start || dateRange.end

  return (
    <div className="reporting-page">
      {/* Header */}
      <div className="reporting-header">
        <div className="header-content">
          <h1>{t('reporting.title')}</h1>
          <p>{t('reporting.subtitle') || 'Audit logs and activity tracking'}</p>
        </div>
        <div className="header-actions">
          {isAdmin && (
            <div className="export-dropdown">
              <button 
                className="btn btn-secondary"
                disabled={exporting}
                onClick={() => document.getElementById('export-menu').classList.toggle('show')}
              >
                <Download size={18} />
                {exporting ? 'Exporting...' : t('reporting.export') || 'Export'}
              </button>
              <div id="export-menu" className="export-menu">
                <button onClick={() => handleExport('csv')}>
                  <FileText size={16} />
                  Export as CSV
                </button>
                <button onClick={() => handleExport('json')}>
                  <FileText size={16} />
                  Export as JSON
                </button>
              </div>
            </div>
          )}
          <button 
            className="btn btn-icon"
            onClick={() => { fetchLogs(); fetchStats(); }}
            title="Refresh"
          >
            <RefreshCw size={18} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>
      
      {/* Stats Cards (Admin only) */}
      {isAdmin && (
        <div className="stats-overview">
          <motion.div 
            className="stat-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
              <Activity size={24} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{statsLoading ? '...' : (stats?.total || 0)}</span>
              <span className="stat-label">{t('reporting.totalEvents') || 'Total Events'}</span>
              <span className="stat-period">Last 30 days</span>
            </div>
          </motion.div>
          
          <motion.div 
            className="stat-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              <LogIn size={24} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{statsLoading ? '...' : (stats?.loginStats?.successful_logins || 0)}</span>
              <span className="stat-label">{t('reporting.successfulLogins') || 'Successful Logins'}</span>
              <span className="stat-period">Last 30 days</span>
            </div>
          </motion.div>
          
          <motion.div 
            className="stat-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
              <AlertTriangle size={24} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{statsLoading ? '...' : (stats?.loginStats?.failed_logins || 0)}</span>
              <span className="stat-label">{t('reporting.failedLogins') || 'Failed Logins'}</span>
              <span className="stat-period">Last 30 days</span>
            </div>
          </motion.div>
          
          <motion.div 
            className="stat-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}>
              <User size={24} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{statsLoading ? '...' : (stats?.topUsers?.length || 0)}</span>
              <span className="stat-label">{t('reporting.activeUsers') || 'Active Users'}</span>
              <span className="stat-period">Last 30 days</span>
            </div>
          </motion.div>
        </div>
      )}
      
      {/* Tabs */}
      <div className="reporting-tabs">
        <button 
          className={`tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          <Clock size={18} />
          {t('reporting.activityLog') || 'Activity Log'}
        </button>
        {isAdmin && (
          <>
            <button 
              className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              <BarChart3 size={18} />
              {t('reporting.analytics') || 'Analytics'}
            </button>
            <button 
              className={`tab-btn ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <Shield size={18} />
              {t('reporting.security') || 'Security'}
            </button>
          </>
        )}
      </div>
      
      {/* Activity Log Tab */}
      {activeTab === 'activity' && (
        <motion.div 
          className="reporting-section"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {/* Filters Bar */}
          <div className="filters-bar">
            <div className="search-box">
              <Search size={18} />
              <input
                type="text"
                placeholder={t('reporting.searchPlaceholder') || 'Search logs...'}
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              />
            </div>
            
            <button 
              className={`btn btn-filter ${showFilters ? 'active' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter size={18} />
              {t('reporting.filters') || 'Filters'}
              {hasActiveFilters && <span className="filter-badge">{[selectedCategory, selectedAction, selectedStatus, selectedUser, dateRange.start].filter(Boolean).length}</span>}
            </button>
            
            {hasActiveFilters && (
              <button className="btn btn-text" onClick={clearFilters}>
                Clear all
              </button>
            )}
            
            <div className="results-count">
              {total} {total === 1 ? 'result' : 'results'}
            </div>
          </div>
          
          {/* Expanded Filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div 
                className="filters-expanded"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                <div className="filter-row">
                  <div className="filter-group">
                    <label>Category</label>
                    <select 
                      value={selectedCategory} 
                      onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
                    >
                      <option value="">All Categories</option>
                      {filters?.categories?.map(cat => (
                        <option key={cat} value={cat}>{formatCategory(cat)}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="filter-group">
                    <label>Action</label>
                    <select 
                      value={selectedAction} 
                      onChange={(e) => { setSelectedAction(e.target.value); setPage(1); }}
                    >
                      <option value="">All Actions</option>
                      {filters?.actions?.map(action => (
                        <option key={action} value={action}>{formatAction(action)}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="filter-group">
                    <label>Status</label>
                    <select 
                      value={selectedStatus} 
                      onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
                    >
                      <option value="">All Statuses</option>
                      <option value="success">Success</option>
                      <option value="failure">Failure</option>
                    </select>
                  </div>
                  
                  {isAdmin && filters?.users?.length > 0 && (
                    <div className="filter-group">
                      <label>User</label>
                      <select 
                        value={selectedUser} 
                        onChange={(e) => { setSelectedUser(e.target.value); setPage(1); }}
                      >
                        <option value="">All Users</option>
                        {filters.users.map(u => (
                          <option key={u.user_id} value={u.user_id}>{u.username}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  <div className="filter-group">
                    <label>Start Date</label>
                    <input 
                      type="date" 
                      value={dateRange.start}
                      onChange={(e) => { setDateRange(prev => ({ ...prev, start: e.target.value })); setPage(1); }}
                    />
                  </div>
                  
                  <div className="filter-group">
                    <label>End Date</label>
                    <input 
                      type="date" 
                      value={dateRange.end}
                      onChange={(e) => { setDateRange(prev => ({ ...prev, end: e.target.value })); setPage(1); }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Logs Table */}
          {error && (
            <div className="error-message">
              <AlertTriangle size={18} />
              {error}
            </div>
          )}
          
          {loading ? (
            <div className="loading-state">
              <RefreshCw size={32} className="spin" />
              <p>Loading audit logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="empty-state">
              <FileText size={48} />
              <h3>No audit logs found</h3>
              <p>Activity will appear here as users interact with the system.</p>
            </div>
          ) : (
            <>
              <div className="logs-table-container">
                <table className="logs-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>User</th>
                      <th>IP Address</th>
                      <th>Action</th>
                      <th>Category</th>
                      {logs.some(log => log.resource_name || log.resource_type) && <th>Resource</th>}
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, idx) => (
                      <motion.tr 
                        key={log.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className={log.status === 'failure' ? 'failure-row' : ''}
                        onClick={() => {
                          setSelectedLog(log)
                          setShowDetailModal(true)
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="timestamp-cell">
                          <Clock size={14} />
                          {formatTimestamp(log.created_at)}
                        </td>
                        <td className="user-cell">
                          <User size={14} />
                          {log.username || 'System'}
                        </td>
                        <td className="ip-cell">
                          {log.ip_address || '-'}
                        </td>
                        <td className="action-cell">
                          <span className="action-badge">
                            {getActionIcon(log.action)}
                            {formatAction(log.action)}
                          </span>
                        </td>
                        <td className="category-cell">
                          <span 
                            className="category-badge"
                            style={{ '--category-color': CATEGORY_COLORS[log.category] || '#64748b' }}
                          >
                            {formatCategory(log.category)}
                          </span>
                        </td>
                        {logs.some(log => log.resource_name || log.resource_type) && (
                          <td className="resource-cell">
                            {log.resource_name || log.resource_type || '-'}
                          </td>
                        )}
                        <td className="status-cell">
                          <span className={`status-badge ${log.status}`}>
                            {log.status === 'success' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                            {log.status}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              <div className="pagination">
                <button 
                  className="btn btn-icon"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="page-info">
                  Page {page} of {totalPages}
                </span>
                <button 
                  className="btn btn-icon"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </>
          )}
        </motion.div>
      )}
      
      {/* Analytics Tab (Admin only) */}
      {activeTab === 'analytics' && isAdmin && (
        <motion.div 
          className="reporting-section"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="analytics-grid">
            {/* Activity by Category */}
            <div className="analytics-card">
              <h3><PieChart size={20} /> Activity by Category</h3>
              {statsLoading ? (
                <div className="loading-state small">
                  <RefreshCw size={24} className="spin" />
                </div>
              ) : (
                <div className="category-breakdown">
                  {stats?.byCategory?.map(cat => (
                    <div key={cat.category} className="breakdown-item">
                      <div className="breakdown-label">
                        <span 
                          className="color-dot"
                          style={{ background: CATEGORY_COLORS[cat.category] || '#64748b' }}
                        />
                        {formatCategory(cat.category)}
                      </div>
                      <div className="breakdown-bar">
                        <div 
                          className="breakdown-fill"
                          style={{ 
                            width: `${(cat.count / (stats?.total || 1)) * 100}%`,
                            background: CATEGORY_COLORS[cat.category] || '#64748b'
                          }}
                        />
                      </div>
                      <span className="breakdown-count">{cat.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Top Actions */}
            <div className="analytics-card">
              <h3><BarChart3 size={20} /> Top Actions</h3>
              {statsLoading ? (
                <div className="loading-state small">
                  <RefreshCw size={24} className="spin" />
                </div>
              ) : (
                <div className="top-actions-list">
                  {stats?.byAction?.slice(0, 8).map((action, idx) => (
                    <div key={action.action} className="action-item">
                      <span className="action-rank">{idx + 1}</span>
                      <span className="action-name">{formatAction(action.action)}</span>
                      <span className="action-count">{action.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Most Active Users */}
            <div className="analytics-card">
              <h3><User size={20} /> Most Active Users</h3>
              {statsLoading ? (
                <div className="loading-state small">
                  <RefreshCw size={24} className="spin" />
                </div>
              ) : stats?.topUsers?.length > 0 ? (
                <div className="top-users-list">
                  {stats.topUsers.map((u, idx) => (
                    <div key={u.user_id} className="user-item">
                      <span className="user-rank">{idx + 1}</span>
                      <span className="user-avatar">
                        <User size={16} />
                      </span>
                      <span className="user-name">{u.username}</span>
                      <span className="user-count">{u.count} actions</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state small">
                  <p>No user activity recorded</p>
                </div>
              )}
            </div>
            
            {/* Activity Timeline (simplified) */}
            <div className="analytics-card wide">
              <h3><TrendingUp size={20} /> Activity Over Time</h3>
              {statsLoading ? (
                <div className="loading-state small">
                  <RefreshCw size={24} className="spin" />
                </div>
              ) : stats?.byDay?.length > 0 ? (
                <div className="activity-timeline">
                  {stats.byDay.slice(-14).map(day => {
                    const maxCount = Math.max(...stats.byDay.map(d => d.count))
                    const heightPercent = maxCount > 0 ? (day.count / maxCount) * 100 : 0
                    return (
                      <div key={day.date} className="timeline-bar-container">
                        <div 
                          className="timeline-bar"
                          style={{ height: `${Math.max(heightPercent, 5)}%` }}
                          title={`${day.date}: ${day.count} events`}
                        />
                        <span className="timeline-label">
                          {new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="empty-state small">
                  <p>No activity data available</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
      
      {/* Security Tab (Admin only) */}
      {activeTab === 'security' && isAdmin && (
        <motion.div 
          className="reporting-section"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="security-grid">
            {/* Login Overview */}
            <div className="security-card">
              <h3><LogIn size={20} /> Login Overview</h3>
              {statsLoading ? (
                <div className="loading-state small">
                  <RefreshCw size={24} className="spin" />
                </div>
              ) : (
                <div className="login-stats">
                  <div className="login-stat success">
                    <CheckCircle size={24} />
                    <div>
                      <span className="value">{stats?.loginStats?.successful_logins || 0}</span>
                      <span className="label">Successful</span>
                    </div>
                  </div>
                  <div className="login-stat failure">
                    <XCircle size={24} />
                    <div>
                      <span className="value">{stats?.loginStats?.failed_logins || 0}</span>
                      <span className="label">Failed</span>
                    </div>
                  </div>
                  <div className="login-stat sso">
                    <Shield size={24} />
                    <div>
                      <span className="value">{stats?.loginStats?.sso_logins || 0}</span>
                      <span className="label">SSO Logins</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Recent Failures */}
            <div className="security-card wide">
              <h3><AlertTriangle size={20} /> Recent Failed Events</h3>
              {statsLoading ? (
                <div className="loading-state small">
                  <RefreshCw size={24} className="spin" />
                </div>
              ) : stats?.recentFailures?.length > 0 ? (
                <div className="failures-list">
                  {stats.recentFailures.map(failure => (
                    <div key={failure.id} className="failure-item">
                      <div className="failure-icon">
                        <AlertTriangle size={16} />
                      </div>
                      <div className="failure-info">
                        <span className="failure-action">{formatAction(failure.action)}</span>
                        <span className="failure-user">{failure.username || 'Unknown'}</span>
                        <span className="failure-time">{formatTimestamp(failure.created_at)}</span>
                      </div>
                      <div className="failure-details">
                        {failure.ip_address && <span className="failure-ip">{failure.ip_address}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state small success">
                  <CheckCircle size={32} />
                  <p>No recent failures detected</p>
                </div>
              )}
            </div>
            
            {/* Status Distribution */}
            <div className="security-card">
              <h3><PieChart size={20} /> Status Distribution</h3>
              {statsLoading ? (
                <div className="loading-state small">
                  <RefreshCw size={24} className="spin" />
                </div>
              ) : (
                <div className="status-distribution">
                  {stats?.byStatus?.map(s => {
                    const total = stats.byStatus.reduce((acc, curr) => acc + curr.count, 0)
                    const percent = total > 0 ? ((s.count / total) * 100).toFixed(1) : 0
                    return (
                      <div key={s.status} className={`status-item ${s.status}`}>
                        <div className="status-header">
                          {s.status === 'success' ? <CheckCircle size={18} /> : <XCircle size={18} />}
                          <span className="status-name">{s.status}</span>
                        </div>
                        <div className="status-bar">
                          <div 
                            className="status-fill"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="status-percent">{percent}%</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedLog && (
        <motion.div 
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setShowDetailModal(false)}
        >
          <motion.div 
            className="log-detail-modal"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
          <div className="modal-header">
            <h3>Activity Log Details</h3>
            <button 
              className="modal-close"
              onClick={() => setShowDetailModal(false)}
            >
              ×
            </button>
          </div>
          
          <div className="modal-body">
            <div className="detail-grid">
              <div className="detail-item">
                <label>Timestamp</label>
                <div>{formatTimestamp(selectedLog.created_at)}</div>
              </div>
              
              <div className="detail-item">
                <label>User</label>
                <div>{selectedLog.username || 'System'}</div>
              </div>
              
              <div className="detail-item">
                <label>IP Address</label>
                <div className="detail-code">{selectedLog.ip_address || '-'}</div>
              </div>
              
              <div className="detail-item">
                <label>User Agent</label>
                <div className="detail-code">{selectedLog.user_agent || '-'}</div>
              </div>
              
              <div className="detail-item">
                <label>Action</label>
                <div>
                  <span className="action-badge">
                    {getActionIcon(selectedLog.action)}
                    {formatAction(selectedLog.action)}
                  </span>
                </div>
              </div>
              
              <div className="detail-item">
                <label>Category</label>
                <div>
                  <span 
                    className="category-badge"
                    style={{ '--category-color': CATEGORY_COLORS[selectedLog.category] || '#64748b' }}
                  >
                    {formatCategory(selectedLog.category)}
                  </span>
                </div>
              </div>
              
              <div className="detail-item">
                <label>Status</label>
                <div>
                  <span className={`status-badge ${selectedLog.status}`}>
                    {selectedLog.status === 'success' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                    {selectedLog.status}
                  </span>
                </div>
              </div>
              
              {selectedLog.resource_name && (
                <div className="detail-item">
                  <label>Resource</label>
                  <div>{selectedLog.resource_name}</div>
                </div>
              )}
              
              {selectedLog.details && (
                <div className="detail-item full-width">
                  <label>Additional Details</label>
                  <pre className="detail-json">
                    {typeof selectedLog.details === 'object' 
                      ? JSON.stringify(selectedLog.details, null, 2)
                      : selectedLog.details}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    )}
    </div>
  )
}
