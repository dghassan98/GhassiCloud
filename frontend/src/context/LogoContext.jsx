import { createContext, useContext, useState, useEffect } from 'react'
import { useTheme } from './ThemeContext'

const LogoContext = createContext()

// Available logo options - circle variants are now automatic based on theme
export const logoOptions = [
  {
    id: 'circle',
    name: 'Circle',
    // Path will be determined by theme
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

  // Get the current logo with theme-aware path
  const getLogoWithPath = () => {
    const logo = logoOptions.find(l => l.id === logoId) || logoOptions[0]

    // For circle logo, use theme-specific path
    if (logo.id === 'circle') {
      return {
        ...logo,
        path: theme === 'dark' ? logo.pathDark : logo.pathLight
      }
    }

    return logo
  }

  const currentLogo = getLogoWithPath()

  useEffect(() => {
    // Only persist if not in preview mode
    if (!isPreview) {
      localStorage.setItem('ghassicloud-logo', logoId)
    }

    // Skip logging on initial load or preview
    if (isInitialLoad) {
      setIsInitialLoad(false)
      return
    }

    // Only log if not in preview mode
    if (!isPreview) {
      // Log logo change to backend (if user is authenticated)
      const token = localStorage.getItem('ghassicloud-token')
      if (token) {
        fetch('/api/auth/appearance', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ logo: logoId })
        }).catch(err => console.debug('Failed to log logo change:', err))
      }
    }
  }, [logoId, isPreview])

  return (
    <LogoContext.Provider value={{ logoId, currentLogo, setLogo, logoOptions }}>
      {children}
    </LogoContext.Provider>
  )
}

export const useLogo = () => useContext(LogoContext)
