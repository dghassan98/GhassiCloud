import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'

export default function SSOCallback() {
  const { t } = useLanguage()
  const navigate = useNavigate()

  useEffect(() => {
    const handleCallback = async () => {
      // Parse the authorization response from URL
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const state = params.get('state')
      const error = params.get('error')
      const errorDescription = params.get('error_description')

      // Debug: log callback params for investigation
      try { console.debug('SSOCallback loaded', { code, state, error, errorDescription, isPWA: window.matchMedia('(display-mode: standalone)').matches }) } catch (e) {}

      // Check if running in PWA/standalone mode
      const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                     window.navigator.standalone === true

      // Check if this is a silent refresh in an iframe
      const isSilentRefresh = sessionStorage.getItem('sso_silent_refresh') === 'true'
      
      // If running inside a popup or iframe (normal interactive flow or silent refresh), post to parent
      if (window.opener || (window.parent !== window && !isPWA)) {
        const targetWindow = window.opener || window.parent
        
        targetWindow.postMessage({
          type: 'SSO_CALLBACK',
          code,
          state,
          error: error ? (errorDescription || error) : null
        }, window.location.origin)
        
        // Close this popup window (iframes don't need closing)
        if (window.opener) {
          window.close()
        }
      } else {
        // In PWA mode or direct navigation - handle the callback directly
        if (error) {
          console.error('SSO error:', errorDescription || error)
          // Store error for login page to display
          try {
            localStorage.setItem('sso_error', errorDescription || error)
          } catch (e) {}
          navigate('/login', { replace: true })
          return
        }

        // Verify state
        const savedState = sessionStorage.getItem('sso_state') || localStorage.getItem('sso_state')
        if (state !== savedState) {
          console.error('Invalid state parameter')
          try {
            localStorage.setItem('sso_error', 'Security validation failed. Please try again.')
          } catch (e) {}
          navigate('/login', { replace: true })
          return
        }

        if (code) {
          try {
            // Exchange code for token with PKCE code_verifier
            const savedRedirectUri = sessionStorage.getItem('sso_redirect_uri') || 
                                     localStorage.getItem('sso_redirect_uri') ||
                                     `${window.location.origin}/sso-callback`
            const savedCodeVerifier = sessionStorage.getItem('sso_code_verifier') || 
                                      localStorage.getItem('sso_code_verifier')
            
            if (!savedCodeVerifier) {
              throw new Error('Missing authentication data. Please try logging in again.')
            }

            console.debug('Exchanging code for token in PWA mode...')
            
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

            // Store token and user data
            localStorage.setItem('ghassicloud-token', data.token)
            localStorage.setItem('ghassicloud-sso', 'true')
            if (data.user) {
              localStorage.setItem('ghassicloud-user', JSON.stringify({ user: data.user, storedAt: Date.now() }))
            }
            
            // Clean up SSO session data
            sessionStorage.removeItem('sso_state')
            sessionStorage.removeItem('sso_redirect_uri')
            sessionStorage.removeItem('sso_code_verifier')
            localStorage.removeItem('sso_state')
            localStorage.removeItem('sso_redirect_uri')
            localStorage.removeItem('sso_code_verifier')
            localStorage.removeItem('sso_error')
            
            // Navigate to dashboard - the auth context will pick up the new token
            console.debug('SSO authentication successful, navigating to dashboard')
            navigate('/', { replace: true })
          } catch (err) {
            console.error('SSO token exchange failed:', err)
            try {
              localStorage.setItem('sso_error', err.message || 'Authentication failed')
            } catch (e) {}
            navigate('/login', { replace: true })
          }
        } else {
          // No code provided, redirect to login
          navigate('/login', { replace: true })
        }
      }
    }

    handleCallback()
  }, [navigate])

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div className="button-spinner" style={{
          width: '40px',
          height: '40px',
          border: '3px solid var(--border-color)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 1rem'
        }} />
        <p>{t('auth.completingSignIn')}</p>
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
