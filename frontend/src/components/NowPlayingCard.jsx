import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'
import '../styles/nowPlaying.css'

export default function NowPlayingCard({ endpoint, accent }) {
  // Use backend proxy endpoints by default to avoid leaking tokens
  const NOW_PLAYING_URL = '/api/navidrome/nowplaying'
  const COVER_PROXY = '/api/navidrome/cover'

  const [track, setTrack] = useState(null)
  const [loading, setLoading] = useState(true)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [connected, setConnected] = useState(false)

  // Theme
  const { theme } = useTheme()
  const { t } = useLanguage()

  // Refs for modal focus management
  const usernameRef = useRef(null)
  const modalRef = useRef(null)

  // Focus trap + body scroll lock when modal open
  useEffect(() => {
    if (!showModal) return

    // focus the username input after a short delay (allow rendering)
    const t = setTimeout(() => usernameRef.current?.focus(), 40)

    // prevent background scroll
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // handle Escape and Tab (simple focus trap)
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setShowModal(false)
        return
      }

      if (e.key === 'Tab') {
        const modal = modalRef.current
        if (!modal) return
        const focusable = Array.from(modal.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'))
          .filter(el => el.offsetParent !== null)
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      }
    }

    document.addEventListener('keydown', onKey)

    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [showModal])

  // fetch function pulled out so control handlers can trigger a refresh
  // `force` bypasses the connected check (used after a successful login)
  const fetchNowPlaying = async (force = false) => {
    if (!force && !connected) return
    try {
      setLoading(true)
      setLoginError(null)
      const res = await fetch(NOW_PLAYING_URL)
      if (res.status === 401) {
        setTrack(null)
        setNeedsLogin(true)
        setConnected(false)
        // Do NOT automatically open the modal; show connect button instead
        // setShowModal(true)
        return
      }
      if (res.ok) setConnected(true)
      if (!res.ok) throw new Error('Failed to fetch now playing')
      const data = await res.json()
      const entryRoot = data && data['subsonic-response'] && data['subsonic-response'].nowPlaying && data['subsonic-response'].nowPlaying.entry
      if (!entryRoot) {
        setTrack(null)
        return
      }
      const entry = Array.isArray(entryRoot) ? entryRoot[0] : entryRoot
      setTrack(entry)
      setNeedsLogin(false)
      setShowModal(false)
    } catch (e) {
      console.warn('NowPlaying fetch error', e)
      setTrack(null)
    } finally {
      setLoading(false)
    }
  }

  // Check connection on mount; only start polling when connected
  useEffect(() => {
    let mounted = true
    const checkConnected = async () => {
      try {
        const res = await fetch('/api/navidrome/check')
        if (res.ok) {
          setConnected(true)
        } else {
          setConnected(false)
          setLoading(false)
        }
      } catch (e) {
        setConnected(false)
        setLoading(false)
      }
    }
    checkConnected()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!connected) {
      setTrack(null)
      setNeedsLogin(true)
      return
    }

    let mounted = true
    fetchNowPlaying()
    // poll every 8 seconds
    const poll = setInterval(() => { if (mounted) fetchNowPlaying() }, 8000)
    return () => {
      mounted = false
      clearInterval(poll)
    }
  }, [connected])

  // login handler
  const handleLogin = async (e) => {
    e && e.preventDefault && e.preventDefault()
    setLoggingIn(true)
    setLoginError(null)
    try {
      const res = await fetch('/api/navidrome/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setLoginError(json?.message || 'Login failed')
        return
      }
      // success: mark connected and re-fetch now playing
      setConnected(true)
      await fetchNowPlaying(true)
      setShowModal(false)
      setPassword('')
    } catch (err) {
      setLoginError('Login failed')
      console.warn('Login error', err)
    } finally {
      setLoggingIn(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/navidrome/logout', { method: 'POST' })
    } catch (e) {
      console.warn('Logout failed', e)
    } finally {
      // Clear UI state but do not reopen the login modal automatically.
      setTrack(null)
      setNeedsLogin(true)
      setConnected(false)
      setShowModal(false)
    }
  }

  // display helpers
  // Display song title — robust fallback for different server fields
  const songTitle = track ? (track.name || track.title || track.song || track.track || track.file || '') : ''

  const playerName = track ? (track.playerName || track.player) : null

  const isPlaying = Boolean(track && (
    (typeof track.state === 'string' && track.state.toLowerCase() === 'playing') ||
    track.playing === true ||
    track.isPlaying === true ||
    (typeof track.playState === 'string' && track.playState.toLowerCase() === 'playing')
  ))

  const extraInfo = (() => {
    if (!track) return ''
    const parts = []
    if (track.source) parts.push(track.source)
    if (track.state) parts.push(track.state)
    if (track.station) parts.push(track.station)
    return parts.filter(Boolean).join(' • ')
  })()

  // cover via proxy
  const coverUrl = (() => {
    if (!track) return null
    const id = track.coverArt || track.albumId || track.album || track.id
    if (!id) return null
    const size = 160
    return `${COVER_PROXY}?id=${encodeURIComponent(id)}&size=${encodeURIComponent(size)}`
  })()

  // detect accent
  const detectedAccent = (() => {
    if (accent) return accent
    if (typeof window !== 'undefined' && window.__FETCHED_SERVICES && Array.isArray(window.__FETCHED_SERVICES)) {
      const found = window.__FETCHED_SERVICES.find(s => s.url && s.url.includes('music.ghassandarwish.com'))
      if (found && found.color) return found.color
    }
    return '#4fb0ff'
  })()



  return (
    <>
    <div className={`nowplaying-card ${theme === 'light' ? 'np-light-card' : ''}`} role="region" aria-label="Now playing" style={{ ['--np-accent']: detectedAccent, position: 'relative' }}>
      {/* Logout icon */}
      {(!showModal && !needsLogin && connected) && (
        <button className="np-logout-btn" title="Log out" onClick={handleLogout} aria-label="Log out">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M21 12H9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 19H6A2 2 0 0 1 4 17V7A2 2 0 0 1 6 5H12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      <div className="np-art-wrap">
        {coverUrl ? (
          <img src={coverUrl} alt={`${track ? track.album || track.name : 'cover art'}`} className="np-art" />
        ) : (
          <div className="np-art-fallback">🎶</div>
        )}
        {/* Loading spinner overlay while fetching (only when not connected / not logged in) */}
        {loading && !connected && (
          <div className="np-art-loading" aria-hidden>
            <div className="loading-spinner" />
          </div>
        )}
      </div>
      <div className="np-body">
        <div className="np-meta">
          <div className="np-title" title={songTitle || (track ? track.name : '')}>{songTitle ? songTitle : ((loading && !connected) ? 'Loading…' : 'Nothing playing')}</div>
          <div className="np-artist-album">
            <span className="np-artist">{track ? track.artist || track.creator || 'Unknown Artist' : ''}</span>
            {track && track.album && <span className="np-sep">•</span>}
            <span className="np-album">{track ? track.album : ''}</span>
          </div>
        </div>
        {/* Connect button if not connected */}


        <div className="np-info-row">
          <div className={`np-playing-indicator ${track ? 'active' : ''}`} aria-hidden>
            <span className="bar b1" />
            <span className="bar b2" />
            <span className="bar b3" />
          </div>
          {playerName ? (
            <div className="np-player" title={playerName}>{playerName}</div>
          ) : extraInfo ? (
            <div className="np-info">{extraInfo}</div>
          ) : (
            <div className="np-info-placeholder">{t('nowPlaying.noPlayerInfo')}</div>
          )}
        </div>
        {!connected && (
          <div style={{ marginTop: 8 }}>
            <button className="btn-connect" onClick={() => setShowModal(true)}>{t('nowPlaying.connectButton')}</button>
          </div>
        )}
      </div>

      {/* Login modal rendered as a portal to avoid transform/position issues */}
    </div>

    {showModal && createPortal(
      <div
        className={`np-login-modal ${theme === 'light' ? 'light' : 'dark'}`}
        role="dialog"
        aria-modal
        style={{ ['--np-accent']: detectedAccent }}
        onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false) }}
      >
        <div ref={modalRef} className={`np-login-card np-theme-card ${theme === 'light' ? 'np-light' : ''}`} role="document" aria-label="Connect to GhassiMusic">
          <div className="np-login-header">
            <h3>{t('nowPlaying.connectTitle')}</h3>
            <button type="button" className="np-login-close" aria-label={t('common.close')} onClick={() => { setShowModal(false); setPassword('') }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M18 6L6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6 6L18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <p className="np-login-sub">{t('nowPlaying.signInDesc')}</p>
          <form className="np-login-body" onSubmit={handleLogin}>
            <label>Username
              <input ref={usernameRef} placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </label>
            <label>Password
              <input placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
            </label>
            {loginError && <div className="np-login-error">{loginError}</div>}
            <div className="np-login-actions">
              <button type="submit" className="btn-play" disabled={loggingIn}>{loggingIn ? t('nowPlaying.loggingIn') : t('nowPlaying.login')}</button>
              <button type="button" className="btn-icon" onClick={() => { setShowModal(false); setPassword('') }} aria-label={t('common.close')}>{t('common.cancel')}</button>
            </div>
          </form>
        </div>
      </div>,
      document.body
    )}

    </>
  )
}
