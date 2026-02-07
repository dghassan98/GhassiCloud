import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useRamadan } from '../context/RamadanContext'
import { useLanguage } from '../context/LanguageContext'
import { isMobile } from '../hooks/useCapacitor'

/**
 * Crescent moon and star SVG
 */
function CrescentStar({ size = 20, color = '#f5c842', style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={style}>
      <path d="M16 2C9.4 2 4 7.4 4 14s5.4 12 12 12c2.2 0 4.2-.6 6-1.6C18.8 22.8 16 19 16 14.6 16 10 18.8 6 22 4.4 20.2 2.8 18.2 2 16 2Z" fill={color} opacity="0.8" />
      <polygon points="26,6 27,9 30,9 27.5,11 28.5,14 26,12 23.5,14 24.5,11 22,9 25,9" fill={color} opacity="0.9" />
    </svg>
  )
}

/**
 * Circular progress ring for countdown digits
 */
function CountdownRing({ value, max, label, size = 56, id }) {
  const radius = (size - 6) / 2
  const circumference = 2 * Math.PI * radius
  const progress = max > 0 ? (value / max) : 0
  const offset = circumference * (1 - progress)

  return (
    <div className="rc-ring">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(245, 200, 66, 0.1)" strokeWidth="2.5"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={`url(#rc-grad-${id})`} strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
        <defs>
          <linearGradient id={`rc-grad-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f5c842" />
            <stop offset="100%" stopColor="#e8a020" />
          </linearGradient>
        </defs>
      </svg>
      <div className="rc-ring-inner">
        <span className="rc-ring-value">{String(value).padStart(2, '0')}</span>
        <span className="rc-ring-label">{label}</span>
      </div>
    </div>
  )
}

/**
 * Dashboard card showing a live countdown to Ramadan, matching weather-widget style.
 */
export default function RamadanCountdownCard() {
  const { isRamadanActive, isPreRamadan, adminStartDate } = useRamadan()
  const { t } = useLanguage()
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  const mobile = isMobile()

  useEffect(() => {
    if (!adminStartDate) return
    const target = new Date(adminStartDate + 'T00:00:00')

    const tick = () => {
      const now = new Date()
      const diff = target.getTime() - now.getTime()
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        return
      }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60)
      })
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [adminStartDate])

  // Only show when Ramadan theme is active but Ramadan hasn't started yet
  if (!isRamadanActive || !isPreRamadan || !adminStartDate) return null

  const ringSize = mobile ? 48 : 56

  return (
    <motion.div
      className="ramadan-countdown-widget"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      {/* Header */}
      <div className="rc-header">
        <CrescentStar size={18} color="#f5c842" />
        <span className="rc-title">{t('ramadan.countdownTitle') || 'Ramadan is coming'}</span>
        <CrescentStar size={18} color="#f5c842" />
      </div>

      {/* Rings row */}
      <div className="rc-rings">
        <CountdownRing value={timeLeft.days} max={30} label={t('ramadan.days') || 'Days'} size={ringSize} id="d" />
        <CountdownRing value={timeLeft.hours} max={24} label={t('ramadan.hours') || 'Hrs'} size={ringSize} id="h" />
        <CountdownRing value={timeLeft.minutes} max={60} label={t('ramadan.minutes') || 'Min'} size={ringSize} id="m" />
        <CountdownRing value={timeLeft.seconds} max={60} label={t('ramadan.seconds') || 'Sec'} size={ringSize} id="s" />
      </div>

      {/* Subtitle */}
      <div className="rc-subtitle">
        ✦ {t('ramadan.countdownSubtitle') || 'Prepare your heart and soul'} ✦
      </div>
    </motion.div>
  )
}
