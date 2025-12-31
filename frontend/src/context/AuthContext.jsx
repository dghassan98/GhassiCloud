import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('ghassicloud-user')
      if (!raw) return null
      const parsed = JSON.parse(raw)
      // parsed may be { user, storedAt } or legacy user object
      return parsed.user || parsed
    } catch (e) {
      return null
    }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('ghassicloud-token')
      if (token) {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          setUser(data.user)
          try { localStorage.setItem('ghassicloud-user', JSON.stringify({ user: data.user, storedAt: Date.now() })) } catch (e) {}
          // Keep a local marker for SSO login so UI can detect SSO users even if backend lacks the flag
          try {
            if (data.user?.ssoProvider || data.user?.sso_provider) {
              localStorage.setItem('ghassicloud-sso', 'true')
            } else {
              localStorage.removeItem('ghassicloud-sso')
            }
          } catch (e) {}
        } else {
          localStorage.removeItem('ghassicloud-token')
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
    if (data.user?.avatar) { try { const _img = new Image(); _img.src = data.user.avatar } catch (e) {} }
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

  // SSO Login with popup window (PKCE flow)
  const loginWithSSO = useCallback(() => {
    return new Promise(async (resolve, reject) => {
      try {
        // Get SSO config from backend
        const configRes = await fetch('/api/auth/sso/config')
        if (!configRes.ok) {
          throw new Error('Failed to get SSO configuration')
        }
        const config = await configRes.json()

        // Generate state for CSRF protection
        const state = crypto.randomUUID()
        sessionStorage.setItem('sso_state', state)

        // Generate PKCE code verifier and challenge
        const { codeVerifier, codeChallenge } = await generatePKCE()
        sessionStorage.setItem('sso_code_verifier', codeVerifier)

        // Build redirect URI for the popup callback
        const redirectUri = `${window.location.origin}/sso-callback`
        sessionStorage.setItem('sso_redirect_uri', redirectUri)

        // Build authorization URL with PKCE
        const authUrl = new URL(config.authUrl)
        authUrl.searchParams.set('client_id', config.clientId)
        authUrl.searchParams.set('redirect_uri', redirectUri)
        authUrl.searchParams.set('response_type', 'code')
        authUrl.searchParams.set('scope', config.scope)
        authUrl.searchParams.set('state', state)
        authUrl.searchParams.set('code_challenge', codeChallenge)
        authUrl.searchParams.set('code_challenge_method', 'S256')

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
          throw new Error('Popup blocked. Please allow popups for this site.')
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

  const logout = () => {
    localStorage.removeItem('ghassicloud-token')
    try { localStorage.removeItem('ghassicloud-sso') } catch (e) {}
    localStorage.removeItem('ghassicloud-user')
    setUser(null)
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
    <AuthContext.Provider value={{ user, loading, login, loginWithSSO, logout, checkAuth, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
