import { useEffect, useState, useRef } from 'react'
import { useRamadan } from '../context/RamadanContext'
import { isMobile, isNative } from '../hooks/useCapacitor'
import '../styles/ramadan.css'

/**
 * Animated Ramadan lantern SVG component
 */
function Lantern({ className = '', style = {}, size = 48, delay = 0, color = '#f5c842' }) {
  return (
    <div
      className={`ramadan-lantern ${className}`}
      style={{
        animationDelay: `${delay}s`,
        ...style
      }}
    >
      <svg width={size} height={size * 1.6} viewBox="0 0 60 96" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Chain / hook */}
        <line x1="30" y1="0" x2="30" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        <circle cx="30" cy="4" r="3" fill={color} opacity="0.5" />
        
        {/* Top cap */}
        <path d="M22 18 Q30 14 38 18 L36 22 H24 Z" fill={color} opacity="0.85" />
        
        {/* Lantern body */}
        <path d="M24 22 Q18 40 18 52 Q18 68 30 72 Q42 68 42 52 Q42 40 36 22 Z" fill={color} opacity="0.2" />
        <path d="M24 22 Q18 40 18 52 Q18 68 30 72 Q42 68 42 52 Q42 40 36 22 Z" stroke={color} strokeWidth="1.5" opacity="0.6" />
        
        {/* Inner glow */}
        <ellipse cx="30" cy="47" rx="8" ry="16" fill={color} opacity="0.15">
          <animate attributeName="opacity" values="0.1;0.25;0.1" dur="3s" repeatCount="indefinite" begin={`${delay}s`} />
        </ellipse>
        
        {/* Decorative arches */}
        <path d="M24 30 Q30 26 36 30" stroke={color} strokeWidth="1" opacity="0.4" fill="none" />
        <path d="M22 40 Q30 35 38 40" stroke={color} strokeWidth="1" opacity="0.4" fill="none" />
        <path d="M22 50 Q30 45 38 50" stroke={color} strokeWidth="1" opacity="0.4" fill="none" />
        <path d="M23 60 Q30 56 37 60" stroke={color} strokeWidth="1" opacity="0.4" fill="none" />
        
        {/* Bottom cap */}
        <path d="M26 70 Q30 76 34 70" fill={color} opacity="0.7" />
        <circle cx="30" cy="78" r="2" fill={color} opacity="0.5" />
        
        {/* Flame-like glow */}
        <ellipse cx="30" cy="47" rx="4" ry="8" fill="#fff" opacity="0.08">
          <animate attributeName="ry" values="7;9;7" dur="2s" repeatCount="indefinite" begin={`${delay + 0.5}s`} />
          <animate attributeName="opacity" values="0.05;0.12;0.05" dur="2s" repeatCount="indefinite" begin={`${delay + 0.5}s`} />
        </ellipse>
      </svg>
    </div>
  )
}

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
 * Diagonal corner ribbon component
 */
function CornerRibbon({ position = 'top-left', text = 'Ramadan Mubarak' }) {
  return (
    <div className={`ramadan-ribbon ramadan-ribbon-${position}`}>
      <span className="ramadan-ribbon-text">
        <CrescentStar size={14} color="#fff" style={{ marginRight: 4, verticalAlign: 'middle' }} />
        {text}
        <CrescentStar size={14} color="#fff" style={{ marginLeft: 4, verticalAlign: 'middle' }} />
      </span>
    </div>
  )
}

/**
 * Twinkling star particle
 */
function Star({ style, delay = 0 }) {
  return (
    <div className="ramadan-star" style={{ animationDelay: `${delay}s`, ...style }}>
      ✦
    </div>
  )
}

/**
 * Helper: short label for ribbon showing days until Ramadan
 */
function timeUntilLabel(startDateStr) {
  if (!startDateStr) return 'Ramadan Soon'
  const now = new Date()
  const start = new Date(startDateStr + 'T00:00:00')
  const diff = start.getTime() - now.getTime()
  if (diff <= 0) return 'Ramadan Mubarak'
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  return days === 1 ? 'Ramadan Tomorrow!' : `${days} Days to Ramadan`
}

/**
 * RamadanOverlay — decorative lanterns, ribbons, and ambient stars
 * Renders only when the Ramadan theme is active.
 */
export default function RamadanOverlay() {
  const { isRamadanActive, isPreRamadan, adminStartDate } = useRamadan()
  const [mounted, setMounted] = useState(false)
  const mobile = isMobile()

  useEffect(() => {
    if (isRamadanActive) {
      // Slight delay for entrance animation
      const t = setTimeout(() => setMounted(true), 100)
      return () => clearTimeout(t)
    } else {
      setMounted(false)
    }
  }, [isRamadanActive])

  if (!isRamadanActive) return null

  const lanternColors = ['#f5c842', '#e8a020', '#d4880c', '#f0d060', '#c97b2a']

  return (
    <div className={`ramadan-overlay ${mounted ? 'ramadan-overlay-visible' : ''}`} aria-hidden="true">
      {/* Corner ribbon — show greeting only when Ramadan has started, countdown text before */}
      <CornerRibbon
        position="top-right"
        text={isPreRamadan ? (timeUntilLabel(adminStartDate)) : 'Ramadan Mubarak'}
      />

      {/* Hanging lanterns — top of viewport */}
      <div className="ramadan-lanterns-row">
        {!mobile && (
          <>
            <Lantern size={32} delay={0} color={lanternColors[0]} style={{ left: '3%' }} />
            <Lantern size={26} delay={0.8} color={lanternColors[1]} style={{ left: '12%' }} />
            <Lantern size={22} delay={1.5} color={lanternColors[2]} style={{ left: '22%' }} />
          </>
        )}
        <Lantern size={mobile ? 22 : 28} delay={0.3} color={lanternColors[3]} style={{ right: mobile ? '5%' : '3%' }} />
        <Lantern size={mobile ? 18 : 24} delay={1.2} color={lanternColors[4]} style={{ right: mobile ? '18%' : '13%' }} />
        {!mobile && (
          <Lantern size={20} delay={2.0} color={lanternColors[0]} style={{ right: '24%' }} />
        )}
      </div>

      {/* Ambient twinkling stars scattered around */}
      <div className="ramadan-stars">
        <Star style={{ top: '8%', left: '8%' }} delay={0} />
        <Star style={{ top: '15%', right: '15%' }} delay={1.2} />
        <Star style={{ top: '25%', left: '45%' }} delay={2.5} />
        <Star style={{ top: '5%', right: '35%' }} delay={0.8} />
        {!mobile && (
          <>
            <Star style={{ top: '12%', left: '65%' }} delay={3.1} />
            <Star style={{ top: '20%', left: '30%' }} delay={1.8} />
            <Star style={{ top: '8%', right: '50%' }} delay={4.0} />
          </>
        )}
      </div>

      {/* Bottom decorative border */}
      <div className="ramadan-bottom-glow" />
    </div>
  )
}
