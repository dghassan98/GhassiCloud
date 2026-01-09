import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'

const ThemeContext = createContext()

// Update favicon based on theme and user's logo preference
function updateFavicon(theme) {
  const favicon = document.querySelector('link[rel="icon"]')
  if (favicon) {
    if (theme === 'dark') {
      // Always use circle-dark-alternative for dark theme
      favicon.href = '/favicon-circle-dark-alternative.ico'
    } else {
      // For light theme, use the user's selected logo from localStorage
      const savedLogo = localStorage.getItem('ghassicloud-logo') || 'circle'
      
      // Map logo IDs to their favicon paths
      const logoMap = {
        'circle': '/favicon-circle-cyan.ico',
        'circle-dark-alternative': '/favicon-circle-dark-alternative.ico',
        'circle-dark': '/favicon-circle-dark.ico',
        'circle-cyan': '/favicon-circle-cyan.ico',
        'circle-yellow': '/favicon-circle-yellow.ico',
        'full-logo': '/favicon-circle-cyan.ico',   // Default to circle-cyan
        'cloud-only': '/favicon-circle-cyan.ico'   // Default to circle-cyan
      }
      
      favicon.href = logoMap[savedLogo] || '/favicon-circle-cyan.ico'
    }
  }
}

export function ThemeProvider({ children }) {
  const auth = useAuth()

  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem('ghassicloud-theme')
    return saved || 'system' // Default to system auto-detection
  })
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [isPreview, setIsPreview] = useState(false)

  const setTheme = (newTheme, preview = false) => {
    // Debug: log explicit calls to the theme setter so we can trace user actions
    try { console.debug('setTheme called', { newTheme, preview }) } catch (e) {}
    setThemeState(newTheme)
    setIsPreview(preview)
  }

  // Get the effective theme (resolve 'system' to actual theme)
  const getEffectiveTheme = (themeValue) => {
    if (themeValue === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return themeValue
  }

  useEffect(() => {
    // Only persist if not in preview mode
    if (!isPreview) {
      localStorage.setItem('ghassicloud-theme', theme)
    }
    
    const effectiveTheme = getEffectiveTheme(theme)
    document.documentElement.setAttribute('data-theme', effectiveTheme)
    updateFavicon(effectiveTheme)
    
    // Skip logging on initial load or preview
    if (isInitialLoad) {
      setIsInitialLoad(false)
      return
    }
    
    // Only log if not in preview mode
    if (!isPreview) {
      // Decide whether we should sync this change to server
      const localSyncPref = (() => { try { const s = localStorage.getItem('ghassicloud-sync-preferences'); if (s !== null) return s === 'true'; return false } catch (e) { return false } })()
      // Allow syncing unless server explicitly disabled it; if auth isn't loaded yet but a token exists, we still allow posting
      const serverSyncPref = (() => { try { return !(auth && auth.user && auth.user.preferences && auth.user.preferences.syncPreferences === false) } catch (e) { return true } })()
      const authReady = Boolean(auth && auth.user)
      const serverPrefsApplied = Boolean(window && window.__ghassicloud_server_prefs_applied)
      const tokenPresent = !!localStorage.getItem('ghassicloud-token')
      const shouldSync = Boolean(localSyncPref && serverSyncPref && (authReady || serverPrefsApplied || tokenPresent))

      // Log theme change to backend (if user is authenticated and syncing allowed)
      const token = localStorage.getItem('ghassicloud-token')
      // Debug: log sync decision and token presence + server prefs
      try { console.debug('Theme update:', { theme, isPreview, isInitialLoad, localSyncPref, serverSyncPref, authReady, serverPrefsApplied, shouldSync, tokenPresent: !!token, authPrefs: auth && auth.user && auth.user.preferences }) } catch (e) {}
      if (token && shouldSync) {
        console.debug('Posting theme update to /api/auth/appearance', { theme })
        fetch('/api/auth/appearance', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ theme })
        }).then(() => {
          // Refresh user state from server so other contexts/components pick up new preferences
          try { auth && auth.refreshUser && auth.refreshUser() } catch (e) {}
        }).catch(err => console.debug('Failed to log theme change:', err))
      } else {
        console.debug('Skipping theme POST: token or shouldSync missing', { token: !!token, shouldSync, authPrefs: auth && auth.user && auth.user.preferences })
      }
    }
  }, [theme, isPreview, isInitialLoad])

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      const effectiveTheme = mediaQuery.matches ? 'dark' : 'light'
      document.documentElement.setAttribute('data-theme', effectiveTheme)
      updateFavicon(effectiveTheme)
    }

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
    // Fallback for older browsers
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange)
      return () => mediaQuery.removeListener(handleChange)
    }
  }, [theme])

  // Prefer server-side preference when user is signed in
  useEffect(() => {
    if (!auth || !auth.user) return
    const serverTheme = auth.user.theme
    try { console.debug('ThemeContext: auth.user changed, serverTheme:', serverTheme, 'currentTheme:', theme, 'authPrefs:', auth.user.preferences) } catch (e) {}
    if (serverTheme && serverTheme !== theme) {
      setThemeState(serverTheme)
    }
  }, [auth && auth.user])

  // Re-apply preferences when a force-refresh or auth refresh writes server prefs to localStorage
  useEffect(() => {
    const handler = (e) => {
      try {
        const prefs = (e && e.detail && e.detail.prefs) || {}
        if (prefs.theme) {
          setThemeState(prefs.theme)
        }
      } catch (err) { console.debug('ThemeContext: preferences-updated handler error', err) }
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
