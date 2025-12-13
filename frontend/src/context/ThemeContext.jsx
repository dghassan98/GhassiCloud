import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

// Update favicon based on theme
function updateFavicon(theme) {
  const favicon = document.querySelector('link[rel="icon"]')
  if (favicon) {
    // Use circle-dark for dark theme, circle-cyan for light theme
    const faviconPath = theme === 'dark' 
      ? '/logos/logo-circle-dark.png' 
      : '/logos/logo-circle-cyan.png'
    favicon.href = faviconPath
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('ghassicloud-theme')
    return saved || 'dark'
  })

  useEffect(() => {
    localStorage.setItem('ghassicloud-theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
    updateFavicon(theme)
  }, [theme])

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
