import React, { useEffect, useRef, useState } from 'react'
import { X, ExternalLink, Minimize2, Maximize2, Minimize } from 'lucide-react'
import { useWebview } from '../context/WebviewContext'
import { useToast } from '../context/ToastContext'
import { useLanguage } from '../context/LanguageContext'
import { isPWA, isMobile } from '../hooks/useCapacitor'
import '../styles/webview.css' 

export default function WebViewModal() {
  const { tabs, activeId, closeWebview, setActiveWebview, minimizeWebview, restoreWebview, maximizeWebview, restoreMaximizedWebview, MAX_MINIMIZED } = useWebview()
  const { showToast } = useToast()
  const { t } = useLanguage()
  const [loadingMap, setLoadingMap] = useState({})
  const [showCloseConfirm, setShowCloseConfirm] = useState(false) 

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

  // Manage load/detection for blocked frames (bind to the currently active iframe element)
  useEffect(() => {
    if (!active) return

    // Find the iframe element for the active tab (we render one iframe per tab to preserve state across minimize)
    const iframe = document.querySelector(`iframe[data-wv-id="${active.id}"]`)
    if (!iframe) return

    // If this iframe has already loaded the current URL, don't re-run the load detector
    try {
      if (iframe.dataset && iframe.dataset.loaded === '1' && iframe.src === active.url) {
        setLoadingMap(prev => ({ ...prev, [active.id]: false }))
        return
      }
    } catch (e) {
      // ignore cross-origin dataset access issues
    }

    let didLoad = false

    const onLoad = () => {
      didLoad = true
      // Mark this iframe as loaded for this URL so repeated re-renders (e.g., maximize) won't retrigger fallback
      try { if (iframe.dataset) iframe.dataset.loaded = '1' } catch(e) {}

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

  // Prevent background scrolling while modal is open (only on installed desktop PWAs)
  useEffect(() => {
    // Only apply locking when running as an installed desktop PWA AND the overlay is visible.
    // Use `active` directly (avoids referencing `overlayVisible` before it's declared and prevents TDZ errors).
    if (!(isPWA() && !isMobile() && active && !active.minimized)) return

    const prevOverflow = document.body.style.overflow
    const prevPaddingRight = document.body.style.paddingRight
    // Compensate for scrollbar to avoid layout shift
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`

    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.paddingRight = prevPaddingRight
    }
  }, [active && !active.minimized])

  // Intercept Escape to show a close confirmation when running as an installed PWA
  useEffect(() => {
    if (!active) return
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      // If confirm is already shown, pressing Escape cancels it
      if (showCloseConfirm) { setShowCloseConfirm(false); return }
      // If the active webview is maximized, restore it first
      if (active && active.maximized) { restoreMaximizedWebview(active.id); return }
      if (isPWA() && !isMobile()) {
        setShowCloseConfirm(true)
      } else {
        try { closeWebview(active.id) } catch (err) {}
      }
    }
    // Use capture phase so we catch Escape even when an iframe is focused
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [active, closeWebview, showCloseConfirm])

  const minimizedTabs = (tabs || []).filter(t => t.minimized).slice(0, MAX_MINIMIZED)
  const overlayVisible = active && !active.minimized

  return (
    <>
      {/* Overlay modal (rendered always so iframes remain mounted; visibility toggled with a CSS class) */}
      <div className={`webview-overlay ${overlayVisible ? '' : 'hidden'}`} role="dialog" aria-modal="true" onPointerDown={(e) => { if (e.target === e.currentTarget) { if (isPWA() && !isMobile()) { e.preventDefault(); setShowCloseConfirm(true) } else if (active) { closeWebview(active.id) } } }}> 
        <div className={`webview-window ${active && active.maximized ? 'maximized' : ''}`}>
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
              {active && <button className="btn" onClick={() => window.open(active.url, '_blank', 'noopener,noreferrer')} title={t('webview.openExternal') || 'Open in external browser'}><ExternalLink size={14} /></button>}
              {active && (active.maximized ? (
                <button className="btn" onClick={() => restoreMaximizedWebview(active.id)} title={t('webview.restoreWindow') || 'Restore Window'}><Minimize size={14} /></button>
              ) : (
                <button className="btn" onClick={() => maximizeWebview(active.id)} title={t('webview.maximize') || 'Maximize'}><Maximize2 size={14} /></button>
              ))}
              {active && <button className="btn" onClick={() => {
                const ok = minimizeWebview(active.id)
                if (!ok) showToast({ message: t('webview.minimizeLimit') || 'Maximum minimized webviews reached', type: 'info' })
              }} title={t('webview.minimize') || 'Minimize'}><Minimize2 size={14} /></button>}
              {active && <button className="btn close" onClick={() => closeWebview(active.id)} title={t('webview.close') || 'Close'}><X size={14} /></button>}
            </div>
          </div>
          <div className="webview-body">
            {active && loadingMap[active.id] && (
              <div className="webview-loading">Loading…</div>
            )}

            {/* Render an iframe per tab and keep them mounted so minimizing won't lose state */}
            {tabs.map(t => (
              // Allow downloads, clipboard access, and modals/print popups initiated by user interaction inside the iframe (required when sandboxed)
              <iframe
                key={t.id}
                data-wv-id={t.id}
                title={t.title || t.hostname}
                src={t.url}
                sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-downloads allow-modals allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
                allow="clipboard-read; clipboard-write"
                style={{ display: (active && active.id === t.id && !t.minimized) ? 'block' : 'none', width: '100%', height: '100%', border: 0 }}
              />
            ))}
          </div>
        </div>

        {showCloseConfirm && (
          <div className="webview-close-confirm" role="alertdialog" aria-modal="true" aria-labelledby="webview-close-title">
            <div className="webview-close-confirm-card">
              <h3 id="webview-close-title">{t('webview.closeConfirm.title') || "Close webview?"}</h3>
              <p>{t('webview.closeConfirm.message') || "You're about to close this window. Open in external browser instead?"}</p>
              <div className="webview-close-confirm-actions">
                <button className="btn" onClick={() => setShowCloseConfirm(false)}>{t('common.cancel') || 'Cancel'}</button>
                <button className="btn btn-danger" onClick={() => { if (active) { closeWebview(active.id) }; setShowCloseConfirm(false) }}>{t('webview.closeConfirm.confirm') || 'Close'}</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Side tray for minimized tabs */}
      {minimizedTabs.length > 0 && (
        <div className="webview-tray" role="toolbar" aria-label={t('webview.trayLabel') || 'Minimized webviews'}>
          {minimizedTabs.map(m => (
            <div key={m.id} className="webview-tray-item" title={m.title || m.hostname} onClick={() => restoreWebview(m.id)}>
              <div className="webview-tray-favicon">{(m.hostname && m.hostname[0]) || 'W'}</div>
              <div className="webview-tray-title">{m.title || m.hostname}</div>
              <button className="webview-tray-close" onClick={(e) => { e.stopPropagation(); closeWebview(m.id) }} aria-label={t('webview.close') || 'Close'}>×</button>
            </div>
          ))}
        </div>
      )}
      <style>{`
        .webview-overlay { position: fixed; inset: 0; z-index: 1200; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; }
        .webview-overlay.hidden { display: none !important; pointer-events: none; }
        .webview-window { width: 90%; height: 85%; background: var(--bg-primary); border-radius: 8px; overflow: hidden; display:flex; flex-direction:column; box-shadow: 0 10px 30px rgba(2,6,23,0.6); }
        .webview-window.maximized { width: 100%; height: 100%; border-radius: 0; }
        .webview-window.maximized .webview-body iframe { height: calc(100% - 46px); } /* ensure iframe fills under header */
        .webview-header { display:flex; align-items:center; justify-content:space-between; padding:6px 8px; gap:8px; background: var(--bg-secondary); border-bottom: 1px solid var(--border-color); }
        .webview-tabs { display:flex; gap:6px; overflow:auto; }
        .webview-tab { background: transparent; border: none; color: var(--text-primary); padding:6px 10px; border-radius:6px; display:flex; align-items:center; gap:8px; }
        .webview-tab.active { background: var(--bg-accent); color: var(--text-on-accent); }
        .webview-close { margin-left:6px; display:inline-flex; align-items:center; padding-left:6px; }
        .webview-actions { display:flex; gap:6px; align-items:center }
        .webview-body { flex:1; position:relative }
        .webview-body iframe { width:100%; height:100%; border:0 }



        .webview-close-confirm { position: absolute; inset: 0; display:flex; align-items:center; justify-content:center; z-index:1300; pointer-events:auto; }
        .webview-close-confirm-card { background: var(--bg-primary); border-radius:10px; padding:16px; width: min(520px, 92%); box-shadow: 0 12px 40px rgba(2,6,23,0.6); border: 1px solid var(--border-color); color: var(--text-primary) }
        .webview-close-confirm-card h3 { margin:0 0 8px 0; font-size:1rem }
        .webview-close-confirm-card p { margin:0; opacity:0.9 }
        .webview-close-confirm-actions { margin-top:12px; display:flex; gap:8px; justify-content:flex-end }

        .webview-loading { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:linear-gradient(180deg, rgba(2,6,23,0.45), rgba(2,6,23,0.65)); color:var(--text-primary); z-index:2; font-weight:600 }
      `}</style>
    </>
  )
}
