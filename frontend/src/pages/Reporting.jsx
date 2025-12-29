import { motion } from 'framer-motion'
import { BarChart3, PieChart, TrendingUp, Calendar, Download, Filter } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import '../styles/dashboard.css' 

export default function Reporting() {
  const { t } = useLanguage()
  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>{t('reporting.title')}</h1>
          <p>{t('reporting.description')}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary">
            <Filter size={18} />
            Filter
          </button>
          <button className="btn btn-primary">
            <Download size={18} />
            Export
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <BarChart3 size={24} style={{ color: 'var(--accent)' }} />
          <div className="stat-content">
            <span className="stat-value">{t('reporting.usageAnalytics')}</span>
            <span className="stat-label">{t('reporting.comingSoon')}</span>
          </div>
        </motion.div>

        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <PieChart size={24} style={{ color: 'var(--accent)' }} />
          <div className="stat-content">
            <span className="stat-value">Service Distribution</span>
            <span className="stat-label">Coming Soon</span>
          </div>
        </motion.div>

        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <TrendingUp size={24} style={{ color: 'var(--accent)' }} />
          <div className="stat-content">
            <span className="stat-value">Uptime Trends</span>
            <span className="stat-label">Coming Soon</span>
          </div>
        </motion.div>

        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Calendar size={24} style={{ color: 'var(--accent)' }} />
          <div className="stat-content">
            <span className="stat-value">Activity Log</span>
            <span className="stat-label">Coming Soon</span>
          </div>
        </motion.div>
      </div>

      <div className="placeholder-section">
        <h2>Planned Features</h2>
        <ul className="feature-list">
          <li>Daily/Weekly/Monthly usage reports</li>
          <li>Service uptime history charts</li>
          <li>Most accessed services ranking</li>
          <li>Response time monitoring</li>
          <li>Export reports as PDF/CSV</li>
          <li>Custom date range filtering</li>
          <li>Email scheduled reports</li>
        </ul>
      </div>
    </div>
  )
}
