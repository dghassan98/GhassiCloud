import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { 
  User, Lock, Palette, Bell, Shield, Database, 
  Save, Moon, Sun, Monitor, ChevronRight, Check, AlertTriangle
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useLogo, logoOptions } from '../context/LogoContext'
import { useAccent, accentColors } from '../context/AccentContext'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import '../styles/settings.css'
import ErrorBoundary from '../components/ErrorBoundary'


export default function Settings() {
  const { user, logout, updateUser } = useAuth()
  const { theme, setTheme } = useTheme()
  const { currentLogo, setLogo } = useLogo()
  const { currentAccent, setAccent } = useAccent()
  const { t, language, setLanguage } = useLanguage()
  const settingsSections = [
    { id: 'profile', label: t('settings.tabs.profile'), icon: User },
    { id: 'appearance', label: t('settings.tabs.appearance'), icon: Palette },
    { id: 'security', label: t('settings.tabs.security'), icon: Shield },
    { id: 'notifications', label: t('settings.tabs.notifications'), icon: Bell },
    { id: 'data', label: t('settings.tabs.data'), icon: Database }
  ]
  const [activeSection, setActiveSection] = useState('profile')
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [pendingLanguage, setPendingLanguage] = useState(language)
  const [showLangConfirm, setShowLangConfirm] = useState(false)
  const [langToConfirm, setLangToConfirm] = useState(null)

  // Sessions & security preferences (user-facing)
  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [requireReauth, setRequireReauth] = useState(false)

  // Heuristic user-agent parser for friendly names (keeps bundle small)
  const parseUserAgent = (ua) => {
    if (!ua || typeof ua !== 'string' || ua.trim() === '') return { name: t('settings.ua.unknown') || 'Unknown' }
    const s = ua
    // Common checks in order
    const checks = [
      { re: /Electron\/(\d+[\.\d]*)/i, name: 'Electron' },
      { re: /Edg\/(\d+[\.\d]*)/i, name: 'Edge' },
      { re: /OPR\/(\d+[\.\d]*)/i, name: 'Opera' },
      { re: /Chrome\/(\d+[\.\d]*)/i, name: 'Chrome' },
      { re: /CriOS\/(\d+[\.\d]*)/i, name: 'Chrome (iOS)' },
      { re: /Firefox\/(\d+[\.\d]*)/i, name: 'Firefox' },
      { re: /FxiOS\/(\d+[\.\d]*)/i, name: 'Firefox (iOS)' },
      { re: /Version\/(\d+[\.\d]*)\s+Safari\//i, name: 'Safari' },
      { re: /Safari\/(\d+[\.\d]*)/i, name: 'Safari' },
      { re: /Android\s+WebView/i, name: 'Android WebView' },
      { re: /Mobile\/\w+.*Safari/i, name: 'Mobile Safari' },
      { re: /PostmanRuntime\//i, name: 'Postman' },
      { re: /Insomnia\//i, name: 'Insomnia' },
      { re: /curl\/(\d+[\.\d]*)/i, name: 'curl' },
      { re: /python-requests\/(\d+[\.\d]*)/i, name: 'python-requests' },
      { re: /okhttp\/(\d+[\.\d]*)/i, name: 'okhttp' }
    ]
    for (const c of checks) {
      const m = s.match(c.re)
      if (m) {
        return { name: c.name, version: m[1] || null }
      }
    }
    // Fallback: extract product token at start (e.g., "Mozilla/5.0 (...) ...")
    const prod = s.split(' ')[0]
    if (prod && prod.includes('/')) {
      const [prodName, prodVer] = prod.split('/')
      return { name: prodName, version: prodVer }
    }
    return { name: s.slice(0, 30) }
  }

  // confirmation modals
  const [sessionToRevoke, setSessionToRevoke] = useState(null)
  const [showSignoutAllConfirm, setShowSignoutAllConfirm] = useState(false)
  const [revoking, setRevoking] = useState(false)

  // Profile form state
  const [usernameVal, setUsernameVal] = useState(user?.username || '')
  const [emailVal, setEmailVal] = useState(user?.email || '')
  const [displayNameVal, setDisplayNameVal] = useState(user?.displayName || user?.username || '')
  const [firstName, setFirstName] = useState(user?.firstName || '')
  const [lastName, setLastName] = useState(user?.lastName || '')
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || null)
  const [avatarFile, setAvatarFile] = useState(null)

  const { showToast } = useToast()

  // Debug: log modal state transitions to help diagnose why modals don't appear


  // Detect SSO users reliably: backend flag or local marker set during SSO login
  const isSSO = Boolean(
    user?.ssoProvider || user?.sso_provider || (typeof window !== 'undefined' && localStorage.getItem('ghassicloud-sso') === 'true')
  )

  // SSO editor state (admin)
  const [showSSOEditor, setShowSSOEditor] = useState(false)
  const [ssoConfig, setSsoConfig] = useState({ authUrl: '', clientId: '', scope: '', realm: '' })
  const [ssoLoading, setSsoLoading] = useState(false)
  const ssoFirstInputRef = useRef(null)

  const getAuthToken = () => {
    let token = localStorage.getItem('ghassicloud-token')
    if (!token) return null
    return token.startsWith('Bearer ') ? token : `Bearer ${token}`
  }

  const handleLoadSSOConfig = async () => {
    setSsoLoading(true)
    try {
      const res = await fetch('/api/auth/sso/config')
      if (res.ok) {
        const data = await res.json()
        // Parse realm from URL if not provided
        setSsoConfig({ authUrl: data.authUrl || '', clientId: data.clientId || '', scope: data.scope || '', realm: data.realm || '' })
      } else {
        showToast({ message: 'Failed to load SSO configuration', type: 'error' })
      }
    } catch (err) {
      console.error('Load SSO config error:', err)
      showToast({ message: 'Failed to load SSO configuration', type: 'error' })
    } finally {
      setSsoLoading(false)
    }
  }

  const handleSaveSSOConfig = async () => {
    try {
      const token = getAuthToken()
      if (!token) return showToast({ message: 'Not authenticated', type: 'error' })
      const res = await fetch('/api/auth/sso/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': token },
        body: JSON.stringify({ authUrl: ssoConfig.authUrl, clientId: ssoConfig.clientId, scope: ssoConfig.scope })
      })
      if (res.ok) {
        showToast({ message: t('settings.ssoConfig.saved') || 'SSO configuration saved', type: 'success' })
        setShowSSOEditor(false)
      } else {
        const data = await res.json()
        showToast({ message: data.message || 'Failed to save SSO configuration', type: 'error' })
      }
    } catch (err) {
      console.error('Save SSO config error:', err)
      showToast({ message: 'Failed to save SSO configuration', type: 'error' })
    }
  }

  const handleResetSSOConfig = async () => {
    if (!confirm(t('settings.ssoConfig.resetConfirm') || 'Reset SSO config to defaults? This cannot be undone.')) return
    try {
      const token = getAuthToken()
      if (!token) return showToast({ message: 'Not authenticated', type: 'error' })
      const res = await fetch('/api/auth/sso/config', {
        method: 'DELETE',
        headers: { 'Authorization': token }
      })
      if (res.ok) {
        const data = await res.json()
        setSsoConfig({ authUrl: data.authUrl || '', clientId: data.clientId || '', scope: data.scope || '' })
        showToast({ message: t('settings.ssoConfig.resetSuccess') || 'SSO configuration reset to defaults', type: 'success' })
      } else {
        const data = await res.json()
        showToast({ message: data.message || 'Failed to reset SSO configuration', type: 'error' })
      }
    } catch (err) {
      console.error('Reset SSO config error:', err)
      showToast({ message: 'Failed to reset SSO configuration', type: 'error' })
    }
  }

  // Load SSO config when editor is opened
  useEffect(() => {
    if (showSSOEditor) handleLoadSSOConfig()
  }, [showSSOEditor])

  // Load sessions and user security preferences when entering the 'security' section
  const handleLoadSessions = async () => {
    setSessionsLoading(true)
    try {
      const token = getAuthToken()
      if (!token) return setSessions([])
      const r = await fetch('/api/auth/sessions', { headers: { 'Authorization': token } })
      if (!r.ok) {
        console.warn('Failed to load sessions')
        setSessions([])
        return
      }
      const data = await r.json()
      setSessions(data.sessions || [])
    } catch (err) {
      console.error('Load sessions error:', err)
      setSessions([])
    } finally {
      setSessionsLoading(false)
    }
  }

  const loadSecurityPrefs = async () => {
    try {
      const token = getAuthToken()
      if (!token) return
      const r = await fetch('/api/auth/security', { headers: { 'Authorization': token } })
      if (!r.ok) return
      const data = await r.json()
      setRequireReauth(Boolean(data.requireReauth))
    } catch (err) {
      console.error('Load security prefs error:', err)
    }
  }

  useEffect(() => {
    if (activeSection === 'security') {
      handleLoadSessions()
      loadSecurityPrefs()
    }
  }, [activeSection])


  // Focus the SSO modal, trap Escape to close, and prevent background scrolling
  useEffect(() => {
    if (!showSSOEditor) return
    // Focus first input after it renders
    setTimeout(() => ssoFirstInputRef.current?.focus?.(), 60)
    // Prevent background scroll
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') setShowSSOEditor(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [showSSOEditor])

  // DOM manipulations that removed duplicated Security sections caused intermittent
  // "Node.removeChild: The node to be removed is not a child of this node" errors
  // during React reconciliation. Duplicated section renderings were fixed by removing
  // sidebar-only render blocks earlier. Avoid direct DOM removal and rely on React's
  // declarative rendering instead. (Effect removed.)


  // Make SSO button(s) open the SSO editor modal even if there are multiple rendered button instances
  useEffect(() => {
    const label = t('settings.ssoConfig.button')
    const handler = (e) => {
      const el = e.target
      if (!el) return
      try {
        if ((el.textContent || '').trim() === label) setShowSSOEditor(true)
      } catch (err) {
        // ignore
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [t])

  const handleResetServices = async () => {
    setResetting(true)
    try {
      let token = localStorage.getItem('ghassicloud-token')
      if (token && !token.startsWith('Bearer ')) {
        token = `Bearer ${token}`
      }
      const response = await fetch('/api/services/reset/all', {
        method: 'DELETE',
        headers: {
          'Authorization': token
        }
      })
      if (response.ok) {
        setShowResetConfirm(false)
        showToast({ message: t('settings.resetSuccess') || 'All services have been reset successfully!', type: 'success' })
      } else {
        const data = await response.json()
        showToast({ message: data.message || t('settings.resetFailed') || 'Failed to reset services', type: 'error' })
      }
    } catch (err) {
      console.error('Reset services error:', err)
      showToast({ message: t('settings.resetFailed') || 'Failed to reset services', type: 'error' })
    } finally {
      setResetting(false)
    }
  }

  // Sync user into form state when loaded
  useEffect(() => {
    if (!user) return
    setUsernameVal(user.username || '')
    setEmailVal(user.email || '')
    setDisplayNameVal(user.displayName || user.username || '')
    setFirstName(user.firstName || '')
    setLastName(user.lastName || '')
    // Only update language if it differs to avoid loops
    const preferred = user.language || (navigator.language || 'en').split('-')[0]
    if (preferred && preferred !== language) setLanguage(preferred)
    setAvatarPreview(user.avatar || null)
    setAvatarFile(null)
    // Keep pendingLanguage in sync with actual language
    setPendingLanguage(preferred && preferred !== language ? preferred : language)


  }, [user, language, setLanguage])

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      showToast({ message: t('settings.avatarTooLarge') || 'Avatar must be less than 2 MB', type: 'error' })
      return
    }
    const reader = new FileReader()
    reader.onload = () => setAvatarPreview(reader.result)
    reader.readAsDataURL(file)
    setAvatarFile(file)
  }

  const handleRemoveAvatar = () => {
    setAvatarPreview(null)
    setAvatarFile(null)
  }

  const handleSave = async () => {
    // If language was changed but not yet confirmed, open in-app confirmation dialog
    if (pendingLanguage !== language && !showLangConfirm) {
      setLangToConfirm(pendingLanguage)
      setShowLangConfirm(true)
      return
    }

    setSaving(true)
    try {
      const updates = {
        displayName: displayNameVal,
        firstName,
        lastName,
        language, // language will be updated via LanguageContext when confirmed and applied
        avatar: avatarPreview // data URL or existing URL
      }
      // Don't allow changing username/email for SSO users
      if (!isSSO) {
        updates.username = usernameVal
        updates.email = emailVal
      }
      await updateUser(updates)
      showToast({ message: t('settings.profileSaved') || 'Profile saved', type: 'success' })
    } catch (err) {
      console.error('Save profile error:', err)
      showToast({ message: t('settings.saveFailed') || 'Failed to save profile', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleSectionClick = (id) => {
    setActiveSection(id)
  }

  return (
    <div className={`settings-page ${isSSO ? 'sso-user' : ''} section-${activeSection}`}>
      <motion.div 
        className="settings-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1>{t('settings.title')}</h1>
        <p>{t('settings.description')}</p>
      </motion.div>

      {/* Language change confirmation (in-app popup) */}
      {showLangConfirm && (
        <div className="lang-confirm-overlay" role="dialog" aria-modal="true">
          <div className="lang-confirm-content">
            <AlertTriangle size={36} className="warning-icon" />
            <div className="lang-confirm-body">
              <h3>{t('settings.languageConfirmTitle') || 'Change language?'}</h3>
              <p>{t('settings.languageConfirmMsg') || `Apply ${langToConfirm} as your UI language? If you don't apply, it will revert to the previous language.`}</p>
            </div>
            <div className="lang-confirm-actions">
              <button className="btn-secondary" onClick={() => {
                // Revert
                setPendingLanguage(language)
                setLangToConfirm(null)
                setShowLangConfirm(false)
              }}>{t('common.cancel') || 'Cancel'}</button>
              <button className="btn-primary" onClick={() => {
                // Apply language change
                setShowLangConfirm(false)
                setLangToConfirm(null)
                try {
                  setLanguage(pendingLanguage)
                  showToast({ message: t('settings.profileSaved') || 'Language applied', type: 'success' })
                } catch (e) {
                  showToast({ message: t('settings.saveFailed') || 'Failed to apply language', type: 'error' })
                  setPendingLanguage(language)
                }
              }}>{t('settings.languageConfirmApply') || 'Apply'}</button>
            </div>
          </div>
        </div>
      )}

      {showSSOEditor && (
        <motion.div className="sso-config-modal" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onClick={(e) => { if (e.target === e.currentTarget) setShowSSOEditor(false) }}>
          <div className="sso-config-zone danger-zone" role="dialog" aria-modal="true">
            <h3>{t('settings.ssoConfig.title')}</h3>
            <p className="muted">{t('settings.ssoConfig.editHint')}</p>

            <div className="form-group">
              <label>Auth URL</label>
              <input ref={ssoFirstInputRef} value={ssoConfig.authUrl} onChange={e => setSsoConfig({ ...ssoConfig, authUrl: e.target.value })} placeholder="https://auth.example.com/realms/..." />
            </div>
            <div className="form-group">
              <label>Client ID</label>
              <input value={ssoConfig.clientId} onChange={e => setSsoConfig({ ...ssoConfig, clientId: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Scope</label>
              <input value={ssoConfig.scope} onChange={e => setSsoConfig({ ...ssoConfig, scope: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Realm</label>
              <input value={ssoConfig.realm} onChange={e => setSsoConfig({ ...ssoConfig, realm: e.target.value })} />
            </div>

            <div className="danger-action">
              <button className="btn-secondary" onClick={() => setShowSSOEditor(false)}>{t('common.cancel')}</button>
              <button className="btn-primary" onClick={handleSaveSSOConfig}>{t('settings.saveChanges')}</button>
              <button className="btn-danger" onClick={handleResetSSOConfig}>{t('settings.ssoConfig.reset')}</button>
            </div>
          </div>
        </motion.div>
      )}


      <div className="settings-container">
        {/* Sidebar */}
        <motion.nav 
          className="settings-nav"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          {settingsSections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${activeSection === id ? 'active' : ''}`}
              onClick={() => handleSectionClick(id)}
            >
              <Icon size={20} />
              <span>{t(`settings.${id}`) || label}</span>
            </button>
          ))}

          {/* Sidebar-only helper content removed: full section renderings were duplicated in the sidebar and the main content area.
              Keeping the sidebar compact prevents DOM duplication, layout issues, and unexpected side-effects when switching sections. */}

          <div className="settings-actions">
            <motion.button 
              className="btn-primary"
              onClick={handleSave}
              disabled={saving}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {saving ? (
                <div className="button-spinner" />
              ) : (
                <>
                  <Save size={18} />
                  {t('settings.saveChanges')}
                </>
              )}
            </motion.button>
          </div>
        </motion.nav>

        <div className="settings-content">


          {/* SSO configuration placed in the Security area inside a Danger Zone */}
          {activeSection === 'security' && (
            <div className="settings-section">
              <h2>{t('settings.security')}</h2>

              {isSSO ? (
                <div className="sso-card sso-top-card">
                  <div className="sso-card-left"><Lock size={22} /></div>
                  <div className="sso-card-body">
                    <h4>{t('settings.passwordManagedBySSOTitle') || 'Password managed by your identity provider'}</h4>
                    <p>{t('settings.passwordManagedBySSO') || 'Your account uses single sign-on. To change your password, please visit your authentication provider.'}</p>
                  </div>
                  <div className="sso-card-actions">
                    <a className="btn-primary btn-icon" href="https://auth.ghassandarwish.com/realms/master/account/account-security/signing-in" target="_blank" rel="noopener noreferrer"><Lock size={14} />{t('settings.changeOnAuthPlatform') || 'Change password'}</a>
                  </div>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label>{t('settings.currentPassword')}</label>
                    <input type="password" placeholder={t('settings.currentPasswordPlaceholder') || 'Enter current password'} />
                  </div>
                  <div className="form-group">
                    <label>{t('settings.newPassword')}</label>
                    <input type="password" placeholder={t('settings.newPasswordPlaceholder') || 'Enter new password'} />
                  </div>
                  <div className="form-group">
                    <label>{t('settings.confirmPassword')}</label>
                    <input type="password" placeholder={t('settings.confirmPasswordPlaceholder') || 'Confirm new password'} />
                  </div>
                </>
              )}

              <div className="security-pref">
                <div className="form-group">
                  <label>{t('settings.requireReauthTitle') || 'Require re-authentication for critical actions'}</label>
                  <p className="form-hint">{t('settings.requireReauthDesc') || 'If enabled, you will be asked to re-enter your credentials when performing sensitive actions such as deleting your account or rotating tokens.'}</p>
                  <label className="toggle">
                    <input type="checkbox" checked={requireReauth} onChange={async (e) => {
                      const newVal = e.target.checked
                      setRequireReauth(newVal)
                      const token = getAuthToken()
                      if (!token) return showToast({ message: 'Not authenticated', type: 'error' })
                      try {
                        const r = await fetch('/api/auth/security', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': token }, body: JSON.stringify({ requireReauth: newVal }) })
                        if (!r.ok) {
                          const data = await r.json()
                          showToast({ message: data.message || 'Failed to update security settings', type: 'error' })
                          setRequireReauth(!newVal)
                        } else {
                          showToast({ message: t('settings.requireReauthSaved') || 'Security preference saved', type: 'success' })
                        }
                      } catch (err) {
                        console.error('Update requireReauth error:', err)
                        setRequireReauth(!newVal)
                        showToast({ message: t('settings.requireReauthFailed') || 'Failed to save preference', type: 'error' })
                      }
                    }} />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>

              {/* Active sessions (Keycloak-backed users) */}
              <hr className="section-sep" />
              <div className="settings-section sessions-section">
                <h3>{t('settings.activeSessionsTitle') || 'Active sessions'}</h3>
                <p className="form-hint">{t('settings.activeSessionsDesc') || 'See devices and browsers currently signed in. Revoke any session you don\'t recognize.'}</p>
                <div className="sessions-actions">
                  <button className="btn-secondary" onClick={() => { /* defer to avoid overlay receiving the same click event */ setTimeout(() => setShowSignoutAllConfirm(true), 0) }}>{t('settings.signOutEverywhere') || 'Sign out everywhere'}</button>
                </div>
                <div className="sessions-list">
                  {sessionsLoading ? (
                    <div className="loading-spinner" aria-hidden="true" />
                  ) : (
                    sessions.length === 0 ? (
                      <p className="muted">{t('settings.noActiveSessions') || 'No active sessions'}</p>
                    ) : (
                      sessions.map(s => (
                        <div key={s.id} className="session-row">
                          <div className="session-info">
                            <strong>{s.clientId || s.client || 'Unknown'}</strong>
                            <div className="muted" title={s.userAgent || s.ipAddress || ''}>
                              {s.userAgent ? (
                                (() => {
                                  const parsed = parseUserAgent(s.userAgent)
                                  const name = parsed.name + (parsed.version ? ` ${parsed.version}` : '')
                                  // show friendly name and keep truncated raw UA in title
                                  return name.length > 48 ? `${name.slice(0,48)}…` : name
                                })()
                              ) : (s.ipAddress || 'Unknown')}
                            </div>
                            <div className="muted small">{s.createdAt ? `${t('settings.started') || 'Started'} ${new Date(s.createdAt).toLocaleString()}` : ''} {s.lastAccess ? ` • ${t('settings.lastActive') || 'Last active'} ${new Date(s.lastAccess).toLocaleString()}` : ''}</div>
                            <div className="session-flags">
                              {s.isCurrent && <span className="badge current">{t('settings.currentSession') || 'Current'}</span>}
                              {s.risk && s.risk.map(r => (
                                <span key={r} className={`badge risk ${r}`}>{t(`settings.risk.${r}`) || r}</span>
                              ))}
                            </div>
                          </div>
                          <div className="session-actions">
                            <button className="btn-secondary" onClick={(e) => { e.stopPropagation(); /* defer to avoid overlay receiving the same click event */ setTimeout(() => setSessionToRevoke(s), 0) }}>{t('settings.signOut') || 'Sign out'}</button>
                          </div>
                        </div>
                      ))
                    )
                  )}
                </div>
              </div>

              <hr className="section-sep" />
              <div className="danger-zone sso-danger-block">
                <h3>{t('settings.dangerZone')}</h3>
                <div className="danger-action">
                  <div>
                    <h4>{t('settings.ssoConfig.title')}</h4>
                    <p>{t('settings.ssoConfig.desc')}</p>
                  </div>
                  <button className="btn-danger" onClick={() => setShowSSOEditor(true)}>{t('settings.ssoConfig.button')}</button>
                </div>
              </div>

            </div>
          )}
          {activeSection === 'profile' && (
            <div className="settings-section">
              <h2>{t('settings.profile')}</h2>
              <div className="profile-grid">
                <div className="profile-avatar">
                  <div className="avatar-preview">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar" />
                    ) : (
                      <div className="avatar-placeholder"><User size={36} /></div>
                    )}
                  </div>
                  <div className="avatar-actions">
                    <label className="btn-secondary btn-file">
                      {t('settings.uploadAvatar')}
                      <input type="file" accept="image/*" onChange={handleAvatarChange} />
                    </label>
                    {avatarPreview && <button className="btn-secondary" onClick={handleRemoveAvatar}>{t('settings.removeAvatar')}</button>}
                  </div>
                  <p className="form-hint">{t('settings.avatarHint')}</p>
                </div>

                <div className="profile-fields">
                  <div className="form-row">
                    <div className="form-group">
                      <label>{t('profile.firstName')}</label>
                      <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>{t('profile.lastName')}</label>
                      <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>{t('profile.displayName')}</label>
                    <input type="text" value={displayNameVal} onChange={(e) => setDisplayNameVal(e.target.value)} />
                  </div>

                  <div className={`form-group ${isSSO ? 'disabled-field' : ''}`}>
                    <label>{t('profile.username')}</label>
                    <input type="text" value={usernameVal} onChange={(e) => setUsernameVal(e.target.value)} disabled={isSSO} />
                    {isSSO ? <p className="form-hint">{t('settings.usernameSSOHint')}</p> : null}
                  </div>

                  <div className={`form-group ${isSSO ? 'disabled-field' : ''}`}>
                    <label>{t('profile.email')}</label>
                    <input type="email" value={emailVal} onChange={(e) => setEmailVal(e.target.value)} placeholder="you@example.com" disabled={isSSO} />
                    {isSSO ? <p className="form-hint">{t('settings.emailSSOHint')}</p> : null}
                  </div>

                  <div className="form-group">
                    <label>{t('settings.language')}</label>
                    <select value={pendingLanguage} onChange={(e) => {
                      const newLang = e.target.value
                      setPendingLanguage(newLang)
                      if (newLang !== language) {
                        setLangToConfirm(newLang)
                        setShowLangConfirm(true)
                      }
                    }}>
                      <option value="en">English</option>
                      <option value="es">Español</option>
                      <option value="fr">Français</option>
                      <option value="de">Deutsch</option>
                      <option value="ar">العربية</option>
                      <option value="ru">Русский</option>
                    </select>
                    <p className="form-hint">{t('settings.languageHint') || 'Choose your preferred UI language'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'appearance' && (
            <div className="settings-section">
              <h2>{t('settings.appearance')}</h2>
              <div className="form-group">
                <label>{t('settings.theme')}</label>
                <div className="theme-selector">
                  <button
                    className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                    onClick={() => setTheme('light')}
                  >
                    <Sun size={24} />
                    <span>{t('settings.theme.light')}</span>
                  </button>
                  <button
                    className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                    onClick={() => setTheme('dark')}
                  >
                    <Moon size={24} />
                    <span>{t('settings.theme.dark')}</span>
                  </button>
                  <button
                    className={`theme-option ${theme === 'system' ? 'active' : ''}`}
                    onClick={() => setTheme('system')}
                  >
                    <Monitor size={24} />
                    <span>{t('settings.theme.system')}</span>
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>{t('settings.accentColor')}</label>
                <div className="color-picker">
                  {accentColors.map(({ id, color, name }) => (
                    <button
                      key={id}
                      className={`color-option ${currentAccent.id === id ? 'active' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setAccent(id)}
                      title={name}
                    >
                      {currentAccent.id === id && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>{t('settings.logoStyle')}</label>
                <p className="form-hint">{t('settings.logoHint')}</p>
                <div className="logo-selector">
                  {logoOptions.map((logo) => {
                    // For circle logo, show the current theme's version
                    const previewPath = logo.id === 'circle' 
                      ? (theme === 'dark' ? logo.pathDark : logo.pathLight)
                      : logo.path
                    
                    return (
                      <button
                        key={logo.id}
                        className={`logo-option ${currentLogo.id === logo.id ? 'active' : ''}`}
                        onClick={() => setLogo(logo.id)}
                        title={logo.id === 'circle' ? `${logo.name} (adapts to theme)` : logo.name}
                      >
                        <div className="logo-preview">
                          <img src={previewPath} alt={logo.name} />
                        </div>
                        <span className="logo-name">{logo.name}</span>
                        {logo.id === 'circle' && (
                          <span className="logo-hint">Auto</span>
                        )}
                        {currentLogo.id === logo.id && (
                          <div className="logo-selected">
                            <Check size={14} />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}



          {activeSection === 'notifications' && (
            <ErrorBoundary>
              <div className="settings-section">
                <h2>{t('settings.notifications')}</h2>
                <div className="toggle-group">
                  <div className="toggle-item">
                    <div>
                      <h4>{t('settings.notifications.serviceAlerts.title')}</h4>
                      <p>{t('settings.notifications.serviceAlerts.desc')}</p>
                    </div>
                    <label className="toggle">
                      <input type="checkbox" defaultChecked />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                  <div className="toggle-item">
                    <div>
                      <h4>{t('settings.notifications.systemUpdates.title')}</h4>
                      <p>{t('settings.notifications.systemUpdates.desc')}</p>
                    </div>
                    <label className="toggle">
                      <input type="checkbox" defaultChecked />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                  <div className="toggle-item">
                    <div>
                      <h4>{t('settings.notifications.weeklyReports.title')}</h4>
                      <p>{t('settings.notifications.weeklyReports.desc')}</p>
                    </div>
                    <label className="toggle">
                      <input type="checkbox" />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                </div>
              </div>
            </ErrorBoundary>
          )}

          {activeSection === 'data' && (
            <div className="settings-section">
              <h2>{t('settings.data')}</h2>
              <div className="data-actions">
                <div className="data-card">
                  <Database size={32} />
                  <h4>{t('settings.exportData')}</h4>
                  <p>{t('settings.exportDataDesc')}</p>
                  <button className="btn-secondary">{t('settings.exportJSON')}</button>
                </div>
                <div className="data-card">
                  <Database size={32} />
                  <h4>{t('settings.importData')}</h4>
                  <p>{t('settings.importDataDesc')}</p>
                  <button className="btn-secondary">{t('settings.import')}</button>
                </div>
              </div>
              <div className="danger-zone">
                <h3>{t('settings.dangerZone')}</h3>
                <div className="danger-action">
                  <div>
                    <h4>{t('settings.resetAllTitle')}</h4>
                    <p>{t('settings.resetAllDesc')}</p>
                  </div>
                  <button 
                    className="btn-danger" 
                    onClick={() => setShowResetConfirm(true)}
                  >
                    {t('settings.reset')}
                  </button>
                </div>

                {showResetConfirm && (
                  <motion.div 
                    className="reset-confirm-modal"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <div className="reset-confirm-content">
                      <AlertTriangle size={48} className="warning-icon" />
                      <h3>{t('settings.confirmTitle')}</h3>
                      <p>{t('settings.confirmDesc')}</p>
                      <div className="reset-confirm-actions">
                        <button 
                          className="btn-secondary" 
                          onClick={() => setShowResetConfirm(false)}
                          disabled={resetting}
                        >
                          {t('settings.cancel')}
                        </button>
                        <button 
                          className="btn-danger" 
                          onClick={handleResetServices}
                          disabled={resetting}
                        >
                          {resetting ? t('settings.resetting') : t('settings.resetConfirmYes')}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}




                <div className="danger-action">
                  <div>
                    <h4>{t('settings.deleteAccountTitle')}</h4>
                    <p>{t('settings.deleteAccountDesc')}</p>
                  </div>
                  <button className="btn-danger">{t('settings.delete')}</button>
                </div>
              </div>
            </div>
          )}

          <div className="settings-actions">
            <motion.button 
              className="btn-primary"
              onClick={handleSave}
              disabled={saving}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {saving ? (
                <div className="button-spinner" />
              ) : (
                <>
                  <Save size={18} />
                  {t('settings.saveChanges')}
                </>
              )}
            </motion.button>
          </div>
        </div>

        {/* Confirmation modals (render at root so they aren't clipped by section containers) */}
        {showSignoutAllConfirm && (
          <motion.div className="sso-config-modal" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onClick={(e) => { if (e.target === e.currentTarget) setShowSignoutAllConfirm(false) }}>
            <div className="sso-config-zone reset-confirm-modal" role="dialog" aria-modal="true">
              <div className="reset-confirm-content">
                <AlertTriangle size={48} className="warning-icon" />
                <h3>{t('settings.confirmTitle')}</h3>
                <p>{t('settings.signOutEverywhereConfirm')}</p>
                <div className="reset-confirm-actions">
                  <button className="btn-secondary" onClick={() => setShowSignoutAllConfirm(false)} disabled={revoking}>{t('common.cancel')}</button>
                  <button className="btn-danger" onClick={async () => {
                    setRevoking(true)
                    try {
                      const token = getAuthToken()
                      if (!token) return showToast({ message: 'Not authenticated', type: 'error' })
                      const r = await fetch('/api/auth/sessions/revoke', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': token }, body: JSON.stringify({ all: true }) })
                      if (r.ok) {
                        showToast({ message: t('settings.signOutEverywhereSuccess') || 'Signed out everywhere', type: 'success' })
                        logout()
                      } else {
                        const data = await r.json()
                        showToast({ message: data.message || 'Failed to revoke sessions', type: 'error' })
                      }
                    } catch (err) {
                      console.error('Sign out everywhere error:', err)
                      showToast({ message: t('settings.signOutEverywhereFailed') || 'Failed to sign out everywhere', type: 'error' })
                    } finally {
                      setRevoking(false)
                      setShowSignoutAllConfirm(false)
                    }
                  }}>{t('settings.signOut') || 'Sign out'}</button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {sessionToRevoke && (
          <motion.div className="sso-config-modal" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onClick={(e) => { if (e.target === e.currentTarget) setSessionToRevoke(null) }}>
            <div className="sso-config-zone reset-confirm-modal" role="dialog" aria-modal="true">
              <div className="reset-confirm-content">
                <AlertTriangle size={48} className="warning-icon" />
                <h3>{t('settings.confirmTitle')}</h3>
                <p>{t('settings.signOutSessionConfirm')}</p>
                <div className="reset-confirm-actions">
                  <button className="btn-secondary" onClick={() => setSessionToRevoke(null)} disabled={revoking}>{t('common.cancel')}</button>
                  <button className="btn-danger" onClick={async () => {
                    setRevoking(true)
                    try {
                      const token = getAuthToken()
                      if (!token) return showToast({ message: 'Not authenticated', type: 'error' })
                      const r = await fetch('/api/auth/sessions/revoke', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': token }, body: JSON.stringify({ sessionId: sessionToRevoke.id }) })
                      if (r.ok) {
                        showToast({ message: t('settings.signOutSessionSuccess') || 'Session revoked', type: 'success' })
                        // If revoking our current session, logout locally
                        try {
                          const currentToken = getAuthToken()
                          if (currentToken) {
                            const payload = JSON.parse(atob(currentToken.split('.')[1]))
                            if (payload && payload.sessionId === sessionToRevoke.id) {
                              logout()
                              return
                            }
                          }
                        } catch (e) {}
                        handleLoadSessions()
                      } else {
                        const data = await r.json()
                        showToast({ message: data.message || 'Failed to revoke session', type: 'error' })
                      }
                    } catch (err) {
                      console.error('Revoke session error:', err)
                      showToast({ message: t('settings.signOutSessionFailed') || 'Failed to revoke session', type: 'error' })
                    } finally {
                      setRevoking(false)
                      setSessionToRevoke(null)
                    }
                  }}>{t('settings.signOut') || 'Sign out'}</button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

      </div>
    </div>
  )
}
