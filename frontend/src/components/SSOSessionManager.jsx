import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import useSSOSessionMonitor from '../hooks/useSSOSessionMonitor'
import { setEnsureSessionReady, setSessionWarmedUp } from '../hooks/ssoSessionBridge'
import SessionExpirationWarning from './SessionExpirationWarning'
import logger from '../logger'

export default function SSOSessionManager() {
  const { user, logout } = useAuth()
  const { t } = useLanguage()
  
  const [showWarning, setShowWarning] = useState(false)
  const [expiresIn, setExpiresIn] = useState(null)

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


  const { attemptSilentRefresh, sessionStatus, ensureSessionReady } = useSSOSessionMonitor({
    user,
    logout,
    onSessionWarning: handleSessionWarning,
    onSessionExpired: handleSessionExpired,
    checkIntervalMs: 60000,
    warningThresholdSec: 300, 
    proactiveRefreshIntervalMs: 5 * 60 * 1000, 
    showWarning: false, 
  })

  // Expose ensureSessionReady and warmedUp status to the global bridge
  // so ServiceCard can use it without a full React context
  useEffect(() => {
    setEnsureSessionReady(ensureSessionReady)
  }, [ensureSessionReady])
  
  useEffect(() => {
    setSessionWarmedUp(sessionStatus.sessionWarmedUp)
  }, [sessionStatus.sessionWarmedUp])

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
