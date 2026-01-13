import React, { useState, useEffect } from 'react'

const FAVICON_PATHS = [
  '/favicon.ico',
  '/favicon.png',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png'
]

export default function Favicon({ url, size = 24, alt }) {
  const [pathIndex, setPathIndex] = useState(0)
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    // Reset when URL changes
    setPathIndex(0)
    setErrored(false)
  }, [url])

  const getFaviconUrl = () => {
    if (!url) return null
    try {
      const u = new URL(url)
      const origin = u.origin
      if (pathIndex < FAVICON_PATHS.length) {
        return `${origin}${FAVICON_PATHS[pathIndex]}`
      }
      const domain = u.hostname
      return `https://icons.duckduckgo.com/ip3/${domain}.ico`
    } catch {
      return null
    }
  }

  const faviconUrl = getFaviconUrl()

  const handleError = () => {
    if (pathIndex < FAVICON_PATHS.length) {
      setPathIndex(prev => prev + 1)
    } else {
      setErrored(true)
    }
  }

  if (!faviconUrl || errored) {
    // Fallback: first letter of hostname or a globe
    try {
      const hostname = new URL(url).hostname
      const ch = hostname ? hostname.charAt(0).toUpperCase() : 'W'
      return (
        <div className="minimized-favicon" style={{ width: size, height: size, borderRadius: '50%', fontSize: Math.max(10, Math.floor(size * 0.55)), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ch}</div>
      )
    } catch {
      return (<div className="minimized-favicon" style={{ width: size, height: size, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>W</div>)
    }
  }

  return (
    <img
      src={faviconUrl}
      alt={alt || 'favicon'}
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'cover', borderRadius: '50%' }}
      onError={handleError}
    />
  )
}
