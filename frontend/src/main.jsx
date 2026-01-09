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
