import { useState, useEffect } from 'react'
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

  // Profile form state
  const [usernameVal, setUsernameVal] = useState(user?.username || '')
  const [emailVal, setEmailVal] = useState(user?.email || '')
  const [displayNameVal, setDisplayNameVal] = useState(user?.displayName || user?.username || '')
  const [firstName, setFirstName] = useState(user?.firstName || '')
  const [lastName, setLastName] = useState(user?.lastName || '')
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || null)
  const [avatarFile, setAvatarFile] = useState(null)

  const { showToast } = useToast()

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
      if (!user?.ssoProvider && !user?.sso_provider) {
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

  return (
    <div className="settings-page">
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
              onClick={() => setActiveSection(id)}
            >
              <Icon size={20} />
              <span>{t(`settings.${id}`) || label}</span>
            </button>
          ))}



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

          {activeSection === 'security' && (
            <div className="settings-section">
              <h2>{t('settings.security')}</h2>
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
              <div className="security-info">
                <Shield size={20} />
                <div>
                  <h4>{t('settings.twoFactor.title')}</h4>
                  <p>{t('settings.twoFactor.desc')}</p>
                </div>
                <button className="btn-secondary">{t('settings.enable2FA')}</button>
              </div>
              <div className="security-info">
                <Lock size={20} />
                <div>
                  <h4>{t('settings.ssoConfig.title')}</h4>
                  <p>{t('settings.ssoConfig.desc')}</p>
                </div>
                <button className="btn-secondary">{t('settings.ssoConfig.button')}</button>
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
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
            <button className="btn-secondary" onClick={logout}>
              {t('settings.signOut')}
            </button>
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

                  <div className={`form-group ${user?.ssoProvider || user?.sso_provider ? 'disabled-field' : ''}`}>
                    <label>{t('profile.username')}</label>
                    <input type="text" value={usernameVal} onChange={(e) => setUsernameVal(e.target.value)} disabled={!!user?.ssoProvider || !!user?.sso_provider} />
                    {user?.ssoProvider || user?.sso_provider ? <p className="form-hint">{t('settings.usernameSSOHint')}</p> : null}
                  </div>

                  <div className={`form-group ${user?.ssoProvider || user?.sso_provider ? 'disabled-field' : ''}`}>
                    <label>{t('profile.email')}</label>
                    <input type="email" value={emailVal} onChange={(e) => setEmailVal(e.target.value)} placeholder="you@example.com" disabled={!!user?.ssoProvider || !!user?.sso_provider} />
                    {user?.ssoProvider || user?.sso_provider ? <p className="form-hint">{t('settings.emailSSOHint')}</p> : null}
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

          {activeSection === 'security' && (
            <div className="settings-section">
              <h2>{t('settings.security')}</h2>
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
              <div className="security-info">
                <Shield size={20} />
                <div>
                  <h4>{t('settings.twoFactor.title')}</h4>
                  <p>{t('settings.twoFactor.desc')}</p>
                </div>
                <button className="btn-secondary">{t('settings.enable2FA')}</button>
              </div>
              <div className="security-info">
                <Lock size={20} />
                <div>
                  <h4>{t('settings.ssoConfig.title')}</h4>
                  <p>{t('settings.ssoConfig.desc')}</p>
                </div>
                <button className="btn-secondary">{t('settings.ssoConfig.button')}</button>
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
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
            <button className="btn-secondary" onClick={logout}>
              {t('settings.signOut')}
            </button>
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
      </div>
    </div>
  )
}
