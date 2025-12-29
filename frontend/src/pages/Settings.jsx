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
import '../styles/settings.css'

const settingsSections = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'data', label: 'Data & Backup', icon: Database }
]

export default function Settings() {
  const { user, logout, updateUser } = useAuth()
  const { theme, setTheme } = useTheme()
  const { currentLogo, setLogo } = useLogo()
  const { currentAccent, setAccent } = useAccent()
  const [activeSection, setActiveSection] = useState('profile')
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // Profile form state
  const [usernameVal, setUsernameVal] = useState(user?.username || '')
  const [emailVal, setEmailVal] = useState(user?.email || '')
  const [displayNameVal, setDisplayNameVal] = useState(user?.displayName || user?.username || '')
  const [firstName, setFirstName] = useState(user?.firstName || '')
  const [lastName, setLastName] = useState(user?.lastName || '')
  const [language, setLanguage] = useState(user?.language || (navigator.language || 'en').split('-')[0])
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || null)
  const [avatarFile, setAvatarFile] = useState(null)

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
        alert('All services have been reset successfully!')
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to reset services')
      }
    } catch (err) {
      console.error('Reset services error:', err)
      alert('Failed to reset services')
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
    setLanguage(user.language || (navigator.language || 'en').split('-')[0])
    setAvatarPreview(user.avatar || null)
    setAvatarFile(null)
  }, [user])

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      alert('Avatar must be less than 2 MB')
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
    setSaving(true)
    try {
      const updates = {
        displayName: displayNameVal,
        firstName,
        lastName,
        language,
        avatar: avatarPreview // data URL or existing URL
      }
      // Don't allow changing username/email for SSO users
      if (!user?.ssoProvider && !user?.sso_provider) {
        updates.username = usernameVal
        updates.email = emailVal
      }
      await updateUser(updates)
      alert('Profile saved')
    } catch (err) {
      console.error('Save profile error:', err)
      alert('Failed to save profile')
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
        <h1>Settings</h1>
        <p>Manage your account and preferences</p>
      </motion.div>

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
              <span>{label}</span>
              <ChevronRight size={16} className="chevron" />
            </button>
          ))}
        </motion.nav>

        {/* Content */}
        <motion.div 
          className="settings-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {activeSection === 'profile' && (
            <div className="settings-section">
              <h2>Profile Settings</h2>
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
                      Upload Avatar
                      <input type="file" accept="image/*" onChange={handleAvatarChange} />
                    </label>
                    {avatarPreview && <button className="btn-secondary" onClick={handleRemoveAvatar}>Remove</button>}
                  </div>
                  <p className="form-hint">Recommended: PNG/JPG up to 2MB.</p>
                </div>

                <div className="profile-fields">
                  <div className="form-row">
                    <div className="form-group">
                      <label>First Name</label>
                      <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Last Name</label>
                      <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Display Name</label>
                    <input type="text" value={displayNameVal} onChange={(e) => setDisplayNameVal(e.target.value)} />
                  </div>

                  <div className={`form-group ${user?.ssoProvider || user?.sso_provider ? 'disabled-field' : ''}`}>
                    <label>Username</label>
                    <input type="text" value={usernameVal} onChange={(e) => setUsernameVal(e.target.value)} disabled={!!user?.ssoProvider || !!user?.sso_provider} />
                    {user?.ssoProvider || user?.sso_provider ? <p className="form-hint">Username is provided by your SSO provider and cannot be changed here.</p> : null}
                  </div>

                  <div className={`form-group ${user?.ssoProvider || user?.sso_provider ? 'disabled-field' : ''}`}>
                    <label>Email</label>
                    <input type="email" value={emailVal} onChange={(e) => setEmailVal(e.target.value)} placeholder="you@example.com" disabled={!!user?.ssoProvider || !!user?.sso_provider} />
                    {user?.ssoProvider || user?.sso_provider ? <p className="form-hint">Email is provided by your SSO provider and cannot be changed here.</p> : null}
                  </div>

                  <div className="form-group">
                    <label>Language</label>
                    <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                      <option value="en">English</option>
                      <option value="es">Español</option>
                      <option value="fr">Français</option>
                      <option value="de">Deutsch</option>
                      <option value="pt">Português</option>
                    </select>
                    <p className="form-hint">Choose your preferred UI language</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'appearance' && (
            <div className="settings-section">
              <h2>Appearance</h2>
              <div className="form-group">
                <label>Theme</label>
                <div className="theme-selector">
                  <button
                    className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                    onClick={() => setTheme('light')}
                  >
                    <Sun size={24} />
                    <span>Light</span>
                  </button>
                  <button
                    className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                    onClick={() => setTheme('dark')}
                  >
                    <Moon size={24} />
                    <span>Dark</span>
                  </button>
                  <button
                    className={`theme-option ${theme === 'system' ? 'active' : ''}`}
                    onClick={() => setTheme('system')}
                  >
                    <Monitor size={24} />
                    <span>System</span>
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Accent Color</label>
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
                <label>Logo Style</label>
                <p className="form-hint">Choose your preferred logo style for the dashboard</p>
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
              <h2>Security</h2>
              <div className="form-group">
                <label>Current Password</label>
                <input type="password" placeholder="Enter current password" />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input type="password" placeholder="Enter new password" />
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <input type="password" placeholder="Confirm new password" />
              </div>
              <div className="security-info">
                <Shield size={20} />
                <div>
                  <h4>Two-Factor Authentication</h4>
                  <p>Add an extra layer of security to your account</p>
                </div>
                <button className="btn-secondary">Enable 2FA</button>
              </div>
              <div className="security-info">
                <Lock size={20} />
                <div>
                  <h4>SSO Configuration</h4>
                  <p>Connect with your identity provider</p>
                </div>
                <button className="btn-secondary">Configure SSO</button>
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="settings-section">
              <h2>Notifications</h2>
              <div className="toggle-group">
                <div className="toggle-item">
                  <div>
                    <h4>Service Status Alerts</h4>
                    <p>Get notified when a service goes offline</p>
                  </div>
                  <label className="toggle">
                    <input type="checkbox" defaultChecked />
                    <span className="toggle-slider" />
                  </label>
                </div>
                <div className="toggle-item">
                  <div>
                    <h4>System Updates</h4>
                    <p>Notifications about system updates</p>
                  </div>
                  <label className="toggle">
                    <input type="checkbox" defaultChecked />
                    <span className="toggle-slider" />
                  </label>
                </div>
                <div className="toggle-item">
                  <div>
                    <h4>Weekly Reports</h4>
                    <p>Receive weekly usage reports</p>
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
              <h2>Data & Backup</h2>
              <div className="data-actions">
                <div className="data-card">
                  <Database size={32} />
                  <h4>Export Data</h4>
                  <p>Download all your service configurations</p>
                  <button className="btn-secondary">Export JSON</button>
                </div>
                <div className="data-card">
                  <Database size={32} />
                  <h4>Import Data</h4>
                  <p>Restore from a backup file</p>
                  <button className="btn-secondary">Import</button>
                </div>
              </div>
              <div className="danger-zone">
                <h3>Danger Zone</h3>
                <div className="danger-action">
                  <div>
                    <h4>Reset All Services</h4>
                    <p>Remove all service configurations</p>
                  </div>
                  <button 
                    className="btn-danger" 
                    onClick={() => setShowResetConfirm(true)}
                  >
                    Reset
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
                      <h3>Are you sure?</h3>
                      <p>This will permanently delete all your services. This action cannot be undone.</p>
                      <div className="reset-confirm-actions">
                        <button 
                          className="btn-secondary" 
                          onClick={() => setShowResetConfirm(false)}
                          disabled={resetting}
                        >
                          Cancel
                        </button>
                        <button 
                          className="btn-danger" 
                          onClick={handleResetServices}
                          disabled={resetting}
                        >
                          {resetting ? 'Resetting...' : 'Yes, Reset All'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
                <div className="danger-action">
                  <div>
                    <h4>Delete Account</h4>
                    <p>Permanently delete your account and all data</p>
                  </div>
                  <button className="btn-danger">Delete</button>
                </div>
              </div>
            </div>
          )}

          <div className="settings-actions">
            <button className="btn-secondary" onClick={logout}>
              Sign Out
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
                  Save Changes
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
