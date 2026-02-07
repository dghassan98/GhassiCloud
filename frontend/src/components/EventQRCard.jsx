import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ExternalLink, EyeOff, Sparkles, Ticket, ArrowRight } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { useWebview } from '../context/WebviewContext'
import { isPWA, isMobile } from '../hooks/useCapacitor'
import logger from '../logger'

export default function EventQRCard() {
  const { t } = useLanguage()
  const { openWebview } = useWebview()
  const [config, setConfig] = useState(null)
  const [hidden, setHidden] = useState(false)
  const [loading, setLoading] = useState(true)
  const mobile = isMobile()

  useEffect(() => {
    let cancelled = false
    const fetchConfig = async () => {
      try {
        const token = localStorage.getItem('ghassicloud-token')
        const res = await fetch('/api/auth/event-qr', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        })
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) setConfig(data)
        }
      } catch (err) {
        logger.error('Failed to fetch event config:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchConfig()

    // Listen for admin settings updates
    const onSettingsUpdate = (e) => {
      const d = e.detail
      if (d && (d.key === 'eventQrUrl' || d.key === 'eventQrLabel' || d.key === 'eventQrVisible')) {
        fetchConfig()
      }
    }
    window.addEventListener('ghassicloud:settings-updated', onSettingsUpdate)
    return () => {
      cancelled = true
      window.removeEventListener('ghassicloud:settings-updated', onSettingsUpdate)
    }
  }, [])

  // Don't render if not visible, not configured, or loading
  if (loading || !config || !config.visible || !config.url) return null
  if (hidden) return null

  const qrSize = 120
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(config.url)}&bgcolor=0f1724&color=ffffff&margin=1`

  const handleClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (isPWA() && !isMobile()) {
      openWebview(config.url, config.label || 'Event')
    } else {
      window.open(config.url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className={`event-qr-card${mobile ? ' event-card-mobile' : ''}`}
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {/* Dismiss button */}
        <button
          className="event-qr-dismiss"
          onClick={(e) => { e.stopPropagation(); setHidden(true) }}
          title={t('eventQr.hide') || 'Hide'}
          aria-label={t('eventQr.hide') || 'Hide'}
        >
          <EyeOff size={14} />
        </button>

        {/* Sparkle accent */}
        <div className="event-qr-accent">
          <Sparkles size={16} />
          <span>{t('eventQr.featured') || 'Featured'}</span>
        </div>

        {mobile ? (
          /* ── Mobile: Ticket-style event banner ── */
          <>
            <a
              href={config.url}
              onClick={handleClick}
              className="event-card-mobile-hero"
              rel="noopener noreferrer"
            >
              <div className="event-card-mobile-icon">
                <Ticket size={32} />
              </div>
              {config.label && (
                <span className="event-card-mobile-label">{config.label}</span>
              )}
              <span className="event-card-mobile-cta">
                {t('eventQr.openEvent') || 'Open Event'}
                <ArrowRight size={14} />
              </span>
            </a>
            <div className="event-qr-info">
              <a
                href={config.url}
                onClick={handleClick}
                className="event-qr-url"
                rel="noopener noreferrer"
              >
                <ExternalLink size={12} />
                <span>{config.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
              </a>
            </div>
          </>
        ) : (
          /* ── Desktop: Scannable QR code ── */
          <>
            <a
              href={config.url}
              onClick={handleClick}
              className="event-qr-link"
              rel="noopener noreferrer"
              title={t('eventQr.scanOrClick') || 'Scan or click to visit'}
            >
              <div className="event-qr-image-wrap">
                <img
                  src={qrImageUrl}
                  alt={config.label || 'Event'}
                  width={qrSize}
                  height={qrSize}
                  loading="eager"
                />
                <div className="event-qr-glow" />
              </div>
            </a>
            <div className="event-qr-info">
              {config.label && (
                <span className="event-qr-label">{config.label}</span>
              )}
              <a
                href={config.url}
                onClick={handleClick}
                className="event-qr-url"
                rel="noopener noreferrer"
              >
                <ExternalLink size={12} />
                <span>{config.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
              </a>
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
