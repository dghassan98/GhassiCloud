import React, { createContext, useContext, useState, useCallback } from 'react'

const WebviewContext = createContext()

export function WebviewProvider({ children }) {
  const [tabs, setTabs] = useState([])
  const [activeId, setActiveId] = useState(null)
  const MAX_MINIMIZED = 5

  const openWebview = useCallback((url, title) => {
    // Check if a tab with this URL already exists
    const existing = tabs.find(t => t.url === url)
    if (existing) {
      // If tab exists and is minimized, restore it; otherwise just activate it
      if (existing.minimized) {
        setTabs(prev => prev.map(t => t.id === existing.id ? { ...t, minimized: false } : t))
      }
      setActiveId(existing.id)
      return existing.id
    }

    // Create new tab
    const id = `webtab-${Date.now()}`
    const hostname = (() => {
      try { return new URL(url).hostname } catch { return url }
    })()

    setTabs(prev => [...prev, { id, url, title: title || hostname, hostname, minimized: false }])
    setActiveId(id)
    return id
  }, [tabs])

  const closeWebview = useCallback((id) => {
    setTabs(prev => prev.filter(t => t.id !== id))
    setActiveId(prevActive => {
      if (prevActive === id) {
        const remaining = tabs.filter(t => t.id !== id && !t.minimized)
        return remaining.length ? remaining[remaining.length - 1].id : null
      }
      return prevActive
    })
  }, [tabs])

  const setActiveWebview = useCallback((id) => {
    setActiveId(id)
  }, [])

  const minimizeWebview = useCallback((id) => {
    let success = false
    setTabs(prev => {
      const minimizedCount = prev.filter(t => t.minimized).length
      if (minimizedCount >= MAX_MINIMIZED) return prev
      const next = prev.map(t => t.id === id ? { ...t, minimized: true } : t)
      success = true
      return next
    })

    setTimeout(() => {
      setActiveId(prevActive => {
        if (prevActive === id) {
          const cur = tabs.filter(t => t.id !== id && !t.minimized)
          return cur.length ? cur[cur.length - 1].id : null
        }
        return prevActive
      })
    }, 0)

    return success
  }, [tabs])

  const restoreWebview = useCallback((id) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, minimized: false } : t))
    setActiveId(id)
  }, [])

  const clearAllWebviews = useCallback(() => {
    setTabs([])
    setActiveId(null)
  }, [])

  const maximizeWebview = useCallback((id) => {
    setTabs(prev => prev.map(t => ({ ...t, maximized: t.id === id })))
    setActiveId(id)
  }, [])

  const restoreMaximizedWebview = useCallback((id) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, maximized: false } : t))
  }, [])


  const value = {
    tabs,
    activeId,
    openWebview,
    closeWebview,
    setActiveWebview,
    minimizeWebview,
    restoreWebview,
    maximizeWebview,
    restoreMaximizedWebview,
    clearAllWebviews,
    MAX_MINIMIZED
  }

  return (
    <WebviewContext.Provider value={value}>
      {children}
    </WebviewContext.Provider>
  )
}

export const useWebview = () => useContext(WebviewContext)

export default WebviewProvider
