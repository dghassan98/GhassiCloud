import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { LogoProvider } from './context/LogoContext'
import { AccentProvider } from './context/AccentContext'
import { LanguageProvider } from './context/LanguageContext'
import { ToastProvider } from './context/ToastContext'
import './styles/globals.css'
import { isPWA } from './hooks/useCapacitor'
import logger from './logger'

// Optionally route global console to logger so existing console.* calls respect VITE_LOG_LEVEL
if (typeof window !== 'undefined' && window.console) {
  const originalConsole = { ...window.console }
  window.console = {
    ...originalConsole,
    error: (...a) => logger.error(...a),
    warn:  (...a) => logger.warn(...a),
    info:  (...a) => logger.info(...a),
    log:   (...a) => logger.info(...a),
    debug: (...a) => logger.debug(...a)
  }
}

// Fetch global log level from server and apply to frontend logger (so all users get consistent level)
;(async () => {
  try {
    const res = await fetch('/api/auth/admin/settings/logLevel')
    if (res.ok) {
      const data = await res.json()
      if (data && data.value) {
        try { logger.setLevel(data.value) } catch (e) {}
        try { window.LOG_LEVEL = data.value } catch (e) {}
      }
    }
  } catch (e) {
    // Ignore failures — fallback to default
  }
})()

// React to settings change events (useful for admin changing log level in another tab)
window.addEventListener('ghassicloud:settings-updated', (e) => {
  try {
    const d = e && e.detail
    if (!d || !d.key) return
    if (d.key === 'logLevel' && d.value) {
      try { logger.setLevel(d.value); window.LOG_LEVEL = d.value } catch (err) {}
    }
  } catch (err) {}
})

// Backwards-compat global for legacy code paths that reference `isPWA` without import
if (typeof window !== 'undefined' && typeof window.isPWA === 'undefined') {
  try { window.isPWA = isPWA } catch (e) { /* ignore */ }
}

// 🔧 Disable right-click everywhere in the app
// Prevents the browser context menu from opening on right-click or Shift+F10
document.addEventListener('contextmenu', (e) => e.preventDefault())

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AccentProvider>
        <LogoProvider>
          {/* Move ToastProvider up so AuthProvider can show toasts during auth changes */}
          <ToastProvider>
            <AuthProvider>
              {/* LanguageProvider reads user language when AuthProvider finishes loading */}
              <LanguageProvider>
                <App />
              </LanguageProvider>
            </AuthProvider>
          </ToastProvider>
        </LogoProvider>
      </AccentProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
