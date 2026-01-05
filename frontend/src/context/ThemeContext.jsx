import { createContext, useContext, useState, useEffect } from 'react'

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
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem('ghassicloud-theme')
    return saved || 'dark'
  })
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [isPreview, setIsPreview] = useState(false)

  const setTheme = (newTheme, preview = false) => {
    setThemeState(newTheme)
    setIsPreview(preview)
  }

  useEffect(() => {
    // Only persist if not in preview mode
    if (!isPreview) {
      localStorage.setItem('ghassicloud-theme', theme)
    }
    
    document.documentElement.setAttribute('data-theme', theme)
    updateFavicon(theme)
    
    // Skip logging on initial load or preview
    if (isInitialLoad) {
      setIsInitialLoad(false)
      return
    }
    
    // Only log if not in preview mode
    if (!isPreview) {
      // Log theme change to backend (if user is authenticated)
      const token = localStorage.getItem('ghassicloud-token')
      if (token) {
        fetch('/api/auth/appearance', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ theme })
        }).catch(err => console.debug('Failed to log theme change:', err))
      }
    }
  }, [theme, isPreview])

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
