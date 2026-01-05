import { createContext, useContext, useState, useEffect } from 'react'

const AccentContext = createContext()

// Available accent colors
export const accentColors = [
  { id: 'indigo', color: '#6366f1', name: 'Indigo' },
  { id: 'purple', color: '#8b5cf6', name: 'Purple' },
  { id: 'pink', color: '#ec4899', name: 'Pink' },
  { id: 'rose', color: '#f43f5e', name: 'Rose' },
  { id: 'orange', color: '#f97316', name: 'Orange' },
  { id: 'green', color: '#22c55e', name: 'Green' },
  { id: 'cyan', color: '#06b6d4', name: 'Cyan' },
]

// Generate lighter/darker variants
function hexToHSL(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h, s, l = (max + min) / 2

  if (max === min) {
    h = s = 0
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 }
}

function HSLToHex(h, s, l) {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = n => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

// Calculate relative luminance for contrast checking
function getRelativeLuminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255

  const [rs, gs, bs] = [r, g, b].map(c => {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

// Get contrasting text color (white or black) for the given background
function getContrastColor(bgHex) {
  const luminance = getRelativeLuminance(bgHex)
  // Use white text for dark backgrounds, black for light backgrounds
  return luminance > 0.5 ? '#000000' : '#ffffff'
}

export function AccentProvider({ children }) {
  const [accentId, setAccentIdState] = useState(() => {
    const saved = localStorage.getItem('ghassicloud-accent')
    return saved || 'cyan'
  })

  const [customColor, setCustomColorState] = useState(() => {
    const saved = localStorage.getItem('ghassicloud-custom-accent')
    return saved || '#6366f1'
  })
  
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [isPreview, setIsPreview] = useState(false)

  const setAccent = (id, color, preview = false) => {
    setAccentIdState(id)
    if (id === 'custom' && color) {
      setCustomColorState(color)
    }
    setIsPreview(preview)
  }

  const currentAccent = accentId === 'custom' 
    ? { id: 'custom', color: customColor, name: 'Custom' }
    : accentColors.find(a => a.id === accentId) || accentColors[6]

  useEffect(() => {
    // Only persist if not in preview mode
    if (!isPreview) {
      localStorage.setItem('ghassicloud-accent', accentId)
      if (accentId === 'custom') {
        localStorage.setItem('ghassicloud-custom-accent', customColor)
      }
    }
    
    // Apply accent color to CSS variables
    const root = document.documentElement
    const hsl = hexToHSL(currentAccent.color)
    const contrastText = getContrastColor(currentAccent.color)
    
    root.style.setProperty('--accent', currentAccent.color)
    root.style.setProperty('--accent-text', contrastText)
    root.style.setProperty('--accent-light', HSLToHex(hsl.h, hsl.s, Math.min(hsl.l + 15, 90)))
    root.style.setProperty('--accent-dark', HSLToHex(hsl.h, hsl.s, Math.max(hsl.l - 15, 20)))
    root.style.setProperty('--accent-glow', `${currentAccent.color}15`)
    root.style.setProperty('--gradient-1', `linear-gradient(135deg, ${currentAccent.color} 0%, ${HSLToHex(hsl.h + 30, hsl.s, hsl.l)} 100%)`)
    
    // Skip logging on initial load or preview
    if (isInitialLoad) {
      setIsInitialLoad(false)
      return
    }
    
    // Only log if not in preview mode
    if (!isPreview) {
      // Log accent change to backend (if user is authenticated)
      const token = localStorage.getItem('ghassicloud-token')
      if (token) {
        fetch('/api/auth/appearance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          accent: accentId,
          customAccent: accentId === 'custom' ? customColor : undefined
        })
      }).catch(err => console.debug('Failed to log accent change:', err))
      }
    }
  }, [accentId, currentAccent, customColor, isPreview])

  return (
    <AccentContext.Provider value={{ currentAccent, setAccent, accentColors, customColor }}>
      {children}
    </AccentContext.Provider>
  )
}

export function useAccent() {
  const context = useContext(AccentContext)
  if (!context) {
    throw new Error('useAccent must be used within an AccentProvider')
  }
  return context
}
