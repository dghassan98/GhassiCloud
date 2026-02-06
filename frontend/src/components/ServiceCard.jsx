import { motion } from 'framer-motion'
import { ExternalLink, MoreVertical, Edit2, Trash2, Pin, RefreshCw, AlertTriangle } from 'lucide-react' 
import { useState, useEffect, useRef } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { useHaptics, isNative, isPWA, isMobile } from '../hooks/useCapacitor'
import { useWebview } from '../context/WebviewContext'
import { ensureSessionReady, getSessionWarmedUp } from '../hooks/ssoSessionBridge'
import logger from '../logger'

const FAVICON_PATHS = [
  '/favicon.ico',
  '/favicon.png', 
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png'
]

export default function ServiceCard({ service, iconMap, index, viewMode, onDelete, onEdit, onPin, onCheck }) {
  const { t } = useLanguage()
  const { impact, notification } = useHaptics()
  const descText = service.descriptionKey ? t(service.descriptionKey) : service.description
  const [showMenu, setShowMenu] = useState(false)
  const [faviconError, setFaviconError] = useState(false)
  const [faviconPathIndex, setFaviconPathIndex] = useState(0)
  const rootRef = useRef(null)
  const authBtnRef = useRef(null)
  const [authOpen, setAuthOpen] = useState(false)

  const Icon = iconMap[service.icon] || iconMap.default

  const showAuthLabel = () => {
    setAuthOpen(true)
  }
  const hideAuthLabel = () => {
    setAuthOpen(false)
  }
  const toggleAuthLabel = (e) => {
    e.stopPropagation()
    e.preventDefault()
    if (authOpen) hideAuthLabel()
    else showAuthLabel()
  }
  useEffect(() => {
    const onDoc = (ev) => {
      if (authBtnRef.current && authBtnRef.current.contains(ev.target)) return
      if (authOpen) hideAuthLabel()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
    }
  }, [authOpen])

  useEffect(() => {
    const onDocClick = (ev) => {
      if (!authOpen) return
      if (authBtnRef.current && authBtnRef.current.contains(ev.target)) return
      hideAuthLabel()
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('touchstart', onDocClick)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('touchstart', onDocClick)
    }
  }, [authOpen])
  
  const getFaviconUrl = () => {
    if (service.useFavicon === false) return null
    try {
      // Local override for GhassiMusic: prefer our bundled asset
      const hostname = new URL(service.url).hostname
      if (hostname === 'music.ghassi.cloud' || (service.name && service.name.toLowerCase().includes('ghassimusic')) ) {
        return '/logos/ghassi_music.png'
      }

      const origin = new URL(service.url).origin
      if (faviconPathIndex < FAVICON_PATHS.length) {
        return `${origin}${FAVICON_PATHS[faviconPathIndex]}`
      }
      const domain = hostname
      return `https://icons.duckduckgo.com/ip3/${domain}.ico`
    } catch {
      return null
    }
  }
  
  const faviconUrl = getFaviconUrl()
  const showFavicon = faviconUrl && !faviconError
  
  const handleFaviconError = () => {
    if (faviconPathIndex < FAVICON_PATHS.length) {
      setFaviconPathIndex(prev => prev + 1)
    } else {
      logger.warn(`Favicon load failed for service ${service.name} (${service.url})`)
      setFaviconError(true)
    }
  }

  const statusColors = {
    online: '#22c55e',
    offline: '#ef4444',
    warning: '#f59e0b'
  }

  const { openWebview } = useWebview()

  const handleClick = async (e) => {
    if (e.target.closest('.card-menu') || e.target.closest('.menu-button') || e.target.closest('.pin-button')) {
      logger.debug('ServiceCard: Click on menu or pin button, not opening service')
      return
    }

    // If SSO session wasn't warmed up on startup (cookies lost after browser restart),
    // try to restore it now before opening the service iframe.
    // This prevents the service from showing the Keycloak login page.
    const isSSO = localStorage.getItem('ghassicloud-sso') === 'true'
    if (isSSO && !getSessionWarmedUp()) {
      logger.info('ServiceCard: SSO session not warmed up, attempting restore before opening service...')
      const ready = await ensureSessionReady()
      if (!ready) {
        logger.warn('ServiceCard: Silent session restore failed, trying popup re-auth with kc_idp_hint...')
        const popupOk = await popupReauth()
        if (!popupOk) {
          logger.warn('ServiceCard: Popup re-auth also failed, opening service anyway (will show Keycloak login)')
        }
      }
    }

    if (isPWA() && !isMobile()) {
      // Open inside the PWA in an app tab/modal (desktop PWAs only)
      openWebview(service.url, service.name)
      return
    }

    window.open(service.url, '_blank', 'noopener,noreferrer')
  }

  /**
   * Fallback: do a popup-based Keycloak re-auth using kc_idp_hint.
   * Since the user is already logged into Google/GitHub/Discord in their browser,
   * the social provider auto-completes and the popup closes almost instantly.
   * This re-establishes the Keycloak session cookie so the service iframe works.
   */
  const popupReauth = async () => {
    const idpHint = localStorage.getItem('ghassicloud-idp-hint')
    if (!idpHint) {
      logger.warn('popupReauth: no idp hint stored, cannot do transparent re-auth')
      return false
    }

    try {
      const configRes = await fetch('/api/auth/sso/config')
      if (!configRes.ok) return false
      const config = await configRes.json()

      const state = crypto.randomUUID()
      sessionStorage.setItem('sso_state', state)

      // Generate PKCE
      const array = new Uint8Array(64)
      crypto.getRandomValues(array)
      const codeVerifier = Array.from(array, byte =>
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'[byte % 66]
      ).join('')
      const encoder = new TextEncoder()
      const digest = await crypto.subtle.digest('SHA-256', encoder.encode(codeVerifier))
      const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
      sessionStorage.setItem('sso_code_verifier', codeVerifier)

      const redirectUri = `${window.location.origin}/sso-callback`
      sessionStorage.setItem('sso_redirect_uri', redirectUri)

      const authUrl = new URL(config.authUrl)
      authUrl.searchParams.set('client_id', config.clientId)
      authUrl.searchParams.set('redirect_uri', redirectUri)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('scope', config.scope)
      authUrl.searchParams.set('state', state)
      authUrl.searchParams.set('code_challenge', codeChallenge)
      authUrl.searchParams.set('code_challenge_method', 'S256')
      authUrl.searchParams.set('kc_idp_hint', idpHint)

      logger.info('popupReauth: opening popup with kc_idp_hint =', idpHint)

      const width = 500, height = 600
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2
      const popup = window.open(
        authUrl.toString(),
        'GhassiCloud SSO Re-Auth',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
      )

      if (!popup) {
        logger.warn('popupReauth: popup blocked by browser')
        return false
      }

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          window.removeEventListener('message', handleMessage)
          try { popup.close() } catch (e) {}
          resolve(false)
        }, 15000)

        const handleMessage = async (event) => {
          if (event.origin !== window.location.origin) return
          if (event.data.type !== 'SSO_CALLBACK') return

          clearTimeout(timeout)
          window.removeEventListener('message', handleMessage)
          try { popup.close() } catch (e) {}

          const { code, state: returnedState, error } = event.data
          if (error || !code || returnedState !== state) {
            logger.warn('popupReauth: failed -', error || 'state mismatch')
            resolve(false)
            return
          }

          try {
            const res = await fetch('/api/auth/sso/callback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code,
                redirectUri,
                codeVerifier
              })
            })
            if (res.ok) {
              const data = await res.json()
              localStorage.setItem('ghassicloud-token', data.token)
              if (data.idToken) localStorage.setItem('ghassicloud-id-token', data.idToken)
              if (data.identityProvider) localStorage.setItem('ghassicloud-idp-hint', data.identityProvider)
              logger.info('popupReauth: success! Keycloak session cookie re-established')
              resolve(true)
            } else {
              resolve(false)
            }
          } catch (err) {
            logger.error('popupReauth: token exchange failed:', err)
            resolve(false)
          }
        }

        window.addEventListener('message', handleMessage)
      })
    } catch (err) {
      logger.error('popupReauth: error:', err)
      return false
    }
  }

  // Close the menu when clicking outside the card
  useEffect(() => {
    const onDocClick = (ev) => {
      if (!showMenu) return
      if (rootRef.current && !rootRef.current.contains(ev.target)) {
        setShowMenu(false)
      }
    }
    const onEsc = (ev) => {
      if (ev.key === 'Escape') setShowMenu(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('touchstart', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('touchstart', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [showMenu])

  return (
    <motion.div
      ref={rootRef}
      className={`service-card ${viewMode}${service.pinned ? ' pinned' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onClick={handleClick}
      style={{ '--np-accent': service.color }}
    >
      <div className="card-glow" />
      
      {viewMode === 'list' ? (
        <div className="card-header list-mode">
          <div 
            className="service-icon"
            style={{ backgroundColor: `${service.color}20`, color: service.color }}
          >
            {showFavicon ? (
              <img 
                src={faviconUrl}
                alt={`${service.name} icon`}
                onError={handleFaviconError}
                style={{ width: 28, height: 28, objectFit: 'contain' }}
              />
            ) : (
              <Icon size={28} />
            )}
          </div>

          <div className="card-main">
            <div className="card-title-row">
              <div className="status-pin">
                <div className="status-indicator left" style={{ backgroundColor: statusColors[service.status] }} title={service.status} />
                <button
                  type="button"
                  className={`pin-button small${service.pinned ? ' active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    impact('light')
                    onPin(service.id, !service.pinned)
                  }}
                  title={service.pinned ? t('service.unpin') : t('service.pin')}
                >
                  <Pin size={12} />
                </button>
                {service.requiresExtraAuth && (
                  <button
                    ref={authBtnRef}
                    type="button"
                    className="auth-warning-button small"
                    onMouseEnter={(e) => { e.stopPropagation(); setAuthOpen(true) }}
                    onMouseLeave={(e) => { e.stopPropagation(); setAuthOpen(false) }}
                    onFocus={(e) => { e.stopPropagation(); setAuthOpen(true) }}
                    onBlur={(e) => { e.stopPropagation(); setAuthOpen(false) }}
                    onClick={(e) => { e.stopPropagation(); toggleAuthLabel() }}
                    aria-label={t('service.extraAuth')}
                    aria-expanded={authOpen}
                  >
                    <AlertTriangle size={12} />
                  </button>
                )}
              </div>
              <h3>{service.name}</h3>
            </div>
            <div className="muted-desc">{descText}</div>

            {/* Inline auth message inside the card (hoverable/toggleable) */}
            {service.requiresExtraAuth && (
              <div
                className={`auth-inline ${authOpen ? 'visible' : ''}`}
                role="status"
                aria-live="polite"
                onMouseEnter={() => setAuthOpen(true)}
                onMouseLeave={() => setAuthOpen(false)}
              >
                {t('service.extraAuthDesc')}
              </div>
            )}

          </div>

          <div className="card-actions list-actions">
            {/* Desktop buttons - hidden on mobile */}
            <div className="list-actions-desktop">
              {onCheck && (
                <button
                  type="button"
                  className="check-text"
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    onCheck(service)
                  }}
                  title={t('service.check')}
                  aria-label={t('service.check')}
                >
                  <RefreshCw size={16} />
                  <span style={{ marginLeft: 8 }}>{t('service.check')}</span>
                </button>
              )}

              {onEdit && (
                <button
                  type="button"
                  className="check-text list-action"
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    onEdit(service)
                  }}
                  title={t('service.edit')}
                >
                  <Edit2 size={14} />
                  <span style={{ marginLeft: 8 }}>{t('service.edit')}</span>
                </button>
              )}

              {onDelete && (
                <button
                  type="button"
                  className="check-text list-action"
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    notification('warning')
                    onDelete()
                  }}
                  title={t('service.delete')}
                >
                  <Trash2 size={14} />
                  <span style={{ marginLeft: 8 }}>{t('service.delete')}</span>
                </button>
              )}

              {service.url && (
                <a
                  className="service-link-right"
                  href={service.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (isPWA() && !isMobile()) { openWebview(service.url, service.name) } else { window.open(service.url, '_blank', 'noopener,noreferrer') } }}
                  title={t('service.open')}
                >
                  <span className="service-url-right">{new URL(service.url).hostname}</span>
                  <ExternalLink size={14} />
                </a>
              )}
            </div>

            {/* Mobile three-dot menu */}
            <div className="list-actions-mobile">
              <button 
                type="button"
                className="menu-button list-menu-button"
                onClick={(e) => {
                  e.stopPropagation()
                  impact('light')
                  setShowMenu(!showMenu)
                }}
              >
                <MoreVertical size={18} />
              </button>

              {showMenu && (
                <motion.div 
                  className="card-menu list-card-menu"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  {onCheck && (
                    <button onClick={(e) => { 
                      e.stopPropagation()
                      setShowMenu(false)
                      onCheck(service)
                    }}>
                      <RefreshCw size={14} />
                      {t('service.check')}
                    </button>
                  )}
                  <button onClick={(e) => { 
                    e.stopPropagation()
                    setShowMenu(false)
                    onEdit(service)
                  }}>
                    <Edit2 size={14} />
                    {t('service.edit')}
                  </button>
                  <button 
                    className="danger"
                    onClick={(e) => { 
                      e.stopPropagation()
                      setShowMenu(false)
                      notification('warning')
                      onDelete()
                    }}
                  >
                    <Trash2 size={14} />
                    {t('service.delete')}
                  </button>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="card-header">
            <div 
              className="service-icon"
              style={{ backgroundColor: `${service.color}20`, color: service.color }}
            >
              {showFavicon ? (
                <img 
                  src={faviconUrl}
                  alt={`${service.name} icon`}
                  onError={handleFaviconError}
                  style={{ width: 24, height: 24, objectFit: 'contain' }}
                />
              ) : (
                <Icon size={24} />
              )}
            </div>

            <div className="card-actions">
              <button
                type="button"
                className={`pin-button${service.pinned ? ' active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  onPin(service.id, !service.pinned)
                }}
                title={service.pinned ? t('service.unpin') : t('service.pin')}
              >
                <Pin size={14} />
              </button>

              {service.requiresExtraAuth && (
                <button
                  ref={authBtnRef}
                  type="button"
                  className="auth-warning-button"
                  onMouseEnter={(e) => { e.stopPropagation(); showAuthLabel() }}
                  onMouseLeave={(e) => { e.stopPropagation(); hideAuthLabel() }}
                  onFocus={(e) => { e.stopPropagation(); showAuthLabel() }}
                  onBlur={(e) => { e.stopPropagation(); hideAuthLabel() }}
                  onClick={toggleAuthLabel}
                  aria-label={t('service.extraAuth')}
                >
                  <AlertTriangle size={14} />
                </button>
              )}

              <div 
                className="status-indicator"
                style={{ backgroundColor: statusColors[service.status] }}
                title={service.status}
              />
              <button 
                type="button"
                className="menu-button"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMenu(!showMenu)
                }}
              >
                <MoreVertical size={16} />
              </button>

              {showMenu && (
                <motion.div 
                  className="card-menu"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  {onCheck && (
                    <button onClick={(e) => { 
                      e.stopPropagation()
                      setShowMenu(false)
                      onCheck(service)
                    }}>
                      <RefreshCw size={14} />
                      {t('service.check')}
                    </button>
                  )}
                  <button onClick={(e) => { 
                    e.stopPropagation()
                    setShowMenu(false)
                    onEdit(service)
                  }}>
                    <Edit2 size={14} />
                    {t('service.edit') }
                  </button>
                  <button 
                    className="danger"
                    onClick={(e) => { 
                      e.stopPropagation()
                      setShowMenu(false)
                      onDelete()
                    }}
                  >
                    <Trash2 size={14} />
                    {t('service.delete') }
                  </button>
                </motion.div>
              )}
            </div>
          </div>

          <div className="card-content">
            <h3>{service.name}</h3>
            <p>{descText}</p>

            {service.requiresExtraAuth && (
              <div
                className={`auth-inline ${authOpen ? 'visible' : ''}`}
                role="status"
                aria-live="polite"
                onMouseEnter={() => setAuthOpen(true)}
                onMouseLeave={() => setAuthOpen(false)}
              >
                {t('service.extraAuthDesc')}
              </div>
            )}
          </div>
        </>
      )}

      <div className="card-footer">
        <div className="footer-left">
          {viewMode !== 'list' && (
            <a
              className="service-link"
              href={service.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (isPWA() && !isMobile()) { openWebview(service.url, service.name) } else { window.open(service.url, '_blank', 'noopener,noreferrer') } }}
              title={t('service.open')}
            >
              <span className="service-url">{new URL(service.url).hostname}</span>
              <ExternalLink size={14} />
            </a>
          )}
        </div>
        <div className="footer-right" />
      </div>
    </motion.div>
  )
}
