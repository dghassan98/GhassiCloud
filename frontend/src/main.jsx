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

try { if (typeof globalThis !== 'undefined') globalThis.logger = logger } catch (e) {}

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

const getAuthToken = () => {
  try {
    const t = localStorage.getItem('ghassicloud-token')
    if (!t) return null
    return t.startsWith('Bearer ') ? t : `Bearer ${t}`
  } catch (e) { return null }
}

;(async () => {
  try {
    const token = getAuthToken()
    if (!token) return

    const res = await fetch('/api/auth/admin/settings/logLevel', { headers: { Authorization: token } })
    if (res.ok) {
      const data = await res.json()
      if (data && data.value) {
        try { logger.setLevel(data.value) } catch (e) { logger.error('Failed to set log level:', e) }
        try { window.LOG_LEVEL = data.value } catch (e) { logger.error('Failed to set window.LOG_LEVEL:', e) }
      }
    }
  } catch (e) {
    logger.error('Failed to fetch stored log level on app start:', e)
  }
})()

window.addEventListener('ghassicloud:settings-updated', (e) => {
  try {
    const d = e && e.detail
    if (!d || !d.key) return
    if (d.key === 'logLevel' && d.value) {
      try { logger.setLevel(d.value); window.LOG_LEVEL = d.value } catch (err) { logger.error('Failed to set log level:', err) }
    }
  } catch (err) { logger.error('Failed to apply updated settings from event:', err) }
})

if (typeof window !== 'undefined' && typeof window.isPWA === 'undefined') {
  try { window.isPWA = isPWA } catch (e) { logger.error('Failed to set global isPWA:', e) }
}

// Disable right-click everywhere in the app
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
