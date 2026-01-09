import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  // Don't preload user from localStorage on startup. This avoids showing a stale authenticated UI after logout.
  // The `checkAuth()` routine will populate `user` only when a valid token is present and `/api/auth/me` succeeds.
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('ghassicloud-token')
      console.debug('checkAuth: token present?', !!token)
      if (!token) {
        // Ensure any stale local markers are cleaned if there's no token
        try {
          localStorage.removeItem('ghassicloud-user')
          localStorage.removeItem('ghassicloud-sso')
        } catch (e) {}
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
          try { localStorage.setItem('ghassicloud-user', JSON.stringify({ user: data.user, storedAt: Date.now() })) } catch (e) {}

          // Apply server-side preferences to localStorage (so a force-refresh sees them)
          try {
            const prefs = data.user.preferences || {}
            const serverSync = prefs.syncPreferences === true
            if (serverSync) {
              if (prefs.theme) localStorage.setItem('ghassicloud-theme', prefs.theme)
              if (prefs.accent) localStorage.setItem('ghassicloud-accent', prefs.accent)
              if (prefs.customAccent) localStorage.setItem('ghassicloud-custom-accent', prefs.customAccent)
              if (prefs.logo) localStorage.setItem('ghassicloud-logo', prefs.logo)
              localStorage.setItem('ghassicloud-sync-preferences', 'true')
              console.debug('checkAuth: Applied server appearance preferences to localStorage', prefs)
              try { window.dispatchEvent(new CustomEvent('ghassicloud:preferences-updated', { detail: { prefs } })) } catch (e) {}              try { setTimeout(() => { try { window.dispatchEvent(new CustomEvent('ghassicloud:preferences-updated', { detail: { prefs } })) } catch (e) {} }, 150) } catch (e) {}              try { window.__ghassicloud_server_prefs_applied = true } catch (e) {}
            }
          } catch (e) { console.debug('checkAuth: failed to apply server prefs', e) }

          // Synchronize any local, unauthenticated preferences (theme/logo/accent) to server.
          // If the user changed preferences while auth wasn't ready, we should overwrite
          // server values with local values when sync is enabled.
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

            // Only attempt to push local preferences if both local and server explicitly allow syncing
            const localSyncPref = localStorage.getItem('ghassicloud-sync-preferences') !== 'false'
            const serverSyncPref = data.user?.preferences?.syncPreferences === true

            if (Object.keys(toPersist).length > 0 && localSyncPref && serverSyncPref) {
              console.debug('checkAuth: pushing local preferences to server to overwrite differences', toPersist)
              fetch('/api/auth/appearance', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('ghassicloud-token')}` }, body: JSON.stringify(toPersist) })
                .then(() => { try { refreshUser() } catch (e) {} })
                .catch((err) => { console.debug('checkAuth: failed to push local prefs', err) })
            }
          } catch (e) { console.debug('checkAuth: sync local->server error', e) }

          // Keep a local marker for SSO login so UI can detect SSO users even if backend lacks the flag.
          try {
            const isSSO = Boolean(data.user?.ssoProvider || data.user?.sso_provider)
            if (isSSO) {
              localStorage.setItem('ghassicloud-sso', 'true')
            } else {
              localStorage.removeItem('ghassicloud-sso')
            }
          } catch (e) {}
        } else if (res.status === 304) {
          // Not modified — fall back to any stored user from localStorage so contexts can pick up preferences
          console.debug('checkAuth: /me returned 304 Not Modified; falling back to stored user')
          try {
            const stored = JSON.parse(localStorage.getItem('ghassicloud-user') || '{}')
            if (stored && stored.user) {
              setUser(stored.user)
              // Apply stored preferences to localStorage so UI that reads localStorage on startup sees them
              try {
                const prefs = stored.user.preferences || {}
                const serverSync = prefs.syncPreferences === true
                if (serverSync) {
                  if (prefs.theme) localStorage.setItem('ghassicloud-theme', prefs.theme)
                  if (prefs.accent) localStorage.setItem('ghassicloud-accent', prefs.accent)
                  if (prefs.customAccent) localStorage.setItem('ghassicloud-custom-accent', prefs.customAccent)
                  if (prefs.logo) localStorage.setItem('ghassicloud-logo', prefs.logo)
                  localStorage.setItem('ghassicloud-sync-preferences', 'true')
                  console.debug('Applied stored user preferences to localStorage (304 fallback)', prefs)
                } else {
                  localStorage.setItem('ghassicloud-sync-preferences', 'false')
                }
              } catch (e) { console.debug('checkAuth: failed to apply stored prefs', e) }
            }
          } catch (e) { console.debug('checkAuth: failed to parse stored user', e) }
        } else {
          // Token invalid or expired — clear local auth state
          console.debug('checkAuth: /me returned non-ok, clearing token and stored user')
          localStorage.removeItem('ghassicloud-token')
          try { localStorage.removeItem('ghassicloud-user') } catch (e) {}
          try { localStorage.removeItem('ghassicloud-sso') } catch (e) {}
          setUser(null)
        }
      }
    } catch (err) {
      console.error('Auth check failed:', err)
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
    try { localStorage.setItem('ghassicloud-user', JSON.stringify({ user: data.user, storedAt: Date.now() })) } catch (e) {}

    // Apply server preferences to localStorage and enable sync by default where allowed
    try {
      const prefs = data.user.preferences || {}
      const serverSync = prefs.syncPreferences === true
      if (serverSync) {
        if (prefs.theme) localStorage.setItem('ghassicloud-theme', prefs.theme)
        if (prefs.accent) localStorage.setItem('ghassicloud-accent', prefs.accent)
        if (prefs.customAccent) localStorage.setItem('ghassicloud-custom-accent', prefs.customAccent)
        if (prefs.logo) localStorage.setItem('ghassicloud-logo', prefs.logo)
        localStorage.setItem('ghassicloud-sync-preferences', 'true')
        try { window.__ghassicloud_server_prefs_applied = true } catch (e) {}
        try { window.dispatchEvent(new CustomEvent('ghassicloud:preferences-updated', { detail: { prefs } })) } catch (e) {}        try { setTimeout(() => { try { window.dispatchEvent(new CustomEvent('ghassicloud:preferences-updated', { detail: { prefs } })) } catch (e) {} }, 150) } catch (e) {}      } else {
        // Ensure local marker reflects server preference
        localStorage.setItem('ghassicloud-sync-preferences', 'false')
      }
    } catch (e) { console.debug('login: failed to apply server prefs', e) }

    // After login, if there are local preferences that the user set while unauthenticated, sync them to the account
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

      // Only attempt to push local preferences if both local and server explicitly allow syncing
      const localSyncPref = localStorage.getItem('ghassicloud-sync-preferences') !== 'false'
      const serverSyncPref = data.user?.preferences?.syncPreferences === true

      if (Object.keys(toPersist).length > 0 && localSyncPref && serverSyncPref) {
        fetch('/api/auth/appearance', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('ghassicloud-token')}` }, body: JSON.stringify(toPersist) })
          .then(() => { try { refreshUser() } catch (e) {} })
          .catch(() => {})
      }
    } catch (e) {}

    return data
  }

  // Generate PKCE code verifier and challenge
  const generatePKCE = async () => {
    // Generate a random code verifier (43-128 characters, using 64 bytes for safety)
    const array = new Uint8Array(64)
    crypto.getRandomValues(array)
    const codeVerifier = Array.from(array, byte => 
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'[byte % 66]
    ).join('')

    // Generate code challenge using SHA-256
    const encoder = new TextEncoder()
    const data = encoder.encode(codeVerifier)
    const digest = await crypto.subtle.digest('SHA-256', data)
    const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')

    return { codeVerifier, codeChallenge }
  }

  // Detect if we should use redirect flow instead of popup
  // Mobile browsers and PWAs don't handle popups well
  const shouldUseRedirectFlow = () => {
    // PWA/standalone mode detection
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                  window.navigator.standalone === true
    
    // Mobile device detection
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    
    // Touch device with small screen (likely mobile)
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    const isSmallScreen = window.innerWidth < 768
    
    // Firefox on Android has issues with popups in PWA context
    const isFirefoxAndroid = /Android.*Firefox/i.test(navigator.userAgent)
    
    console.debug('SSO flow detection:', { isPWA, isMobile, isTouchDevice, isSmallScreen, isFirefoxAndroid })
    
    return isPWA || isMobile || isFirefoxAndroid || (isTouchDevice && isSmallScreen)
  }

  // SSO Login with popup window (PKCE flow) or redirect flow for mobile/PWA
  const loginWithSSO = useCallback(() => {
    return new Promise(async (resolve, reject) => {
      try {
        // Get SSO config from backend
        const configRes = await fetch('/api/auth/sso/config')
        if (!configRes.ok) {
          throw new Error('Failed to get SSO configuration')
        }
        const config = await configRes.json()

        // Determine if we should use redirect flow
        const useRedirect = shouldUseRedirectFlow()

        // Generate state for CSRF protection
        const state = crypto.randomUUID()
        sessionStorage.setItem('sso_state', state)
        // Always store in localStorage as backup for redirect flow
        localStorage.setItem('sso_state', state)

        // Generate PKCE code verifier and challenge
        const { codeVerifier, codeChallenge } = await generatePKCE()
        sessionStorage.setItem('sso_code_verifier', codeVerifier)
        // Always store in localStorage as backup
        localStorage.setItem('sso_code_verifier', codeVerifier)

        // Build redirect URI for the callback
        const redirectUri = `${window.location.origin}/sso-callback`
        sessionStorage.setItem('sso_redirect_uri', redirectUri)
        localStorage.setItem('sso_redirect_uri', redirectUri)
        
        // Mark that we're using redirect flow so callback knows how to handle it
        if (useRedirect) {
          localStorage.setItem('sso_redirect_flow', 'true')
        }

        // Build authorization URL with PKCE
        const authUrl = new URL(config.authUrl)
        authUrl.searchParams.set('client_id', config.clientId)
        authUrl.searchParams.set('redirect_uri', redirectUri)
        authUrl.searchParams.set('response_type', 'code')
        authUrl.searchParams.set('scope', config.scope)
        authUrl.searchParams.set('state', state)
        authUrl.searchParams.set('code_challenge', codeChallenge)
        authUrl.searchParams.set('code_challenge_method', 'S256')

        // Use redirect flow for mobile/PWA
        if (useRedirect) {
          console.debug('Using redirect flow for SSO (mobile/PWA detected)')
          // Navigate directly to the SSO provider - this replaces the current page
          window.location.href = authUrl.toString()
          // Promise won't resolve here - the page navigates away
          // Authentication will be completed by SSOCallback page
          return
        }

        // Desktop: use popup flow
        console.debug('Using popup flow for SSO (desktop detected)')
        
        // Calculate popup position (centered)
        const width = 500
        const height = 600
        const left = window.screenX + (window.outerWidth - width) / 2
        const top = window.screenY + (window.outerHeight - height) / 2

        // Open popup window
        const popup = window.open(
          authUrl.toString(),
          'GhassiCloud SSO',
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
        )

        if (!popup) {
          // Popup blocked - fall back to redirect flow
          console.debug('Popup blocked, falling back to redirect flow')
          localStorage.setItem('sso_redirect_flow', 'true')
          window.location.href = authUrl.toString()
          return
        }

        // Listen for messages from popup
        const handleMessage = async (event) => {
          if (event.origin !== window.location.origin) return

          if (event.data.type === 'SSO_CALLBACK') {
            window.removeEventListener('message', handleMessage)
            
            const { code, state: returnedState, error } = event.data

            if (error) {
              reject(new Error(error))
              return
            }

            // Verify state
            const savedState = sessionStorage.getItem('sso_state')
            if (returnedState !== savedState) {
              reject(new Error('Invalid state parameter'))
              return
            }

            try {
              // Exchange code for token with PKCE code_verifier
              const savedRedirectUri = sessionStorage.getItem('sso_redirect_uri')
              const savedCodeVerifier = sessionStorage.getItem('sso_code_verifier')
              
              console.log('Exchanging code for token...')
              console.log('Code verifier length:', savedCodeVerifier?.length)
              
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
                console.error('Failed to parse response:', responseText)
                throw new Error('Invalid response from server')
              }

              if (!res.ok) {
                throw new Error(data.message || 'SSO authentication failed')
              }

              localStorage.setItem('ghassicloud-token', data.token)
              // Mark that login was done via SSO so UI can rely on this even if backend lacks the flag
              try { localStorage.setItem('ghassicloud-sso', 'true') } catch (e) {}
              setUser(data.user)
              try { localStorage.setItem('ghassicloud-user', JSON.stringify({ user: data.user, storedAt: Date.now() })) } catch (e) {}
              if (data.user?.avatar) { try { const _img2 = new Image(); _img2.src = data.user.avatar } catch (e) {} }

              // NOTE: do not auto-apply server preferences on SSO popup login; user must enable Sync in Settings to apply server prefs.
              // Leave local sync marker unchanged so the user's device preference isn't overwritten.

              // Clean up
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

        // Check if popup was closed without completing auth
        const checkPopup = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkPopup)
            window.removeEventListener('message', handleMessage)
            // Clean up session storage
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
    // If avatar is being updated, preload and force a reload (cache-bust) so the new image shows immediately
    if (updates && updates.avatar) {
      try {
        const img = new Image()
        img.src = updates.avatar + (updates.avatar.includes('?') ? '&' : '?') + '_=' + Date.now()
      } catch (e) {}
    }
    // Optimistically update local state
    setUser(prev => ({ ...prev, ...updates }))
    try {
      const token = localStorage.getItem('ghassicloud-token')
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = token && token.startsWith('Bearer ') ? token : `Bearer ${token}`
      // Persist changes server-side
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
        console.error('Profile update failed:', text)
      }
    } catch (err) {
      console.error('Failed to update user on server:', err)
    }
  }

  // Refresh the current user object from the server (useful after appearance updates)
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
        console.debug('refreshUser: /api/auth/me returned', data && data.user && data.user.preferences)
        if (data && data.user) {
          setUser(data.user)
          try { localStorage.setItem('ghassicloud-user', JSON.stringify({ user: data.user, storedAt: Date.now() })) } catch (e) {}

          // If the user's preferences indicate syncing is enabled, proactively write the
          // server-side appearance preferences into localStorage so a force-refresh or
          // cleared cache will still apply them in UI components that read localStorage.
          try {
            const prefs = data.user.preferences || {}
            const serverSync = prefs.syncPreferences === true
            if (serverSync) {
              if (prefs.theme) localStorage.setItem('ghassicloud-theme', prefs.theme)
              if (prefs.accent) localStorage.setItem('ghassicloud-accent', prefs.accent)
              if (prefs.customAccent) localStorage.setItem('ghassicloud-custom-accent', prefs.customAccent)
              if (prefs.logo) localStorage.setItem('ghassicloud-logo', prefs.logo)
              localStorage.setItem('ghassicloud-sync-preferences', 'true')
              console.debug('Applied server appearance preferences to localStorage', prefs)

              // Notify other contexts that preferences were updated (useful after force-refresh)
              try { window.dispatchEvent(new CustomEvent('ghassicloud:preferences-updated', { detail: { prefs } })) } catch (e) {}
              try { setTimeout(() => { try { window.dispatchEvent(new CustomEvent('ghassicloud:preferences-updated', { detail: { prefs } })) } catch (e) {} }, 150) } catch (e) {}
            } else {
              // Ensure local marker reflects server preference
              localStorage.setItem('ghassicloud-sync-preferences', 'false')
            }
          } catch (e) { console.debug('Failed to apply server prefs to localStorage', e) }
        }
      } else if (res.status === 304) {
        console.debug('refreshUser: /api/auth/me returned 304 Not Modified; falling back to stored user')
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
                console.debug('Applied stored user preferences to localStorage (304 fallback)', prefs)
              } else {
                localStorage.setItem('ghassicloud-sync-preferences', 'false')
              }
            } catch (e) { console.debug('refreshUser: failed to apply stored prefs', e) }
          }
        } catch (e) { console.debug('refreshUser: failed to parse stored user', e) }
      }
    } catch (err) {
      console.error('Failed to refresh user from server:', err)
    }
  }

  const logout = () => {
    console.debug('logout: clearing local auth state')
    // Grab token and sessionId for best-effort remote revocation
    const token = (() => { try { return localStorage.getItem('ghassicloud-token') } catch (e) { return null } })()

    // Immediately clear local state so UI updates fast
    try { localStorage.removeItem('ghassicloud-token') } catch (e) {}
    try { localStorage.removeItem('ghassicloud-sso') } catch (e) {}
    try { localStorage.removeItem('ghassicloud-user') } catch (e) {}
    setUser(null)

    // Best-effort: if token contains a sessionId, ask backend to revoke that single SSO session
    try {
      if (token) {
        const parts = token.split('.')
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
          const sessionId = payload && payload.sessionId
          if (sessionId) {
            // fire-and-forget; don't block logout UI
            fetch('/api/auth/sessions/revoke', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ sessionId })
            }).then(r => {
              if (!r.ok) console.warn('Session revoke request failed', r.status)
            }).catch(e => console.warn('Session revoke request error', e))
          }
        }
      }
    } catch (e) { console.warn('logout: failed to send session revoke', e) }
  }

  // Persist user in localStorage and preload avatar image whenever user changes
  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem('ghassicloud-user', JSON.stringify({ user, storedAt: Date.now() }))
        if (user.avatar) {
          try { const _img = new Image(); _img.src = user.avatar } catch (e) {}
        }
      } else {
        localStorage.removeItem('ghassicloud-user')
      }
    } catch (e) {}
  }, [user])

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
