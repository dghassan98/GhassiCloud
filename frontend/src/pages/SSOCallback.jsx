import { useEffect } from 'react'
import { useLanguage } from '../context/LanguageContext'

export default function SSOCallback() {
  const { t } = useLanguage()

  useEffect(() => {
    // Create an AbortController to handle cleanup
    const abortController = new AbortController()
    let isNavigating = false
    
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
      
      // If we have a popup opener, always try to communicate back and close
      if (window.opener) {
        try {
          window.opener.postMessage({
            type: 'SSO_CALLBACK',
            code,
            state,
            error: error ? (errorDescription || error) : null
          }, window.location.origin)
          
          // Try to close this popup/tab
          window.close()
          
          // If window.close() didn't work (some browsers block it), 
          // wait a moment then handle directly
          setTimeout(() => {
            // If we're still here, the window didn't close
            // Handle the callback directly
            handleDirectCallback()
          }, 1000)
          return
        } catch (e) {
          console.error('Failed to communicate with opener:', e)
          // Fall through to direct handling
        }
      }
      
      // Handle callback directly (redirect flow, no opener, or fallback)
      await handleDirectCallback()
      
      async function handleDirectCallback() {
        // Check if we're already navigating or aborted
        if (isNavigating || abortController.signal.aborted) return
        
        // Handle errors
        if (error) {
          console.error('SSO error:', errorDescription || error)
          localStorage.setItem('sso_error', errorDescription || error)
          cleanupSSOData()
          // Use full page reload to ensure clean state
          isNavigating = true
          window.location.href = '/login'
          return
        }

        // Get saved state from storage (try sessionStorage first, then localStorage)
        const savedState = sessionStorage.getItem('sso_state') || localStorage.getItem('sso_state')
        
        // Verify state
        if (!savedState) {
          console.error('No saved state found - session may have expired')
          localStorage.setItem('sso_error', 'Session expired. Please try logging in again.')
          cleanupSSOData()
          isNavigating = true
          window.location.href = '/login'
          return
        }
        
        if (state !== savedState) {
          console.error('Invalid state parameter', { received: state, expected: savedState })
          localStorage.setItem('sso_error', 'Security validation failed. Please try again.')
          cleanupSSOData()
          isNavigating = true
          window.location.href = '/login'
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
              }),
              signal: abortController.signal
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

            // Notify parent window (useful when running inside an iframe/webview)
            if (window.parent && window.parent !== window) {
              try {
                window.parent.postMessage({ type: 'SSO_CALLBACK', success: true }, window.location.origin)
              } catch (e) {
                console.debug('Failed to post message to parent after SSO', e)
              }
            }

            // NOTE: do not auto-apply server preferences on SSO redirect login; user must enable Sync in Settings to apply server prefs.
            // Leave local sync marker unchanged so the user's device preference isn't overwritten.

            // Clean up SSO session data
            cleanupSSOData()
            localStorage.removeItem('sso_error')
            
            isNavigating = true
            window.location.href = '/'
          } catch (err) {
            // Ignore abort errors - they're expected when component unmounts
            if (err.name === 'AbortError') {
              console.debug('SSO callback request was cancelled (component unmounting)')
              return
            }
            
            console.error('SSO token exchange failed:', err)
            localStorage.setItem('sso_error', err.message || 'Authentication failed')
            cleanupSSOData()
            isNavigating = true
            window.location.href = '/login'
          }
        } else {
          // No code provided, redirect to login
          cleanupSSOData()
          isNavigating = true
          window.location.href = '/login'
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
    
    // Cleanup function to abort pending requests if component unmounts
    return () => {
      abortController.abort()
    }
  }, []) // No dependencies - we use window.location for navigation

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
