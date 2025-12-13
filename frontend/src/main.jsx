import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { LogoProvider } from './context/LogoContext'
import { AccentProvider } from './context/AccentContext'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AccentProvider>
        <LogoProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </LogoProvider>
      </AccentProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
