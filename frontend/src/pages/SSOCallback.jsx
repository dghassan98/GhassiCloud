import { useEffect } from 'react'
import { useLanguage } from '../context/LanguageContext'

export default function SSOCallback() {
  const { t } = useLanguage()

  useEffect(() => {
    // Parse the authorization response from URL
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const error = params.get('error')
    const errorDescription = params.get('error_description')

    // Debug: log callback params for investigation
    try { console.debug('SSOCallback loaded', { code, state, error, errorDescription }) } catch (e) {}

    // Check if this is a silent refresh in an iframe
    const isSilentRefresh = sessionStorage.getItem('sso_silent_refresh') === 'true'
    
    // If running inside a popup or iframe (normal interactive flow or silent refresh), post to parent
    if (window.opener || window.parent !== window) {
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
      // If no opener/parent and not a silent iframe (direct navigation), redirect to login
      window.location.href = '/login'
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
