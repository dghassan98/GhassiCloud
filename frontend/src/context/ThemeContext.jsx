import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import logger from '../logger'

const ThemeContext = createContext()

// Update favicon based on theme and user's logo preference
function updateFavicon(theme) {
  const favicon = document.querySelector('link[rel="icon"]')
  if (favicon) {
    if (theme === 'dark') {
      favicon.href = '/favicon-circle-dark-alternative.ico'
    } else {
      const savedLogo = localStorage.getItem('ghassicloud-logo') || 'circle'
      
      const logoMap = {
        'circle': '/favicon-circle-cyan.ico',
        'circle-dark-alternative': '/favicon-circle-dark-alternative.ico',
        'circle-dark': '/favicon-circle-dark.ico',
        'circle-cyan': '/favicon-circle-cyan.ico',
        'circle-yellow': '/favicon-circle-yellow.ico',
        'full-logo': '/favicon-circle-cyan.ico',
        'cloud-only': '/favicon-circle-cyan.ico'
      }
      
      favicon.href = logoMap[savedLogo] || '/favicon-circle-cyan.ico'
    }
  }
}

export function ThemeProvider({ children }) {
  const auth = useAuth()

  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem('ghassicloud-theme')
    return saved || 'system'
  })
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [isPreview, setIsPreview] = useState(false)

  const setTheme = (newTheme, preview = false) => {
    try { logger.debug('setTheme called', { newTheme, preview }) } catch (e) {}
    setThemeState(newTheme)
    setIsPreview(preview)
  }

  const getEffectiveTheme = (themeValue) => {
    if (themeValue === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return themeValue
  }

  useEffect(() => {
    if (!isPreview) {
      localStorage.setItem('ghassicloud-theme', theme)
    }
    
    const effectiveTheme = getEffectiveTheme(theme)
    document.documentElement.setAttribute('data-theme', effectiveTheme)
    updateFavicon(effectiveTheme)
    
    if (isInitialLoad) {
      setIsInitialLoad(false)
      return
    }
    
    if (!isPreview) {
      const localSyncPref = (() => { try { const s = localStorage.getItem('ghassicloud-sync-preferences'); if (s !== null) return s === 'true'; return false } catch (e) { return false } })()
      const serverSyncPref = (() => { try { return !(auth && auth.user && auth.user.preferences && auth.user.preferences.syncPreferences === false) } catch (e) { return true } })()
      const authReady = Boolean(auth && auth.user)
      const serverPrefsApplied = Boolean(window && window.__ghassicloud_server_prefs_applied)
      const tokenPresent = !!localStorage.getItem('ghassicloud-token')
      const shouldSync = Boolean(localSyncPref && serverSyncPref && (authReady || serverPrefsApplied || tokenPresent))

      const token = localStorage.getItem('ghassicloud-token')
      try { logger.debug('Theme update:', { theme, isPreview, isInitialLoad, localSyncPref, serverSyncPref, authReady, serverPrefsApplied, shouldSync, tokenPresent: !!token, authPrefs: auth && auth.user && auth.user.preferences }) } catch (e) {}
      if (token && shouldSync) {
        logger.debug('Posting theme update to /api/auth/appearance', { theme })
        fetch('/api/auth/appearance', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ theme })
        }).then(() => {
          try { auth && auth.refreshUser && auth.refreshUser() } catch (e) { logger.debug('Failed to refresh user after theme update:', e) }
        }).catch(err => logger.debug('Failed to log theme change:', err))
      } else {
        logger.debug('Skipping theme POST: token or shouldSync missing', { token: !!token, shouldSync, authPrefs: auth && auth.user && auth.user.preferences })
      }
    }
  }, [theme, isPreview, isInitialLoad])

  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      const effectiveTheme = mediaQuery.matches ? 'dark' : 'light'
      document.documentElement.setAttribute('data-theme', effectiveTheme)
      updateFavicon(effectiveTheme)
    }

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange)
      return () => mediaQuery.removeListener(handleChange)
    }
  }, [theme])

  useEffect(() => {
    if (!auth || !auth.user) return
    const serverTheme = auth.user.theme
    try { logger.debug('ThemeContext: auth.user changed, serverTheme:', serverTheme, 'currentTheme:', theme, 'authPrefs:', auth.user.preferences) } catch (e) {}
    if (serverTheme && serverTheme !== theme) {
      setThemeState(serverTheme)
    }
  }, [auth && auth.user])

  useEffect(() => {
    const handler = (e) => {
      try {
        const prefs = (e && e.detail && e.detail.prefs) || {}
        if (prefs.theme) {
          setThemeState(prefs.theme)
        }
      } catch (err) { logger.debug('ThemeContext: preferences-updated handler error', err) }
    }
    window.addEventListener('ghassicloud:preferences-updated', handler)
    return () => window.removeEventListener('ghassicloud:preferences-updated', handler)
  }, [])

  const toggleTheme = () => {
    setTheme(prev => {
      if (prev === 'light') return 'dark'
      if (prev === 'dark') return 'system'
      return 'light'
    })
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
