import { useEffect } from 'react'
import { useLanguage } from '../context/LanguageContext'
import logger from '../logger'

export default function SSOCallback() {
  const { t } = useLanguage()

  useEffect(() => {
    const abortController = new AbortController()
    let isNavigating = false
    
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const state = params.get('state')
      const error = params.get('error')
      const errorDescription = params.get('error_description')

      const usedRedirectFlow = localStorage.getItem('sso_redirect_flow') === 'true'
      
      logger.debug('SSOCallback loaded', { 
        code: !!code, 
        state, 
        error, 
        usedRedirectFlow,
        hasOpener: !!window.opener,
        isInFrame: window.parent !== window
      })

      // Silent iframe refresh: just forward raw code/state to the parent
      // and stop — the parent's message handler will exchange the code.
      // This avoids a double-exchange and prevents the iframe from navigating.
      if (window.parent && window.parent !== window && !window.opener) {
        try {
          window.parent.postMessage({
            type: 'SSO_CALLBACK',
            code,
            state,
            error: error ? (errorDescription || error) : null
          }, window.location.origin)
        } catch (e) {
          logger.error('Failed to post message to parent iframe:', e)
        }
        return
      }
      
      if (window.opener) {
        try {
          window.opener.postMessage({
            type: 'SSO_CALLBACK',
            code,
            state,
            error: error ? (errorDescription || error) : null
          }, window.location.origin)
          
          window.close()
          
          setTimeout(() => {
            handleDirectCallback()
          }, 1000)
          return
        } catch (e) {
          logger.error('Failed to communicate with opener:', e)
        }
      }
      
      await handleDirectCallback()
      
      async function handleDirectCallback() {
        if (isNavigating || abortController.signal.aborted) return
        
        if (error) {
          logger.error('SSO error:', errorDescription || error)
          localStorage.setItem('sso_error', errorDescription || error)
          cleanupSSOData()

          isNavigating = true
          window.location.href = '/login'
          return
        }

        const savedState = sessionStorage.getItem('sso_state') || localStorage.getItem('sso_state')
        
        if (!savedState) {
          logger.error('No saved state found - session may have expired')
          localStorage.setItem('sso_error', 'Session expired. Please try logging in again.')
          cleanupSSOData()
          isNavigating = true
          window.location.href = '/login'
          return
        }
        
        if (state !== savedState) {
          logger.error('Invalid state parameter', { received: state, expected: savedState })
          localStorage.setItem('sso_error', 'Security validation failed. Please try again.')
          cleanupSSOData()
          isNavigating = true
          window.location.href = '/login'
          return
        }

        if (code) {
          try {
            const savedRedirectUri = sessionStorage.getItem('sso_redirect_uri') || 
                                     localStorage.getItem('sso_redirect_uri') ||
                                     `${window.location.origin}/sso-callback`
            const savedCodeVerifier = sessionStorage.getItem('sso_code_verifier') || 
                                      localStorage.getItem('sso_code_verifier')
            
            if (!savedCodeVerifier) {
              throw new Error('Missing authentication data. Please try logging in again.')
            }

            logger.debug('Exchanging code for token...')
            
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
              logger.error('Failed to parse response:', responseText)
              throw new Error('Invalid response from server')
            }

            if (!res.ok) {
              throw new Error(data.message || 'SSO authentication failed')
            }

            localStorage.setItem('ghassicloud-token', data.token)
            localStorage.setItem('ghassicloud-sso', 'true')
            if (data.idToken) {
              localStorage.setItem('ghassicloud-id-token', data.idToken)
            }
            if (data.identityProvider) {
              localStorage.setItem('ghassicloud-idp-hint', data.identityProvider)
            }
            if (data.user) {
              localStorage.setItem('ghassicloud-user', JSON.stringify({ user: data.user, storedAt: Date.now() }))
            }

            cleanupSSOData()
            localStorage.removeItem('sso_error')
            
            isNavigating = true
            window.location.href = '/'
          } catch (err) {
            if (err.name === 'AbortError') {
              logger.debug('SSO callback request was cancelled (component unmounting)')
              return
            }
            
            logger.error('SSO token exchange failed:', err)
            localStorage.setItem('sso_error', err.message || 'Authentication failed')
            cleanupSSOData()
            isNavigating = true
            window.location.href = '/login'
          }
        } else {
          cleanupSSOData()
          isNavigating = true
          window.location.href = '/login'
        }
      }
      
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
    
    return () => {
      abortController.abort()
    }
  }, []) 

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
