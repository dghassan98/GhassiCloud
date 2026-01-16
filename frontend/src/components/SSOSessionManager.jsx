import { useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import useSSOSessionMonitor from '../hooks/useSSOSessionMonitor'
import SessionExpirationWarning from './SessionExpirationWarning'

/**
 * SSO Session Manager Component
 * Monitors SSO session validity and shows expiration warnings.
 * Must be placed inside both AuthProvider and LanguageProvider.
 */
export default function SSOSessionManager() {
  const { user, logout } = useAuth()
  const { t } = useLanguage()
  
  const [showWarning, setShowWarning] = useState(false)
  const [expiresIn, setExpiresIn] = useState(null)

  // Handle session warning callback
  const handleSessionWarning = useCallback((seconds) => {
    console.log('SSO session warning: expires in', seconds, 'seconds')
    setExpiresIn(seconds)
    setShowWarning(true)
  }, [])

  // Handle session expired callback  
  const handleSessionExpired = useCallback(() => {
    console.log('SSO session expired, logging out')
    setShowWarning(false)
    // Set flag so login page can show "session expired" message
    try {
      localStorage.setItem('session_expired', 'true')
    } catch (e) {}
    logout()
  }, [logout])

  // SSO Session Monitor
  // Default behaviour: proactively refresh in background and suppress warnings by default
  const { attemptSilentRefresh } = useSSOSessionMonitor({
    user,
    logout,
    onSessionWarning: handleSessionWarning,
    onSessionExpired: handleSessionExpired,
    checkIntervalMs: 60000, // Check every minute
    warningThresholdSec: 300, // Warn when 5 minutes remain
    proactiveRefreshIntervalMs: 5 * 60 * 1000, // proactive silent refresh every 5 minutes
    showWarning: false, // don't show modal warnings unless refresh fails and hook decides so
  })

  // Handle extend session from warning modal
  const handleExtendSession = useCallback(async () => {
    console.log('User clicked "Stay Logged In", attempting silent refresh...')
    const success = await attemptSilentRefresh()
    if (success) {
      console.log('Session extended successfully')
      setShowWarning(false)
      return true
    }
    // If silent refresh fails, just log it but don't logout immediately
    // Let the warning stay open so user can try again or choose to logout
    console.warn('Failed to extend session - user may need to re-authenticate')
    return false
  }, [attemptSilentRefresh])

  // Get translated strings for the warning modal
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
