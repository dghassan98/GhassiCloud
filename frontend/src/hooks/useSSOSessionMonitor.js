import { useEffect, useRef, useCallback, useState } from 'react'
import logger from '../logger'

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
 * @param {number} options.refreshTimeoutMs - Timeout for silent refresh iframe in milliseconds (default: 3000 = 3s)
 * @param {number} options.refreshCooldownMs - Minimum time between refresh attempts in milliseconds (default: 3000 = 3s)
 */
export function useSSOSessionMonitor({
  user,
  logout,
  onSessionWarning,
  onSessionExpired,
  checkIntervalMs = 60000,
  warningThresholdSec = 300,
  refreshTimeoutMs = 10000, 
  refreshCooldownMs = 3000,
  proactiveRefreshIntervalMs = 5 * 60 * 1000,
  showWarning = true,
} = {}) {
  const intervalRef = useRef(null)
  const proactiveIntervalRef = useRef(null)
  const warningShownRef = useRef(false)
  const lastCheckRef = useRef(0)
  const refreshInProgressRef = useRef(false)
  const lastRefreshAttemptRef = useRef(0)
  const startupWarmupDoneRef = useRef(false)
  const [sessionStatus, setSessionStatus] = useState({
    valid: true,
    expiresIn: null,
    checking: false,
    lastChecked: null,
    warning: false,
    needsReauth: false,
    sessionWarmedUp: false,
  })

  const isSSO = user && (
    user.ssoProvider || 
    user.sso_provider || 
    localStorage.getItem('ghassicloud-sso') === 'true'
  )

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
        logger.warn('SSO validation request failed:', res.status)
        return { valid: true, checkFailed: true }
      }

      const data = await res.json()
      lastCheckRef.current = Date.now()

      setSessionStatus({
        valid: data.valid,
        expiresIn: data.expiresIn || null,
        checking: false,
        lastChecked: new Date(),
        warning: showWarning && data.expiresIn && data.expiresIn <= warningThresholdSec,
      })

      return data
    } catch (err) {
      logger.error('SSO session validation error:', err)
      setSessionStatus(prev => ({ ...prev, checking: false }))
      return { valid: true, checkFailed: true }
    }
  }, [isSSO, warningThresholdSec])

  /**
   * Refresh Keycloak tokens server-side using the stored refresh_token.
   * This keeps the Keycloak server-side session alive and returns a fresh
   * GhassiCloud JWT + the Keycloak id_token (for id_token_hint in silent iframe).
   */
  const refreshTokensServerSide = useCallback(async () => {
    if (!isSSO) return { success: false }

    const token = localStorage.getItem('ghassicloud-token')
    if (!token) return { success: false }

    try {
      const res = await fetch('/api/auth/sso/token-refresh', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        logger.warn('Server-side token refresh failed:', res.status, data)
        return { success: false, needsReauth: data.needsReauth || false }
      }

      const data = await res.json()

      // Update the stored JWT with the fresh one
      if (data.token) {
        localStorage.setItem('ghassicloud-token', data.token)
        logger.info('Updated GhassiCloud JWT from server-side token refresh')
      }
      // Store fresh id_token for future warmups
      if (data.idToken) {
        localStorage.setItem('ghassicloud-id-token', data.idToken)
      }
      // Store identity provider hint for silent refresh kc_idp_hint
      if (data.identityProvider) {
        localStorage.setItem('ghassicloud-idp-hint', data.identityProvider)
      }

      return { success: true, idToken: data.idToken || null, identityProvider: data.identityProvider || null }
    } catch (err) {
      logger.error('Server-side token refresh error:', err)
      return { success: false }
    }
  }, [isSSO])

  const attemptSilentRefresh = useCallback(async (idTokenHint, idpHint) => {
    if (!isSSO) return false

    const token = localStorage.getItem('ghassicloud-token')
    if (!token) return false

    if (refreshInProgressRef.current) {
      logger.debug('Refresh already in progress, skipping...')
      return false
    }

    const timeSinceLastAttempt = Date.now() - lastRefreshAttemptRef.current
    if (timeSinceLastAttempt < refreshCooldownMs) {
      logger.debug('Refresh cooldown active, skipping...')
      return false
    }

    refreshInProgressRef.current = true
    lastRefreshAttemptRef.current = Date.now()

    try {
      const configRes = await fetch('/api/auth/sso/refresh-config', {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!configRes.ok) {
        refreshInProgressRef.current = false
        return false
      }
      const config = await configRes.json()

      return new Promise((resolve) => {
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
          sessionStorage.setItem('sso_silent_refresh', 'true')
          sessionStorage.setItem('sso_code_verifier', codeVerifier)
          
          const state = crypto.randomUUID()
          sessionStorage.setItem('sso_state', state)

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
          authUrl.searchParams.set('prompt', 'none')

          // When id_token_hint is provided, Keycloak can identify the user
          // even without a session cookie - critical for PWA restart scenarios
          if (idTokenHint) {
            authUrl.searchParams.set('id_token_hint', idTokenHint)
          }

          // kc_idp_hint tells Keycloak which social provider to forward to.
          // This is CRITICAL for silent re-auth with social logins (Google, GitHub, etc.)
          // Without it, Keycloak has no session cookie and returns login_required.
          // With it, Keycloak forwards prompt=none to Google, which auto-completes.
          const effectiveIdpHint = idpHint || localStorage.getItem('ghassicloud-idp-hint')
          if (effectiveIdpHint) {
            authUrl.searchParams.set('kc_idp_hint', effectiveIdpHint)
            logger.info('Silent refresh: using kc_idp_hint =', effectiveIdpHint)
          }

          const iframe = document.createElement('iframe')
          iframe.style.display = 'none'
          iframe.setAttribute('aria-hidden', 'true')

          const timeout = setTimeout(() => {
            try {
              document.body.removeChild(iframe)
            } catch (e) {}
            sessionStorage.removeItem('sso_silent_refresh')
            refreshInProgressRef.current = false
            resolve(false)
          }, refreshTimeoutMs)

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
              logger.warn('Silent refresh failed:', error || 'no code', '| idpHint:', effectiveIdpHint || 'none')
              refreshInProgressRef.current = false
              resolve(false)
              return
            }

            const savedState = sessionStorage.getItem('sso_state')
            if (returnedState !== savedState) {
              refreshInProgressRef.current = false
              resolve(false)
              return
            }

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
                if (data.idToken) localStorage.setItem('ghassicloud-id-token', data.idToken)
                logger.info('Silent token refresh successful')
                refreshInProgressRef.current = false
                resolve(true)
              } else {
                refreshInProgressRef.current = false
                resolve(false)
              }
            } catch (err) {
              logger.error('Silent refresh token exchange failed:', err)
              refreshInProgressRef.current = false
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
      logger.error('Silent refresh error:', err)
      refreshInProgressRef.current = false
      return false
    }
  }, [isSSO])

  const performCheck = useCallback(async () => {
    if (!isSSO || !user) return

    const result = await validateSession()

    if (!result.valid && !result.checkFailed) {
      logger.info('SSO session expired, attempting server-side refresh + silent iframe...')

      // Step 1: Refresh tokens server-side (keeps Keycloak session alive)
      const serverRefresh = await refreshTokensServerSide()

      // Step 2: Attempt silent iframe with id_token_hint from server refresh
      const idpHint = serverRefresh.identityProvider || localStorage.getItem('ghassicloud-idp-hint') || null
      const refreshed = await attemptSilentRefresh(serverRefresh.idToken || null, idpHint)
      
      if (refreshed) {
        warningShownRef.current = false
        setSessionStatus(prev => ({ ...prev, valid: true, warning: false, needsReauth: false, sessionWarmedUp: true }))
      } else if (serverRefresh.needsReauth) {
        logger.warn('Keycloak session fully expired, needs full re-auth')
        setSessionStatus(prev => ({ ...prev, valid: false, needsReauth: true }))
        if (onSessionExpired) {
          onSessionExpired()
        } else {
          logout && logout()
        }
      } else {
        logger.warn('Silent refresh failed, logging out')
        if (onSessionExpired) {
          onSessionExpired()
        } else {
          logout && logout()
        }
      }
      return
    }

    if (result.expiresIn && result.expiresIn <= warningThresholdSec) {
      if (!warningShownRef.current) {
        warningShownRef.current = true
        
        const serverRefresh = await refreshTokensServerSide()
        const idpHint = serverRefresh.identityProvider || localStorage.getItem('ghassicloud-idp-hint') || null
        const refreshed = await attemptSilentRefresh(serverRefresh.idToken || null, idpHint)
        
        if (refreshed) {
          warningShownRef.current = false
          setSessionStatus(prev => ({ ...prev, warning: false, sessionWarmedUp: true }))
        } else if (showWarning && onSessionWarning) {
          onSessionWarning(result.expiresIn)
        }
      }
    } else {
      logger.debug('SSO session valid, no action needed')
      warningShownRef.current = false
    }
  }, [isSSO, user, validateSession, refreshTokensServerSide, attemptSilentRefresh, onSessionWarning, onSessionExpired, logout, warningThresholdSec])

  /**
   * Startup session warmup: proactively re-establish Keycloak browser session
   * cookies after PWA restart. This prevents the "redirect to Keycloak login"
   * problem when clicking services.
   *
   * Flow:
   * 1. Refresh tokens server-side (keeps Keycloak session alive, gets id_token)
   * 2. Silent iframe with id_token_hint (re-establishes browser session cookie)
   * 3. If silent iframe fails, mark needsReauth for transparent full re-auth
   */
  const warmupSession = useCallback(async () => {
    if (!isSSO || !user) return
    if (startupWarmupDoneRef.current) return
    startupWarmupDoneRef.current = true

    logger.info('SSO startup warmup: re-establishing Keycloak session cookie...')

    // Strategy 1: Try server-side refresh first (extends idle-timed-out sessions)
    // This uses the stored Keycloak refresh_token and returns a fresh id_token.
    const serverRefresh = await refreshTokensServerSide()
    const idpHint = serverRefresh.identityProvider || localStorage.getItem('ghassicloud-idp-hint') || null
    if (serverRefresh.success) {
      const refreshed = await attemptSilentRefresh(serverRefresh.idToken || null, idpHint)
      if (refreshed) {
        logger.info('SSO startup warmup: Session cookie re-established via server-side refresh')
        setSessionStatus(prev => ({ ...prev, sessionWarmedUp: true, needsReauth: false }))
        return
      }
    }

    // Strategy 2: Try with stored id_token from localStorage
    // (works even without backend refresh_token, as long as Keycloak session is alive)
    const storedIdToken = localStorage.getItem('ghassicloud-id-token')
    if (storedIdToken) {
      logger.info('SSO startup warmup: trying with stored id_token_hint...')
      const refreshed = await attemptSilentRefresh(storedIdToken, idpHint)
      if (refreshed) {
        logger.info('SSO startup warmup: Session cookie re-established via stored id_token')
        setSessionStatus(prev => ({ ...prev, sessionWarmedUp: true, needsReauth: false }))
        return
      }
    }

    // Strategy 3: Try without any hint (works if Keycloak cookie somehow persisted)
    logger.info('SSO startup warmup: trying without id_token_hint...')
    const refreshed = await attemptSilentRefresh(null, idpHint)
    if (refreshed) {
      logger.info('SSO startup warmup: Session cookie was still valid')
      setSessionStatus(prev => ({ ...prev, sessionWarmedUp: true, needsReauth: false }))
      return
    }

    // All strategies failed — Keycloak session is truly gone
    logger.warn('SSO startup warmup: All strategies failed, services may require re-authentication')
    setSessionStatus(prev => ({ ...prev, needsReauth: true }))
  }, [isSSO, user, refreshTokensServerSide, attemptSilentRefresh])

  // Main check interval
  useEffect(() => {
    if (!isSSO || !user) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Run non-destructive warmup in background (tries to re-establish session cookie
    // via silent iframe). Won't redirect or interrupt the user if it fails.
    warmupSession()
    performCheck()
    intervalRef.current = setInterval(performCheck, checkIntervalMs)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isSSO, user, warmupSession, performCheck, checkIntervalMs])

  // Proactive refresh interval to keep Keycloak session cookies alive
  useEffect(() => {
    if (!isSSO || !user) {
      if (proactiveIntervalRef.current) {
        clearInterval(proactiveIntervalRef.current)
        proactiveIntervalRef.current = null
      }
      return
    }

    proactiveIntervalRef.current = setInterval(async () => {
      logger.debug('Proactive SSO refresh: keeping Keycloak session alive...')
      const serverRefresh = await refreshTokensServerSide()
      if (serverRefresh.success) {
        const idpHint = serverRefresh.identityProvider || localStorage.getItem('ghassicloud-idp-hint') || null
        await attemptSilentRefresh(serverRefresh.idToken || null, idpHint)
      }
    }, proactiveRefreshIntervalMs)

    return () => {
      if (proactiveIntervalRef.current) {
        clearInterval(proactiveIntervalRef.current)
        proactiveIntervalRef.current = null
      }
    }
  }, [isSSO, user, refreshTokensServerSide, attemptSilentRefresh, proactiveRefreshIntervalMs])

  // On visibility change (app foregrounded), do warmup if needed
  useEffect(() => {
    if (!isSSO || !user) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const timeSinceLastCheck = Date.now() - lastCheckRef.current
        if (timeSinceLastCheck > 5000) {
          performCheck()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isSSO, user, warmupSession, performCheck])

  /**
   * Ensure SSO session is ready (cookies exist or can be restored).
   * Call this before opening services. Returns true if ready, false if needs full re-auth.
   */
  const ensureSessionReady = useCallback(async () => {
    if (!isSSO || !user) return true

    // If warmup already succeeded, we're good
    if (sessionStatus.sessionWarmedUp) return true

    // Try warmup strategies
    logger.info('ensureSessionReady: attempting session restoration...')

    const idpHint = localStorage.getItem('ghassicloud-idp-hint') || null

    // Strategy 1: Server-side refresh
    const serverRefresh = await refreshTokensServerSide()
    if (serverRefresh.success) {
      const refreshed = await attemptSilentRefresh(serverRefresh.idToken || null, serverRefresh.identityProvider || idpHint)
      if (refreshed) {
        setSessionStatus(prev => ({ ...prev, sessionWarmedUp: true, needsReauth: false }))
        return true
      }
    }

    // Strategy 2: Stored id_token
    const storedIdToken = localStorage.getItem('ghassicloud-id-token')
    if (storedIdToken) {
      const refreshed = await attemptSilentRefresh(storedIdToken, idpHint)
      if (refreshed) {
        setSessionStatus(prev => ({ ...prev, sessionWarmedUp: true, needsReauth: false }))
        return true
      }
    }

    // Strategy 3: No hint
    const refreshed = await attemptSilentRefresh(null, idpHint)
    if (refreshed) {
      setSessionStatus(prev => ({ ...prev, sessionWarmedUp: true, needsReauth: false }))
      return true
    }

    // All silent strategies failed - need full re-auth
    logger.warn('ensureSessionReady: silent methods failed, full re-auth needed')
    return false
  }, [isSSO, user, sessionStatus.sessionWarmedUp, refreshTokensServerSide, attemptSilentRefresh])

  return {
    sessionStatus,
    validateSession,
    attemptSilentRefresh,
    refreshTokensServerSide,
    warmupSession,
    ensureSessionReady,
    isSSO,
  }
}

export default useSSOSessionMonitor
