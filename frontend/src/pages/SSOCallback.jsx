import { useEffect } from 'react'

export default function SSOCallback() {
  useEffect(() => {
    // Parse the authorization response from URL
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const error = params.get('error')
    const errorDescription = params.get('error_description')

    // Send message to parent window
    if (window.opener) {
      window.opener.postMessage({
        type: 'SSO_CALLBACK',
        code,
        state,
        error: error ? (errorDescription || error) : null
      }, window.location.origin)
      
      // Close this popup window
      window.close()
    } else {
      // If no opener (direct navigation), redirect to login
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
        <p>Completing sign in...</p>
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
