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

      // Check if we used redirect flow (mobile/PWA)
      const usedRedirectFlow = localStorage.getItem('sso_redirect_flow') === 'true'
      
      // Debug: log callback params for investigation
      console.debug('SSOCallback loaded', { 
        code: !!code, 
        state, 
        error, 
        usedRedirectFlow,
        hasOpener: !!window.opener,
        isInFrame: window.parent !== window
      })

      // Check if this is a silent refresh in an iframe
      const isSilentRefresh = sessionStorage.getItem('sso_silent_refresh') === 'true'
      
      // Determine if we should handle directly or via postMessage
      // Use direct handling if:
      // 1. We explicitly used redirect flow
      // 2. There's no opener (popup was closed or never existed)
      // 3. We're not in an iframe (unless it's PWA which can look like iframe)
      const shouldHandleDirectly = usedRedirectFlow || 
                                    (!window.opener && window.parent === window) ||
                                    (!window.opener && !isSilentRefresh)
      
      if (!shouldHandleDirectly && (window.opener || window.parent !== window)) {
        // Popup or iframe flow - post message to parent
        const targetWindow = window.opener || window.parent
        
        try {
          targetWindow.postMessage({
            type: 'SSO_CALLBACK',
            code,
            state,
            error: error ? (errorDescription || error) : null
          }, window.location.origin)
        } catch (e) {
          console.error('Failed to post message to opener:', e)
          // Fall through to direct handling
        }
        
        // Close this popup window
        if (window.opener) {
          window.close()
          // If close didn't work after 500ms, handle directly
          setTimeout(() => {
            handleDirectCallback()
          }, 500)
          return
        }
      }
      
      // Handle callback directly (redirect flow or fallback)
      await handleDirectCallback()
      
      async function handleDirectCallback() {
        // Handle errors
        if (error) {
          console.error('SSO error:', errorDescription || error)
          localStorage.setItem('sso_error', errorDescription || error)
          cleanupSSOData()
          navigate('/login', { replace: true })
          return
        }

        // Get saved state from storage (try sessionStorage first, then localStorage)
        const savedState = sessionStorage.getItem('sso_state') || localStorage.getItem('sso_state')
        
        // Verify state
        if (!savedState) {
          console.error('No saved state found - session may have expired')
          localStorage.setItem('sso_error', 'Session expired. Please try logging in again.')
          cleanupSSOData()
          navigate('/login', { replace: true })
          return
        }
        
        if (state !== savedState) {
          console.error('Invalid state parameter', { received: state, expected: savedState })
          localStorage.setItem('sso_error', 'Security validation failed. Please try again.')
          cleanupSSOData()
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

            console.debug('Exchanging code for token...')
            
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
            cleanupSSOData()
            localStorage.removeItem('sso_error')
            
            // Navigate to dashboard - the auth context will pick up the new token
            console.debug('SSO authentication successful, navigating to dashboard')
            navigate('/', { replace: true })
          } catch (err) {
            console.error('SSO token exchange failed:', err)
            localStorage.setItem('sso_error', err.message || 'Authentication failed')
            cleanupSSOData()
            navigate('/login', { replace: true })
          }
        } else {
          // No code provided, redirect to login
          cleanupSSOData()
          navigate('/login', { replace: true })
        }
      }
      
      // Helper to clean up all SSO-related storage
      function cleanupSSOData() {
        sessionStorage.removeItem('sso_state')
        sessionStorage.removeItem('sso_redirect_uri')
        sessionStorage.removeItem('sso_code_verifier')
        sessionStorage.removeItem('sso_silent_refresh')
        localStorage.removeItem('sso_state')
        localStorage.removeItem('sso_redirect_uri')
        localStorage.removeItem('sso_code_verifier')
        localStorage.removeItem('sso_redirect_flow')
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
