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

    // Silent checks (iframe) will include ?silent=1 and have no opener
    const silent = params.get('silent') === '1'

    // Debug: log callback params for investigation
    if (silent) {
      try { console.debug('SSOCallback (silent) loaded', { code, state, error, errorDescription }) } catch (e) {}
    } else {
      try { console.debug('SSOCallback (interactive) loaded', { code, state, error, errorDescription }) } catch (e) {}
    }

    // If running inside a popup (normal interactive flow), post to opener and close
    if (window.opener && !silent) {
      window.opener.postMessage({
        type: 'SSO_CALLBACK',
        code,
        state,
        error: error ? (errorDescription || error) : null
      }, window.location.origin)
      
      // Close this popup window
      window.close()

    // If running inside an iframe for silent session check, post to parent and DO NOT close
    } else if (silent && window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'SSO_SILENT_CALLBACK',
        code,
        state,
        error: error ? (errorDescription || error) : null
      }, window.location.origin)

      // keep the iframe content visible briefly (or show a minimal message)

    } else {
      // If no opener and not a silent iframe (direct navigation), redirect to login
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
