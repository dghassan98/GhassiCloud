import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import logger from '../logger'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('ghassicloud-token')
      logger.debug('checkAuth: token present?', !!token)
      if (!token) {
        try {
          localStorage.removeItem('ghassicloud-user')
          localStorage.removeItem('ghassicloud-sso')
        } catch (e) { }
        setUser(null)
        return
      }

      if (token) {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        })
        if (res.ok) {
          const data = await res.json()
          setUser(data.user)
          try { localStorage.setItem('ghassicloud-user', JSON.stringify({ user: data.user, storedAt: Date.now() })) } catch (e) { }

          try {
            const prefs = data.user.preferences || {}
            const serverSync = prefs.syncPreferences === true
            if (serverSync) {
              if (prefs.theme) localStorage.setItem('ghassicloud-theme', prefs.theme)
              if (prefs.accent) localStorage.setItem('ghassicloud-accent', prefs.accent)
              if (prefs.customAccent) localStorage.setItem('ghassicloud-custom-accent', prefs.customAccent)
              if (prefs.logo) localStorage.setItem('ghassicloud-logo', prefs.logo)
              localStorage.setItem('ghassicloud-sync-preferences', 'true')
              logger.debug('checkAuth: Applied server appearance preferences to localStorage', prefs)
              try { window.dispatchEvent(new CustomEvent('ghassicloud:preferences-updated', { detail: { prefs } })) } catch (e) { } try { setTimeout(() => { try { window.dispatchEvent(new CustomEvent('ghassicloud:preferences-updated', { detail: { prefs } })) } catch (e) { } }, 150) } catch (e) { } try { window.__ghassicloud_server_prefs_applied = true } catch (e) { }
            }
          } catch (e) { logger.debug('checkAuth: failed to apply server prefs', e) }


          try {
            const themeLocal = localStorage.getItem('ghassicloud-theme')
            const logoLocal = localStorage.getItem('ghassicloud-logo')
            const accentLocal = localStorage.getItem('ghassicloud-accent')
            const customLocal = localStorage.getItem('ghassicloud-custom-accent')
            const toPersist = {}
            if (themeLocal && themeLocal !== data.user.theme) toPersist.theme = themeLocal
            if (logoLocal && logoLocal !== data.user.logo) toPersist.logo = logoLocal
            if (accentLocal && accentLocal !== data.user.accent) toPersist.accent = accentLocal
            if (customLocal && customLocal !== data.user.customAccent) toPersist.customAccent = customLocal

            const localSyncPref = localStorage.getItem('ghassicloud-sync-preferences') !== 'false'
            const serverSyncPref = data.user?.preferences?.syncPreferences === true

            if (Object.keys(toPersist).length > 0 && localSyncPref && serverSyncPref) {
              logger.debug('checkAuth: pushing local preferences to server to overwrite differences', toPersist)
              fetch('/api/auth/appearance', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('ghassicloud-token')}` }, body: JSON.stringify(toPersist) })
                .then(() => { try { refreshUser() } catch (e) { } })
                .catch((err) => { logger.debug('checkAuth: failed to push local prefs', err) })
            }
          } catch (e) { logger.debug('checkAuth: sync local->server error', e) }

          try {
            const isSSO = Boolean(data.user?.ssoProvider || data.user?.sso_provider)
            if (isSSO) {
              localStorage.setItem('ghassicloud-sso', 'true')
            } else {
              localStorage.removeItem('ghassicloud-sso')
            }
          } catch (e) { }
        } else if (res.status === 304) {
          logger.debug('checkAuth: /me returned 304 Not Modified; falling back to stored user')
          try {
            const stored = JSON.parse(localStorage.getItem('ghassicloud-user') || '{}')
            if (stored && stored.user) {
              setUser(stored.user)
              try {
                const prefs = stored.user.preferences || {}
                const serverSync = prefs.syncPreferences === true
                if (serverSync) {
                  if (prefs.theme) localStorage.setItem('ghassicloud-theme', prefs.theme)
                  if (prefs.accent) localStorage.setItem('ghassicloud-accent', prefs.accent)
                  if (prefs.customAccent) localStorage.setItem('ghassicloud-custom-accent', prefs.customAccent)
                  if (prefs.logo) localStorage.setItem('ghassicloud-logo', prefs.logo)
                  localStorage.setItem('ghassicloud-sync-preferences', 'true')
                  logger.debug('Applied stored user preferences to localStorage (304 fallback)', prefs)
                } else {
                  localStorage.setItem('ghassicloud-sync-preferences', 'false')
                }
              } catch (e) { logger.debug('checkAuth: failed to apply stored prefs', e) }
            }
          } catch (e) { logger.debug('checkAuth: failed to parse stored user', e) }
        } else {
          logger.debug('checkAuth: /me returned non-ok, clearing token and stored user')
          localStorage.removeItem('ghassicloud-token')
          try { localStorage.removeItem('ghassicloud-user') } catch (e) { }
          try { localStorage.removeItem('ghassicloud-sso') } catch (e) { }
          setUser(null)
        }
      }
    } catch (err) {
      logger.error('Auth check failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const login = async (username, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.message || 'Login failed')
    }

    const data = await res.json()
    localStorage.setItem('ghassicloud-token', data.token)
    setUser(data.user)
    try { localStorage.setItem('ghassicloud-user', JSON.stringify({ user: data.user, storedAt: Date.now() })) } catch (e) { }

    try {
      const prefs = data.user.preferences || {}
      const serverSync = prefs.syncPreferences === true
      if (serverSync) {
        if (prefs.theme) localStorage.setItem('ghassicloud-theme', prefs.theme)
        if (prefs.accent) localStorage.setItem('ghassicloud-accent', prefs.accent)
        if (prefs.customAccent) localStorage.setItem('ghassicloud-custom-accent', prefs.customAccent)
        if (prefs.logo) localStorage.setItem('ghassicloud-logo', prefs.logo)
        localStorage.setItem('ghassicloud-sync-preferences', 'true')
        try { window.__ghassicloud_server_prefs_applied = true } catch (e) { }
        try { window.dispatchEvent(new CustomEvent('ghassicloud:preferences-updated', { detail: { prefs } })) } catch (e) { } try { setTimeout(() => { try { window.dispatchEvent(new CustomEvent('ghassicloud:preferences-updated', { detail: { prefs } })) } catch (e) { } }, 150) } catch (e) { }
      } else {
        localStorage.setItem('ghassicloud-sync-preferences', 'false')
      }
    } catch (e) { logger.debug('login: failed to apply server prefs', e) }

    try {
      const themeLocal = localStorage.getItem('ghassicloud-theme')
      const logoLocal = localStorage.getItem('ghassicloud-logo')
      const accentLocal = localStorage.getItem('ghassicloud-accent')
      const customLocal = localStorage.getItem('ghassicloud-custom-accent')
      const toPersist = {}
      if (themeLocal && !data.user.theme) toPersist.theme = themeLocal
      if (logoLocal && !data.user.logo) toPersist.logo = logoLocal
      if (accentLocal && !data.user.accent) toPersist.accent = accentLocal
      if (customLocal && !data.user.customAccent) toPersist.customAccent = customLocal

      const localSyncPref = localStorage.getItem('ghassicloud-sync-preferences') !== 'false'
      const serverSyncPref = data.user?.preferences?.syncPreferences === true

      if (Object.keys(toPersist).length > 0 && localSyncPref && serverSyncPref) {
        fetch('/api/auth/appearance', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('ghassicloud-token')}` }, body: JSON.stringify(toPersist) })
          .then(() => { try { refreshUser() } catch (e) { } })
          .catch(() => { })
      }
    } catch (e) { }

    return data
  }

  // Generate PKCE code verifier and challenge
  const generatePKCE = async () => {
    const array = new Uint8Array(64)
    crypto.getRandomValues(array)
    const codeVerifier = Array.from(array, byte =>
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'[byte % 66]
    ).join('')

    const encoder = new TextEncoder()
    const data = encoder.encode(codeVerifier)
    const digest = await crypto.subtle.digest('SHA-256', data)
    const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')

    return { codeVerifier, codeChallenge }
  }


  const shouldUseRedirectFlow = () => {
    const pwa = isPWA()

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    const isSmallScreen = window.innerWidth < 768

    // Firefox on Android has issues with popups in PWA context
    const isFirefoxAndroid = /Android.*Firefox/i.test(navigator.userAgent)

    logger.debug('SSO flow detection:', { pwa, isMobile, isTouchDevice, isSmallScreen, isFirefoxAndroid })

    return pwa || isMobile || isFirefoxAndroid || (isTouchDevice && isSmallScreen)
  }

  const loginWithSSO = useCallback(() => {
    return new Promise(async (resolve, reject) => {
      try {
        const configRes = await fetch('/api/auth/sso/config')
        if (!configRes.ok) {
          throw new Error('Failed to get SSO configuration')
        }
        const config = await configRes.json()
        const useRedirect = shouldUseRedirectFlow()

        const state = crypto.randomUUID()
        sessionStorage.setItem('sso_state', state)
        localStorage.setItem('sso_state', state)

        const { codeVerifier, codeChallenge } = await generatePKCE()
        sessionStorage.setItem('sso_code_verifier', codeVerifier)
        localStorage.setItem('sso_code_verifier', codeVerifier)

        const redirectUri = `${window.location.origin}/sso-callback`
        sessionStorage.setItem('sso_redirect_uri', redirectUri)
        localStorage.setItem('sso_redirect_uri', redirectUri)

        if (useRedirect) {
          localStorage.setItem('sso_redirect_flow', 'true')
        }

        const authUrl = new URL(config.authUrl)
        authUrl.searchParams.set('client_id', config.clientId)
        authUrl.searchParams.set('redirect_uri', redirectUri)
        authUrl.searchParams.set('response_type', 'code')
        authUrl.searchParams.set('scope', config.scope)
        authUrl.searchParams.set('state', state)
        authUrl.searchParams.set('code_challenge', codeChallenge)
        authUrl.searchParams.set('code_challenge_method', 'S256')

        if (useRedirect) {
          logger.debug('Using redirect flow for SSO (mobile/PWA detected)')
          window.location.href = authUrl.toString()
          return
        }

        logger.debug('Using popup flow for SSO (desktop detected)')

        const width = 500
        const height = 600
        const left = window.screenX + (window.outerWidth - width) / 2
        const top = window.screenY + (window.outerHeight - height) / 2

        const popup = window.open(
          authUrl.toString(),
          'GhassiCloud SSO',
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
        )

        if (!popup) {
          logger.debug('Popup blocked, falling back to redirect flow')
          localStorage.setItem('sso_redirect_flow', 'true')
          window.location.href = authUrl.toString()
          return
        }

        const handleMessage = async (event) => {
          if (event.origin !== window.location.origin) return

          if (event.data.type === 'SSO_CALLBACK') {
            window.removeEventListener('message', handleMessage)

            const { code, state: returnedState, error } = event.data

            if (error) {
              reject(new Error(error))
              return
            }

            const savedState = sessionStorage.getItem('sso_state')
            if (returnedState !== savedState) {
              reject(new Error('Invalid state parameter'))
              return
            }

            try {
              const savedRedirectUri = sessionStorage.getItem('sso_redirect_uri')
              const savedCodeVerifier = sessionStorage.getItem('sso_code_verifier')

              logger.info('Exchanging code for token...')
              logger.debug('Code verifier length:', savedCodeVerifier?.length)

              const res = await fetch('/api/auth/sso/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  code,
                  redirectUri: savedRedirectUri,
                  codeVerifier: savedCodeVerifier
                })
              })

              const responseText = await res.text()
              let data

              try {
                data = responseText ? JSON.parse(responseText) : {}
              } catch (parseError) {
                logger.error('Failed to parse response:', responseText)
                throw new Error('Invalid response from server')
              }

              if (!res.ok) {
                throw new Error(data.message || 'SSO authentication failed')
              }

              localStorage.setItem('ghassicloud-token', data.token)
              try { localStorage.setItem('ghassicloud-sso', 'true') } catch (e) { }
              try { if (data.idToken) localStorage.setItem('ghassicloud-id-token', data.idToken) } catch (e) { }
              setUser(data.user)
              try { localStorage.setItem('ghassicloud-user', JSON.stringify({ user: data.user, storedAt: Date.now() })) } catch (e) { }
              if (data.user?.avatar) { try { const _img2 = new Image(); _img2.src = data.user.avatar } catch (e) { } }

              sessionStorage.removeItem('sso_state')
              sessionStorage.removeItem('sso_redirect_uri')
              sessionStorage.removeItem('sso_code_verifier')

              resolve(data)
            } catch (err) {
              reject(err)
            }
          }
        }

        window.addEventListener('message', handleMessage)

        const checkPopup = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkPopup)
            window.removeEventListener('message', handleMessage)

            sessionStorage.removeItem('sso_state')
            sessionStorage.removeItem('sso_redirect_uri')
            sessionStorage.removeItem('sso_code_verifier')
          }
        }, 500)

      } catch (err) {
        reject(err)
      }
    })
  }, [])

  const updateUser = async (updates) => {
    if (updates && updates.avatar) {
      try {
        const img = new Image()
        img.src = updates.avatar + (updates.avatar.includes('?') ? '&' : '?') + '_=' + Date.now()
      } catch (e) { }
    }
    setUser(prev => ({ ...prev, ...updates }))
    try {
      const token = localStorage.getItem('ghassicloud-token')
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = token && token.startsWith('Bearer ') ? token : `Bearer ${token}`
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates)
      })
      if (res.ok) {
        const data = await res.json()
        if (data && data.user) setUser(data.user)
      } else {
        const text = await res.text()
        logger.error('Profile update failed:', text)
      }
    } catch (err) {
      logger.error('Failed to update user on server:', err)
    }
  }

  const refreshUser = async () => {
    try {
      const token = localStorage.getItem('ghassicloud-token')
      if (!token) return
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      })
      if (res.ok) {
        const data = await res.json()
        logger.debug('refreshUser: /api/auth/me returned', data && data.user && data.user.preferences)
        if (data && data.user) {
          setUser(data.user)
          try { localStorage.setItem('ghassicloud-user', JSON.stringify({ user: data.user, storedAt: Date.now() })) } catch (e) { logger.debug('refreshUser: failed to store user', e) }
          try {
            const prefs = data.user.preferences || {}
            const serverSync = prefs.syncPreferences === true
            if (serverSync) {
              if (prefs.theme) localStorage.setItem('ghassicloud-theme', prefs.theme)
              if (prefs.accent) localStorage.setItem('ghassicloud-accent', prefs.accent)
              if (prefs.customAccent) localStorage.setItem('ghassicloud-custom-accent', prefs.customAccent)
              if (prefs.logo) localStorage.setItem('ghassicloud-logo', prefs.logo)
              localStorage.setItem('ghassicloud-sync-preferences', 'true')
              logger.debug('Applied server appearance preferences to localStorage', prefs)

              try { window.dispatchEvent(new CustomEvent('ghassicloud:preferences-updated', { detail: { prefs } })) } catch (e) { logger.debug('refreshUser: failed to dispatch preferences-updated event', e) }
              try { setTimeout(() => { try { window.dispatchEvent(new CustomEvent('ghassicloud:preferences-updated', { detail: { prefs } })) } catch (e) { logger.debug('refreshUser: failed to dispatch preferences-updated event (delayed)', e) } }, 150) } catch (e) { logger.debug('refreshUser: failed to set timeout for preferences-updated event', e) }
            } else {
              localStorage.setItem('ghassicloud-sync-preferences', 'false')
            }
          } catch (e) { logger.debug('Failed to apply server prefs to localStorage', e) }
        }
      } else if (res.status === 304) {
        logger.debug('refreshUser: /api/auth/me returned 304 Not Modified; falling back to stored user')
        try {
          const stored = JSON.parse(localStorage.getItem('ghassicloud-user') || '{}')
          if (stored && stored.user) {
            setUser(stored.user)
            try {
              const prefs = stored.user.preferences || {}
              const serverSync = prefs.syncPreferences === true
              if (serverSync) {
                if (prefs.theme) localStorage.setItem('ghassicloud-theme', prefs.theme)
                if (prefs.accent) localStorage.setItem('ghassicloud-accent', prefs.accent)
                if (prefs.customAccent) localStorage.setItem('ghassicloud-custom-accent', prefs.customAccent)
                if (prefs.logo) localStorage.setItem('ghassicloud-logo', prefs.logo)
                localStorage.setItem('ghassicloud-sync-preferences', 'true')
                logger.debug('Applied stored user preferences to localStorage (304 fallback)', prefs)
              } else {
                localStorage.setItem('ghassicloud-sync-preferences', 'false')
              }
            } catch (e) { logger.debug('refreshUser: failed to apply stored prefs', e) }
          }
        } catch (e) { logger.debug('refreshUser: failed to parse stored user', e) }
      }
    } catch (err) {
      logger.error('Failed to refresh user from server:', err)
    }
  }

  const logout = () => {
    logger.debug('logout: clearing local auth state')
    const token = (() => { try { return localStorage.getItem('ghassicloud-token') } catch (e) { return null } })()

    try { localStorage.removeItem('ghassicloud-token') } catch (e) { }
    try { localStorage.removeItem('ghassicloud-sso') } catch (e) { }
    try { localStorage.removeItem('ghassicloud-user') } catch (e) { }
    try { localStorage.removeItem('ghassicloud-id-token') } catch (e) { }
    setUser(null)

    try {
      if (token) {
        const parts = token.split('.')
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
          const sessionId = payload && payload.sessionId
          if (sessionId) {
            fetch('/api/auth/sessions/revoke', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ sessionId })
            }).then(r => {
              if (!r.ok) logger.warn('Session revoke request failed', r.status)
            }).catch(e => logger.warn('Session revoke request error', e))
          }
        }
      }
    } catch (e) { logger.warn('logout: failed to send session revoke', e) }
  }

  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem('ghassicloud-user', JSON.stringify({ user, storedAt: Date.now() }))
        if (user.avatar) {
          try { const _img = new Image(); _img.src = user.avatar } catch (e) { }
        }
      } else {
        localStorage.removeItem('ghassicloud-user')
      }
    } catch (e) { }
  }, [user])

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'ghassicloud-token' && e.newValue) {
        checkAuth()
      }
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      loginWithSSO,
      logout,
      checkAuth,
      updateUser,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
