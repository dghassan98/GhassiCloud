import { useState, useEffect, useCallback, useRef } from 'react'

// Default English strings - translations passed via props from parent
const defaultStrings = {
  title: 'Session Expiring Soon',
  description: 'Your login session is about to expire. Would you like to stay logged in?',
  logout: 'Log Out',
  stayLoggedIn: 'Stay Logged In',
  helperText: "Click 'Stay Logged In' to continue your session"
}

/**
 * Session Expiration Warning Modal
 * Displays a warning when the user's SSO session is about to expire,
 * offering options to extend the session or logout.
 */
export default function SessionExpirationWarning({ 
  expiresInSeconds, 
  onExtendSession, 
  onLogout,
  onDismiss,
  visible,
  strings = defaultStrings
}) {
  const t = (key) => {
    const parts = key.split('.')
    if (parts[0] === 'sessionWarning' && strings[parts[1]]) {
      return strings[parts[1]]
    }
    return defaultStrings[parts[1]] || key
  }

  const [countdown, setCountdown] = useState(expiresInSeconds || 300)
  const [extending, setExtending] = useState(false)
  const [error, setError] = useState(null)
  const suppressCountdownRef = useRef(false) // When true, ignore external expiresInSeconds updates (prevents visible bumps during extend)

  // Update countdown
  useEffect(() => {
    if (!visible) return

    // If we're suppressing external updates (e.g., during an extend attempt), don't overwrite local countdown
    if (!suppressCountdownRef.current) {
      setCountdown(expiresInSeconds || 300)
    }

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          // Auto logout when timer reaches 0
          onLogout && onLogout()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [visible, expiresInSeconds, onLogout])

  const handleExtend = useCallback(async () => {
    setExtending(true)
    setError(null)
    // Prevent external updates to the countdown while we attempt a refresh
    suppressCountdownRef.current = true
    let success = false
    try {
      // Expect the callback to return true on success, false on failure
      success = await onExtendSession()
      if (success) {
        onDismiss && onDismiss()
      } else {
        setError('Failed to extend session. Please try again or logout.')
        console.warn('Silent refresh returned false, leaving warning open')
      }
    } catch (err) {
      console.error('Failed to extend session:', err)
      setError('Failed to extend session. Please try again or logout.')
    } finally {
      setExtending(false)
      suppressCountdownRef.current = false
      // If refresh failed, do not increase the visible countdown — keep it the same or lower
      if (!success) {
        setCountdown(prev => Math.min(prev, expiresInSeconds || prev))
      }
    }
  }, [onExtendSession, onDismiss, expiresInSeconds])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!visible) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="session-warning-backdrop"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 9998,
        }}
      />
      
      {/* Modal */}
      <div 
        className="session-warning-modal"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '420px',
          width: '90%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--border-color)',
          zIndex: 9999,
          animation: 'sessionWarningSlideIn 0.3s ease-out',
        }}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-warning-title"
        aria-describedby="session-warning-desc"
      >
        {/* Warning Icon */}
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div 
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 170, 0, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              animation: 'sessionWarningPulse 2s ease-in-out infinite',
            }}
          >
            <svg 
              width="32" 
              height="32" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="#ffaa00"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2 
          id="session-warning-title"
          style={{
            textAlign: 'center',
            color: 'var(--text-primary)',
            fontSize: '1.25rem',
            fontWeight: 600,
            margin: '0 0 8px 0',
          }}
        >
          {t('sessionWarning.title')}
        </h2>

        {/* Description */}
        <p 
          id="session-warning-desc"
          style={{
            textAlign: 'center',
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            margin: '0 0 16px 0',
            lineHeight: 1.5,
          }}
        >
          {t('sessionWarning.description')}
        </p>

        {/* Countdown Timer */}
        <div 
          style={{
            textAlign: 'center',
            marginBottom: '24px',
          }}
        >
          <div 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: countdown <= 60 ? 'rgba(255, 0, 0, 0.1)' : 'rgba(255, 170, 0, 0.1)',
              borderRadius: '8px',
              padding: '12px 24px',
              transition: 'background-color 0.3s ease',
            }}
          >
            <svg 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke={countdown <= 60 ? '#ff4444' : '#ffaa00'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginRight: '8px' }}
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span 
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                fontFamily: 'monospace',
                color: countdown <= 60 ? '#ff4444' : '#ffaa00',
              }}
            >
              {formatTime(countdown)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onLogout}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '0.9rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = 'var(--bg-hover)'
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = 'transparent'
            }}
          >
            {t('sessionWarning.logout')}
          </button>
          
          <button
            onClick={handleExtend}
            disabled={extending}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'var(--accent)',
              color: 'white',
              fontSize: '0.9rem',
              fontWeight: 500,
              cursor: extending ? 'wait' : 'pointer',
              opacity: extending ? 0.7 : 1,
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {extending && (
              <span 
                style={{
                  width: '14px',
                  height: '14px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
            )}
            {t('sessionWarning.stayLoggedIn')}
          </button>
        </div>

        {/* Error message (if extend failed) */}
        {error && (
          <p style={{ textAlign: 'center', color: '#ff4444', fontSize: '0.85rem', margin: '8px 0 0 0' }}>
            {error}
          </p>
        )}

        {/* Helper text */}
        <p 
          style={{
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.75rem',
            margin: '16px 0 0 0',
          }}
        >
          {t('sessionWarning.helperText')}
        </p>
      </div>

      <style>{`
        @keyframes sessionWarningSlideIn {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
        
        @keyframes sessionWarningPulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(255, 170, 0, 0.4);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 0 0 10px rgba(255, 170, 0, 0);
          }
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}
