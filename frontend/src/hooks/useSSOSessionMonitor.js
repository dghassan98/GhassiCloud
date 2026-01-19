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
  refreshTimeoutMs = 3000, 
  refreshCooldownMs = 3000,
  proactiveRefreshIntervalMs = 5 * 60 * 1000,
  showWarning = true,
} = {}) {
  const intervalRef = useRef(null)
  const warningShownRef = useRef(false)
  const lastCheckRef = useRef(0)
  const refreshInProgressRef = useRef(false)
  const lastRefreshAttemptRef = useRef(0)
  const [sessionStatus, setSessionStatus] = useState({
    valid: true,
    expiresIn: null,
    checking: false,
    lastChecked: null,
    warning: false,
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

  const attemptSilentRefresh = useCallback(async () => {
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
              logger.warn('Silent refresh failed:', error || 'no code')
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
      logger.info('SSO session expired, attempting silent refresh...')
      
      const refreshed = await attemptSilentRefresh()
      
      if (refreshed) {
        warningShownRef.current = false
        setSessionStatus(prev => ({ ...prev, valid: true, warning: false }))
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
        
        const refreshed = await attemptSilentRefresh()
        
        if (refreshed) {
          warningShownRef.current = false
          setSessionStatus(prev => ({ ...prev, warning: false }))
        } else if (showWarning && onSessionWarning) {
          onSessionWarning(result.expiresIn)
        }
      }
    } else {
      logger.debug('SSO session valid, no action needed')
      warningShownRef.current = false
    }
  }, [isSSO, user, validateSession, attemptSilentRefresh, onSessionWarning, onSessionExpired, logout, warningThresholdSec])

  useEffect(() => {
    if (!isSSO || !user) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    performCheck()
    intervalRef.current = setInterval(performCheck, checkIntervalMs)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isSSO, user, performCheck, checkIntervalMs])

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
  }, [isSSO, user, performCheck])

  return {
    sessionStatus,
    validateSession,
    attemptSilentRefresh,
    isSSO,
  }
}

export default useSSOSessionMonitor
