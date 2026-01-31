import { createContext, useContext, useState, useEffect } from 'react'
import { useTheme } from './ThemeContext'
import { useAuth } from './AuthContext'
import logger from '../logger'

const LogoContext = createContext()

export const logoOptions = [
  {
    id: 'circle',
    name: 'Circle',

    pathDark: '/logos/logo-circle-dark.png',
    pathLight: '/logos/logo-circle-cyan.png',
    description: 'Circle background - adapts to theme'
  }, {
    id: 'circle-dark',
    name: 'Circle Dark',
    path: '/logos/logo-circle-dark.png',
    description: 'Circle with dark background'
  },
  {
    id: 'circle-dark-alternative',
    name: 'Circle Dark Alternative',
    path: '/logos/logo-circle-dark-alternative.png',
    description: 'Alternative circle with dark background'
  },

  {
    id: 'circle-cyan',
    name: 'Circle Cyan',
    path: '/logos/logo-circle-cyan.png',
    description: 'Circle with cyan background'
  },
  {
    id: 'ghassi-music',
    name: 'GhassiMusic',
    path: '/logos/ghassi_music.png',
    description: 'GhassiMusic - music logo'
  },
  {
    id: 'circle-yellow',
    name: 'Circle Yellow',
    path: '/logos/logo-circle-yellow.png',
    description: 'Circle with yellow background'
  },
  {
    id: 'full-logo',
    name: 'Full Logo',
    path: '/logos/logo-full.png',
    description: 'Cloud icon with GhassiCloud text'
  },
  {
    id: 'cloud-only',
    name: 'Cloud Only',
    path: '/logos/logo-cloud.png',
    description: 'Just the cloud icon'
  }
]

export function LogoProvider({ children }) {
  const { theme } = useTheme()
  const [logoId, setLogoIdState] = useState(() => {
    const saved = localStorage.getItem('ghassicloud-logo')
    // Migrate old selections to new options
    if (saved === 'circle-dark' || saved === 'circle-cyan') {
      return 'circle'
    }
    return saved || 'circle'
  })
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [isPreview, setIsPreview] = useState(false)

  const setLogo = (id, preview = false) => {
    if (logoOptions.find(l => l.id === id)) {
      setLogoIdState(id)
      setIsPreview(preview)
    }
  }

  const getLogoWithPath = () => {
    const logo = logoOptions.find(l => l.id === logoId) || logoOptions[0]
    if (logo.id === 'circle') {
      return {
        ...logo,
        path: theme === 'dark' ? logo.pathDark : logo.pathLight
      }
    }

    return logo
  }

  const currentLogo = getLogoWithPath()

  const auth = useAuth()

  useEffect(() => {
    if (!auth || !auth.user) return
    const prefsStr = auth.user.preferences ? JSON.stringify(auth.user.preferences) : ''
    const serverLogo = auth.user.logo
    try { logger.debug('LogoContext: auth.user changed', { serverLogo, currentLogoId: logoId, authPrefs: auth.user.preferences }) } catch (e) {}
    if (serverLogo && serverLogo !== logoId) {
      setLogoIdState(serverLogo)
    }
  }, [auth && auth.user && (auth.user.preferences ? JSON.stringify(auth.user.preferences) : '')])

  useEffect(() => {
    const handler = (e) => {
      try {
        const prefs = (e && e.detail && e.detail.prefs) || {}
        if (prefs.logo) {
          setLogoIdState(prefs.logo)
        }
      } catch (err) { logger.debug('LogoContext: preferences-updated handler error', err) }
    }
    window.addEventListener('ghassicloud:preferences-updated', handler)
    return () => window.removeEventListener('ghassicloud:preferences-updated', handler)
  }, [])

  useEffect(() => {
    if (!isPreview) {
      localStorage.setItem('ghassicloud-logo', logoId)
    }

    if (isInitialLoad) {
      setIsInitialLoad(false)
      return
    }
    if (!isPreview) {
      const localSyncPref = (() => { try { const s = localStorage.getItem('ghassicloud-sync-preferences'); if (s !== null) return s === 'true'; return false } catch (e) { return false } })()
      const serverSyncPref = (() => { try { return !(auth && auth.user && auth.user.preferences && auth.user.preferences.syncPreferences === false) } catch (e) { return true } })()
      const authReady = Boolean(auth && auth.user)
      const serverPrefsApplied = Boolean(typeof window !== 'undefined' && window.__ghassicloud_server_prefs_applied)
      const tokenPresent = !!localStorage.getItem('ghassicloud-token')
      const shouldSync = Boolean(localSyncPref && serverSyncPref && (authReady || serverPrefsApplied || tokenPresent))

      try { logger.debug('Logo update:', { logoId, isPreview, isInitialLoad, localSyncPref, serverSyncPref, authReady, serverPrefsApplied, shouldSync, tokenPresent: !!localStorage.getItem('ghassicloud-token'), authPrefs: auth && auth.user && auth.user.preferences }) } catch (e) {}

      const token = localStorage.getItem('ghassicloud-token')
      if (token && shouldSync) {
        logger.debug('Posting logo update to /api/auth/appearance', { logo: logoId })
        fetch('/api/auth/appearance', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ logo: logoId })
        }).then(() => { try { auth && auth.refreshUser && auth.refreshUser() } catch (e) {} }).catch(err => logger.debug('Failed to log logo change:', err))
      } else {
        logger.debug('Skipping logo POST: token or shouldSync missing', { token: !!token, shouldSync, authPrefs: auth && auth.user && auth.user.preferences })
      }
    }
  }, [logoId, isPreview])

  // Update favicon when GhassiMusic is selected (reverts to theme default otherwise)
  useEffect(() => {
    try {
      const link = document.querySelector("link[rel='icon']") || document.createElement('link')
      link.setAttribute('rel', 'icon')
      const ghassiIcon = '/favicon-ghassi-music.ico'
      const defaultIcon = theme === 'dark' ? '/favicon-circle-dark.ico' : '/favicon-circle-cyan.ico'
      const href = logoId === 'ghassi-music' ? ghassiIcon : defaultIcon
      if (!document.querySelector("link[rel='icon']")) document.head.appendChild(link)
      link.setAttribute('href', href)
    } catch (err) { logger.debug('Favicon update failed', err) }
  }, [logoId, theme])

  return (
    <LogoContext.Provider value={{ logoId, currentLogo, setLogo, logoOptions }}>
      {children}
    </LogoContext.Provider>
  )
}

export const useLogo = () => useContext(LogoContext)
