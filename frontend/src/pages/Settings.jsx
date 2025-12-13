import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  User, Lock, Palette, Bell, Shield, Database, 
  Save, Moon, Sun, Monitor, ChevronRight, Check
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
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const { currentLogo, setLogo } = useLogo()
  const { currentAccent, setAccent } = useAccent()
  const [activeSection, setActiveSection] = useState('profile')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    // Simulate save
    await new Promise(resolve => setTimeout(resolve, 1000))
    setSaving(false)
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
              <div className="form-group">
                <label>Username</label>
                <input type="text" defaultValue={user?.username} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" defaultValue={user?.email || ''} placeholder="your@email.com" />
              </div>
              <div className="form-group">
                <label>Display Name</label>
                <input type="text" defaultValue={user?.displayName || user?.username} />
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
                  <button className="btn-danger">Reset</button>
                </div>
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
