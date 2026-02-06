import { useState, useCallback, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import useSSOSessionMonitor from '../hooks/useSSOSessionMonitor'
import SessionExpirationWarning from './SessionExpirationWarning'
import logger from '../logger'

export default function SSOSessionManager() {
  const { user, logout, loginWithSSO } = useAuth()
  const { t } = useLanguage()
  
  const [showWarning, setShowWarning] = useState(false)
  const [expiresIn, setExpiresIn] = useState(null)
  const reauthAttemptedRef = useRef(false)

  const handleSessionWarning = useCallback((seconds) => {
    logger.info('SSO session warning: expires in', seconds, 'seconds')
    setExpiresIn(seconds)
    setShowWarning(true)
  }, [])

  const handleSessionExpired = useCallback(() => {
    logger.info('SSO session expired, logging out')
    setShowWarning(false)
    try {
      localStorage.setItem('session_expired', 'true')
    } catch (e) {}
    logout()
  }, [logout])


  const { attemptSilentRefresh, sessionStatus } = useSSOSessionMonitor({
    user,
    logout,
    onSessionWarning: handleSessionWarning,
    onSessionExpired: handleSessionExpired,
    checkIntervalMs: 60000,
    warningThresholdSec: 300, 
    proactiveRefreshIntervalMs: 5 * 60 * 1000, 
    showWarning: false, 
  })

  // When needsReauth is flagged (session cookies lost after PWA restart),
  // trigger a transparent full SSO re-auth to re-establish Keycloak cookies
  useEffect(() => {
    if (!sessionStatus.needsReauth || reauthAttemptedRef.current) return
    reauthAttemptedRef.current = true

    logger.info('SSOSessionManager: Keycloak session cookies lost, triggering transparent re-auth...')

    // Use the full SSO login flow which will redirect to Keycloak.
    // If the Keycloak session is still alive server-side (from our refresh),
    // Keycloak will auto-redirect back without showing a login form.
    // If it's truly expired, the user will briefly see the Keycloak login page.
    const triggerReauth = async () => {
      try {
        await loginWithSSO()
        logger.info('SSOSessionManager: Transparent re-auth completed successfully')
      } catch (err) {
        logger.warn('SSOSessionManager: Transparent re-auth failed:', err)
        // Don't log out - the app still works, just services may require re-auth
      }
    }

    // Small delay to let the app finish rendering
    const timer = setTimeout(triggerReauth, 1500)
    return () => clearTimeout(timer)
  }, [sessionStatus.needsReauth, loginWithSSO])

  const handleExtendSession = useCallback(async () => {
    logger.info('User clicked "Stay Logged In", attempting silent refresh...')
    const success = await attemptSilentRefresh()
    if (success) {
      logger.info('Session extended successfully')
      setShowWarning(false)
      return true
    }
    logger.warn('Failed to extend session - user may need to re-authenticate')
    return false
  }, [attemptSilentRefresh])

  const warningStrings = {
    title: t('sessionWarning.title'),
    description: t('sessionWarning.description'),
    logout: t('sessionWarning.logout'),
    stayLoggedIn: t('sessionWarning.stayLoggedIn'),
    helperText: t('sessionWarning.helperText'),
  }

  return (
    <SessionExpirationWarning
      visible={showWarning}
      expiresInSeconds={expiresIn}
      onExtendSession={handleExtendSession}
      onLogout={handleSessionExpired}
      onDismiss={() => setShowWarning(false)}
      strings={warningStrings}
    />
  )
}
