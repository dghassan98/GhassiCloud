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
  },
  { 
    id: 'square-dark', 
    name: 'Square Dark', 
    path: '/logos/logo-square-dark.png',
    description: 'Rounded square dark background'
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
  const [logoId, setLogoId] = useState(() => {
    const saved = localStorage.getItem('ghassicloud-logo')
    // Migrate old selections to new options
    if (saved === 'circle-dark' || saved === 'circle-cyan') {
      return 'circle'
    }
    return saved || 'circle'
  })

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
    localStorage.setItem('ghassicloud-logo', logoId)
  }, [logoId])

  const setLogo = (id) => {
    if (logoOptions.find(l => l.id === id)) {
      setLogoId(id)
    }
  }

  return (
    <LogoContext.Provider value={{ logoId, currentLogo, setLogo, logoOptions }}>
      {children}
    </LogoContext.Provider>
  )
}

export const useLogo = () => useContext(LogoContext)
