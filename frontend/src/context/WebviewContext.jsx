import React, { createContext, useContext, useState, useCallback } from 'react'

const WebviewContext = createContext()

export function WebviewProvider({ children }) {
  const [tabs, setTabs] = useState([])
  const [activeId, setActiveId] = useState(null)

  const openWebview = useCallback((url, title) => {
    // create a simple id
    const id = `webtab-${Date.now()}`
    const hostname = (() => {
      try { return new URL(url).hostname } catch { return url }
    })()

    setTabs(prev => [...prev, { id, url, title: title || hostname, hostname }])
    setActiveId(id)
    return id
  }, [])

  const closeWebview = useCallback((id) => {
    setTabs(prev => prev.filter(t => t.id !== id))
    setActiveId(prevActive => {
      if (prevActive === id) {
        // pick another tab if any
        const remaining = tabs.filter(t => t.id !== id)
        return remaining.length ? remaining[remaining.length - 1].id : null
      }
      return prevActive
    })
  }, [tabs])

  const setActiveWebview = useCallback((id) => {
    setActiveId(id)
  }, [])

  const value = {
    tabs,
    activeId,
    openWebview,
    closeWebview,
    setActiveWebview
  }

  return (
    <WebviewContext.Provider value={value}>
      {children}
    </WebviewContext.Provider>
  )
}

export const useWebview = () => useContext(WebviewContext)

export default WebviewProvider
