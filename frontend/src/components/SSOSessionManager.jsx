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
    logout()
  }, [logout])

  // SSO Session Monitor
  const { attemptSilentRefresh } = useSSOSessionMonitor({
    user,
    logout,
    onSessionWarning: handleSessionWarning,
    onSessionExpired: handleSessionExpired,
    checkIntervalMs: 60000, // Check every minute
    warningThresholdSec: 300, // Warn when 5 minutes remain
  })

  // Handle extend session from warning modal
  const handleExtendSession = useCallback(async () => {
    const success = await attemptSilentRefresh()
    if (success) {
      setShowWarning(false)
      return true
    }
    // If silent refresh fails, logout
    handleSessionExpired()
    return false
  }, [attemptSilentRefresh, handleSessionExpired])

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
