import { useEffect, useRef, useCallback, useState } from 'react'

/**
 * SSO Session Monitor Hook
 * 
 * Monitors the validity of SSO sessions and handles:
 * - Periodic silent session validation checks
 * - Warning users before session expires
 * - Automatic silent token refresh attempts
 * - Forced logout when session is no longer valid
 * 
 * @param {Object} options
 * @param {Object} options.user - Current user object
 * @param {Function} options.logout - Logout function from AuthContext
 * @param {Function} options.onSessionWarning - Callback when session is about to expire
 * @param {Function} options.onSessionExpired - Callback when session has expired
 * @param {number} options.checkIntervalMs - How often to check session validity (default: 60000ms = 1 min)
 * @param {number} options.warningThresholdSec - Show warning when this many seconds remain (default: 300 = 5 min)
 */
export function useSSOSessionMonitor({
  user,
  logout,
  onSessionWarning,
  onSessionExpired,
  checkIntervalMs = 60000, // Check every minute
  warningThresholdSec = 300, // Warn when 5 minutes remain
} = {}) {
  const intervalRef = useRef(null)
  const warningShownRef = useRef(false)
  const lastCheckRef = useRef(0)
  const [sessionStatus, setSessionStatus] = useState({
    valid: true,
    expiresIn: null,
    checking: false,
    lastChecked: null,
    warning: false,
  })

  // Check if current user is an SSO user
  const isSSO = user && (
    user.ssoProvider || 
    user.sso_provider || 
    localStorage.getItem('ghassicloud-sso') === 'true'
  )

  /**
   * Validate the SSO session with the backend
   */
  const validateSession = useCallback(async () => {
    if (!isSSO) return { valid: true, ssoUser: false }

    const token = localStorage.getItem('ghassicloud-token')
    if (!token) return { valid: false, reason: 'no_token' }

    try {
      setSessionStatus(prev => ({ ...prev, checking: true }))

      const res = await fetch('/api/auth/sso/validate', {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!res.ok) {
        // Server error - don't logout on temporary failures
        console.warn('SSO validation request failed:', res.status)
        return { valid: true, checkFailed: true }
      }

      const data = await res.json()
      lastCheckRef.current = Date.now()

      setSessionStatus({
        valid: data.valid,
        expiresIn: data.expiresIn || null,
        checking: false,
        lastChecked: new Date(),
        warning: data.expiresIn && data.expiresIn <= warningThresholdSec,
      })

      return data
    } catch (err) {
      console.error('SSO session validation error:', err)
      // Network error - don't logout
      setSessionStatus(prev => ({ ...prev, checking: false }))
      return { valid: true, checkFailed: true }
    }
  }, [isSSO, warningThresholdSec])

  /**
   * Attempt silent token refresh using Keycloak's prompt=none
   * This opens an invisible iframe to refresh the session
   */
  const attemptSilentRefresh = useCallback(async () => {
    if (!isSSO) return false

    const token = localStorage.getItem('ghassicloud-token')
    if (!token) return false

    try {
      // Get refresh config from backend
      const configRes = await fetch('/api/auth/sso/refresh-config', {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!configRes.ok) return false
      const config = await configRes.json()

      return new Promise((resolve) => {
        // Generate new PKCE values
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

        generatePKCE().then(({ codeVerifier, codeChallenge }) => {
          // Store for callback handling
          sessionStorage.setItem('sso_silent_refresh', 'true')
          sessionStorage.setItem('sso_code_verifier', codeVerifier)
          
          const state = crypto.randomUUID()
          sessionStorage.setItem('sso_state', state)

          // Build silent auth URL with prompt=none
          const redirectUri = `${window.location.origin}/sso-callback`
          sessionStorage.setItem('sso_redirect_uri', redirectUri)

          const authUrl = new URL(config.authUrl)
          authUrl.searchParams.set('client_id', config.clientId)
          authUrl.searchParams.set('redirect_uri', redirectUri)
          authUrl.searchParams.set('response_type', 'code')
          authUrl.searchParams.set('scope', config.scope)
          authUrl.searchParams.set('state', state)
          authUrl.searchParams.set('code_challenge', codeChallenge)
          authUrl.searchParams.set('code_challenge_method', 'S256')
          authUrl.searchParams.set('prompt', 'none') // Silent auth - no login screen

          // Create hidden iframe for silent refresh
          const iframe = document.createElement('iframe')
          iframe.style.display = 'none'
          iframe.setAttribute('aria-hidden', 'true')

          const timeout = setTimeout(() => {
            document.body.removeChild(iframe)
            sessionStorage.removeItem('sso_silent_refresh')
            resolve(false)
          }, 10000) // 10 second timeout

          // Listen for message from iframe
          const handleMessage = async (event) => {
            if (event.origin !== window.location.origin) return
            if (event.data.type !== 'SSO_CALLBACK') return
            if (!sessionStorage.getItem('sso_silent_refresh')) return

            clearTimeout(timeout)
            window.removeEventListener('message', handleMessage)
            
            try {
              document.body.removeChild(iframe)
            } catch (e) {}

            sessionStorage.removeItem('sso_silent_refresh')

            const { code, state: returnedState, error } = event.data

            if (error || !code) {
              console.log('Silent refresh failed:', error || 'no code')
              resolve(false)
              return
            }

            // Verify state
            const savedState = sessionStorage.getItem('sso_state')
            if (returnedState !== savedState) {
              resolve(false)
              return
            }

            // Exchange code for new token
            try {
              const savedRedirectUri = sessionStorage.getItem('sso_redirect_uri')
              const savedCodeVerifier = sessionStorage.getItem('sso_code_verifier')

              const res = await fetch('/api/auth/sso/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  code,
                  redirectUri: savedRedirectUri,
                  codeVerifier: savedCodeVerifier
                })
              })

              if (res.ok) {
                const data = await res.json()
                localStorage.setItem('ghassicloud-token', data.token)
                console.log('Silent token refresh successful')
                resolve(true)
              } else {
                resolve(false)
              }
            } catch (err) {
              console.error('Silent refresh token exchange failed:', err)
              resolve(false)
            } finally {
              sessionStorage.removeItem('sso_state')
              sessionStorage.removeItem('sso_redirect_uri')
              sessionStorage.removeItem('sso_code_verifier')
            }
          }

          window.addEventListener('message', handleMessage)
          document.body.appendChild(iframe)
          iframe.src = authUrl.toString()
        })
      })
    } catch (err) {
      console.error('Silent refresh error:', err)
      return false
    }
  }, [isSSO])

  /**
   * Main check routine - validates session and handles warnings/expiration
   */
  const performCheck = useCallback(async () => {
    if (!isSSO || !user) return

    const result = await validateSession()

    if (!result.valid && !result.checkFailed) {
      // Session is no longer valid
      console.log('SSO session expired, attempting silent refresh...')
      
      // Try silent refresh first
      const refreshed = await attemptSilentRefresh()
      
      if (refreshed) {
        // Refresh succeeded, reset warning state
        warningShownRef.current = false
        setSessionStatus(prev => ({ ...prev, valid: true, warning: false }))
      } else {
        // Refresh failed, trigger logout
        console.log('Silent refresh failed, logging out')
        if (onSessionExpired) {
          onSessionExpired()
        } else {
          logout && logout()
        }
      }
      return
    }

    // Check if we should show expiration warning
    if (result.expiresIn && result.expiresIn <= warningThresholdSec) {
      if (!warningShownRef.current) {
        warningShownRef.current = true
        
        // Attempt silent refresh in the background
        const refreshed = await attemptSilentRefresh()
        
        if (refreshed) {
          // Refresh succeeded silently
          warningShownRef.current = false
          setSessionStatus(prev => ({ ...prev, warning: false }))
        } else if (onSessionWarning) {
          // Show warning to user
          onSessionWarning(result.expiresIn)
        }
      }
    } else {
      // Reset warning if session was extended
      warningShownRef.current = false
    }
  }, [isSSO, user, validateSession, attemptSilentRefresh, onSessionWarning, onSessionExpired, logout, warningThresholdSec])

  // Start monitoring when SSO user is logged in
  useEffect(() => {
    if (!isSSO || !user) {
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Initial check after a short delay
    const initialTimeout = setTimeout(() => {
      performCheck()
    }, 5000)

    // Set up periodic checks
    intervalRef.current = setInterval(performCheck, checkIntervalMs)

    return () => {
      clearTimeout(initialTimeout)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isSSO, user, performCheck, checkIntervalMs])

  // Also check on visibility change (user returns to tab)
  useEffect(() => {
    if (!isSSO || !user) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Debounce - don't check too frequently
        const timeSinceLastCheck = Date.now() - lastCheckRef.current
        if (timeSinceLastCheck > 30000) { // At least 30 seconds since last check
          performCheck()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isSSO, user, performCheck])

  return {
    sessionStatus,
    validateSession,
    attemptSilentRefresh,
    isSSO,
  }
}

export default useSSOSessionMonitor
