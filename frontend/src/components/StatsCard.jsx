import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function StatsCard({ label, value, trend, change, index }) {
  const trendIcons = {
    up: TrendingUp,
    down: TrendingDown,
    neutral: Minus
  }

  const trendColors = {
    up: '#22c55e',
    down: '#ef4444',
    neutral: '#64748b'
  }

  const TrendIcon = trendIcons[trend]

  return (
    <motion.div
      className="stats-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.1 }}
    >
      <div className="stats-content">
        <span className="stats-label">{label}</span>
        <span className="stats-value">{value}</span>
      </div>
      <div className="stats-trend" style={{ color: trendColors[trend] }}>
        <TrendIcon size={16} />
        <span>{change}</span>
      </div>
    </motion.div>
  )
}
