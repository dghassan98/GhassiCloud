import React, { useEffect, useRef, useState } from 'react'
import { X, ExternalLink } from 'lucide-react'
import { useWebview } from '../context/WebviewContext'
import { useToast } from '../context/ToastContext'
import '../styles/webview.css'

export default function WebViewModal() {
  const { tabs, activeId, closeWebview, setActiveWebview } = useWebview()
  const iframeRef = useRef(null)
  const { showToast } = useToast()
  const [loadingMap, setLoadingMap] = useState({})

  // Compute active tab (always computed so hooks are stable)
  const active = (tabs && tabs.length) ? (tabs.find(t => t.id === activeId) || tabs[tabs.length - 1]) : null

  useEffect(() => {
    // Listen for messages from SSO callback inside iframe so we can close or react
    const onMessage = (ev) => {
      try {
        if (ev.origin !== window.location.origin) return
        if (ev.data && ev.data.type === 'SSO_CALLBACK') {
          // We could close SSO tab if open
          const ssoTab = tabs.find(t => t.hostname && t.hostname.includes('auth.ghassi.cloud'))
          if (ssoTab) closeWebview(ssoTab.id)
          // Let auth context pick up storage changes
        }
      } catch (e) {}
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [tabs, closeWebview])

  // Manage load/detection for blocked frames (declared unconditionally to keep hook order stable)
  useEffect(() => {
    if (!active || !iframeRef.current) return

    const iframe = iframeRef.current
    let didLoad = false

    const onLoad = () => {
      didLoad = true
      // Try to detect obvious frame blocking (about:blank)
      let blocked = false
      try {
        const href = iframe.contentWindow && iframe.contentWindow.location && iframe.contentWindow.location.href
        if (!href || href === 'about:blank') blocked = true
      } catch (e) {
        // Cross-origin - likely loaded fine
        blocked = false
      }

      setLoadingMap(prev => ({ ...prev, [active.id]: false }))

      if (blocked) {
        // Fallback to opening in external browser
        showToast({ message: 'This site prevents embedding. Opening in external browser.', type: 'warning' })
        closeWebview(active.id)
        window.open(active.url, '_blank', 'noopener,noreferrer')
      }
    }

    const onError = () => {
      setLoadingMap(prev => ({ ...prev, [active.id]: false }))
      showToast({ message: 'Failed to load site, opening in external browser.', type: 'error' })
      closeWebview(active.id)
      window.open(active.url, '_blank', 'noopener,noreferrer')
    }

    // Attach handlers
    iframe.addEventListener('load', onLoad)
    iframe.addEventListener('error', onError)

    // Set a timeout to fallback if nothing happens (e.g., blocked by X-Frame-Options)
    setLoadingMap(prev => ({ ...prev, [active.id]: true }))
    const t = setTimeout(() => {
      if (!didLoad) {
        // Give it a final fallback
        showToast({ message: 'Site did not load in-app, opening in external browser.', type: 'warning' })
        try { closeWebview(active.id) } catch (e) {}
        window.open(active.url, '_blank', 'noopener,noreferrer')
      }
    }, 6000)

    return () => {
      try { iframe.removeEventListener('load', onLoad) } catch(e) {}
      try { iframe.removeEventListener('error', onError) } catch(e) {}
      clearTimeout(t)
    }
  }, [active, closeWebview, showToast])

  if (!tabs || tabs.length === 0) return null

  return (
    <div className="webview-overlay" role="dialog" aria-modal="true">
      <div className="webview-window">
        <div className="webview-header">
          <div className="webview-tabs">
            {tabs.map(t => (
              <button key={t.id} className={`webview-tab ${t.id === active.id ? 'active' : ''}`} onClick={() => setActiveWebview(t.id)}>
                {t.title || t.hostname}
                <span className="webview-close" onClick={(e) => { e.stopPropagation(); closeWebview(t.id) }} aria-label="Close tab"><X size={12} /></span>
              </button>
            ))}
          </div>
          <div className="webview-actions">
            <button className="btn" onClick={() => window.open(active.url, '_blank', 'noopener,noreferrer')} title="Open in external browser"><ExternalLink size={14} /></button>
            <button className="btn close" onClick={() => closeWebview(active.id)} title="Close"><X size={14} /></button>
          </div>
        </div>
        <div className="webview-body">
          {loadingMap[active.id] && (
            <div className="webview-loading">Loading…</div>
          )}
          <iframe ref={iframeRef} title={active.title || active.hostname} src={active.url} sandbox="allow-scripts allow-forms allow-same-origin allow-popups" />
        </div>
      </div>
      <style>{`
        .webview-overlay { position: fixed; inset: 0; z-index: 1200; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; }
        .webview-window { width: 90%; height: 85%; background: var(--bg-primary); border-radius: 8px; overflow: hidden; display:flex; flex-direction:column; box-shadow: 0 10px 30px rgba(2,6,23,0.6); }
        .webview-header { display:flex; align-items:center; justify-content:space-between; padding:6px 8px; gap:8px; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); }
        .webview-tabs { display:flex; gap:6px; overflow:auto; }
        .webview-tab { background: transparent; border: none; color: var(--text-primary); padding:6px 10px; border-radius:6px; display:flex; align-items:center; gap:8px; }
        .webview-tab.active { background: var(--bg-accent); color: var(--text-on-accent); }
        .webview-close { margin-left:6px; display:inline-flex; align-items:center; padding-left:6px; }
        .webview-actions { display:flex; gap:6px; align-items:center }
        .webview-body { flex:1; position:relative }
        .webview-body iframe { width:100%; height:100%; border:0 }
        .webview-loading { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:linear-gradient(180deg, rgba(2,6,23,0.45), rgba(2,6,23,0.65)); color:var(--text-primary); z-index:2; font-weight:600 }
      `}</style>
    </div>
  )
}
