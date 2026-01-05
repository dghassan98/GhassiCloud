import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { 
  User, Lock, Palette, Bell, Shield, Database, 
  Save, Moon, Sun, Monitor, ChevronRight, Check, AlertTriangle,
  Globe, Zap, Compass, Terminal, Package, Box, Users, UserCog, Trash2, Edit3
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
  const { showToast } = useToast()
  const isAdmin = user?.role === 'admin'
  
  const settingsSections = [
    { id: 'profile', label: t('settings.tabs.profile'), icon: User },
    { id: 'appearance', label: t('settings.tabs.appearance'), icon: Palette },
    { id: 'security', label: t('settings.tabs.security'), icon: Shield },
    { id: 'notifications', label: t('settings.tabs.notifications'), icon: Bell },
    { id: 'data', label: t('settings.tabs.data'), icon: Database },
    ...(isAdmin ? [{ id: 'users', label: t('settings.userManagement.title') || 'User Management', icon: Users }] : [])
  ]
  const [activeSection, setActiveSection] = useState('profile')
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [pendingLanguage, setPendingLanguage] = useState(language)
  const [showLangConfirm, setShowLangConfirm] = useState(false)
  const [langToConfirm, setLangToConfirm] = useState(null)

  // Unsaved appearance changes confirmation
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false)
  const [pendingSection, setPendingSection] = useState(null)

  // Track original saved values for unsaved changes detection
  const [savedTheme, setSavedTheme] = useState(theme)
  const [savedLogoId, setSavedLogoId] = useState(currentLogo.id)
  const [savedAccentId, setSavedAccentId] = useState(currentAccent.id)
  const [savedAccentColor, setSavedAccentColor] = useState(currentAccent.color)

  // Appearance preview state
  const [previewTheme, setPreviewTheme] = useState(theme)
  const [previewLogo, setPreviewLogo] = useState(currentLogo.id)
  const [previewAccent, setPreviewAccent] = useState(currentAccent.id)
  const [previewAccentColor, setPreviewAccentColor] = useState(currentAccent.color)

  // Sessions & security preferences (user-facing)
  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionGeoData, setSessionGeoData] = useState({}) // Map of IP -> { lat, lon, city, country }

  // User management (admin only)
  const [allUsers, setAllUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)

  // Profile form state
  const [usernameVal, setUsernameVal] = useState(user?.username || '')
  const [emailVal, setEmailVal] = useState(user?.email || '')
  const [displayNameVal, setDisplayNameVal] = useState(user?.displayName || user?.username || '')
  const [firstName, setFirstName] = useState(user?.firstName || '')
  const [lastName, setLastName] = useState(user?.lastName || '')
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || null)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarError, setAvatarError] = useState(false)
  const [avatarRetryCount, setAvatarRetryCount] = useState(0)

  // Custom color picker state
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [hexInput, setHexInput] = useState('')
  const [hue, setHue] = useState(180)
  const [saturation, setSaturation] = useState(100)
  const [lightness, setLightness] = useState(50)

  // Convert HSL to Hex
  const hslToHex = (h, s, l) => {
    l /= 100
    const a = s * Math.min(l, 1 - l) / 100
    const f = n => {
      const k = (n + h / 30) % 12
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
      return Math.round(255 * color).toString(16).padStart(2, '0')
    }
    return `#${f(0)}${f(8)}${f(4)}`.toUpperCase()
  }

  // Convert Hex to HSL
  const hexToHSL = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255
    const g = parseInt(hex.slice(3, 5), 16) / 255
    const b = parseInt(hex.slice(5, 7), 16) / 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h, s, l = (max + min) / 2

    if (max === min) {
      h = s = 0
    } else {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
        case g: h = ((b - r) / d + 2) / 6; break
        case b: h = ((r - g) / d + 4) / 6; break
      }
    }

    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
  }

  // Sync preview state with actual state
  useEffect(() => {
    setPreviewTheme(theme)
  }, [theme])

  useEffect(() => {
    setPreviewLogo(currentLogo.id)
  }, [currentLogo])

  useEffect(() => {
    setPreviewAccent(currentAccent.id)
    setPreviewAccentColor(currentAccent.color)
  }, [currentAccent])

  // Apply preview changes visually (CSS variables only, no persistence)
  useEffect(() => {
    if (activeSection === 'appearance') {
      // Apply preview theme
      if (previewTheme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
      } else {
        document.documentElement.setAttribute('data-theme', previewTheme)
      }

      // Apply preview accent color - only call setAccent if it's different from current
      const needsAccentUpdate = previewAccent !== currentAccent.id || 
        (previewAccent === 'custom' && previewAccentColor !== currentAccent.color)
      
      if (needsAccentUpdate) {
        setAccent(previewAccent, previewAccent === 'custom' ? previewAccentColor : undefined, true)
      }

      // Apply preview logo
      if (previewLogo !== currentLogo.id) {
        setLogo(previewLogo, true) // true = preview mode
      }

      // Update favicon based on preview settings
      const effectiveTheme = previewTheme === 'system' 
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : previewTheme
      
      const faviconMap = {
        'circle': effectiveTheme === 'dark' ? '/favicon-circle-dark.ico' : '/favicon-circle-cyan.ico',
        'circle-dark': '/favicon-circle-dark.ico',
        'circle-dark-alternative': '/favicon-circle-dark-alternative.ico',
        'circle-cyan': '/favicon-circle-cyan.ico',
        'circle-yellow': '/favicon-circle-yellow.ico',
        'full-logo': '/favicon-circle-cyan.ico', // fallback
        'cloud-only': '/favicon-circle-cyan.ico'  // fallback
      }
      
      const faviconPath = faviconMap[previewLogo] || '/favicon-circle-cyan.ico'
      const link = document.querySelector('link[rel="icon"]')
      if (link) link.href = faviconPath
    } else {
      // When leaving appearance tab, restore actual saved values
      if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
      } else {
        document.documentElement.setAttribute('data-theme', theme)
      }

      // Always restore actual accent color when leaving appearance tab
      setAccent(currentAccent.id, currentAccent.id === 'custom' ? currentAccent.color : undefined, false)

      // Restore actual logo
      if (previewLogo !== currentLogo.id) {
        setLogo(currentLogo.id, false)
      }
    }
  }, [previewTheme, previewAccent, previewAccentColor, previewLogo, activeSection, theme, currentAccent.id, currentAccent.color, currentLogo.id, setLogo, setAccent])

  // Update HSL when custom color changes
  useEffect(() => {
    if (currentAccent.id === 'custom') {
      const hsl = hexToHSL(currentAccent.color)
      setHue(hsl.h)
      setSaturation(hsl.s)
      setLightness(hsl.l)
    }
  }, [currentAccent])

  // Helper to proxy external avatar URLs through backend to avoid CORS and rate limiting
  const getProxiedAvatarUrl = (avatarUrl) => {
    if (!avatarUrl) return null
    // Check if it's already a proxy URL
    if (avatarUrl.startsWith('/api/auth/avatar-proxy')) return avatarUrl
    // Check if it's a data URL (uploaded file)
    if (avatarUrl.startsWith('data:')) return avatarUrl
    // Check if it's a relative URL
    if (avatarUrl.startsWith('/')) return avatarUrl
    // Check if it's an external URL that needs proxying
    const externalDomains = ['googleusercontent.com', 'graph.microsoft.com', 'avatars.githubusercontent.com']
    if (externalDomains.some(domain => avatarUrl.includes(domain))) {
      return `/api/auth/avatar-proxy?url=${encodeURIComponent(avatarUrl)}`
    }
    return avatarUrl
  }

  // Copy IP helper (click to copy IP to clipboard)
  const copyToClipboard = async (text) => {
    if (!text) return showToast({ message: t('settings.noIp') || 'No IP available', type: 'error' })
    try {
      await navigator.clipboard.writeText(text)
      showToast({ message: t('settings.ipCopied') || 'IP copied to clipboard', type: 'success' })
    } catch (e) {
      // Fallback: try execCommand
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy'); showToast({ message: t('settings.ipCopied') || 'IP copied to clipboard', type: 'success' }) } catch (e) { showToast({ message: t('settings.copyFailed') || 'Failed to copy IP', type: 'error' }) }
      ta.remove()
    }
  }

  // Small UA parser for friendly labels
  const parseUserAgent = (ua) => {
    if (!ua || typeof ua !== 'string') return { name: t('settings.ua.unknown') || 'Unknown' }
    const s = ua
    const checks = [
      { re: /Electron\/(\d+[\.\d]*)/i, name: 'Electron', icon: 'Monitor' },
      { re: /Edg\/(\d+[\.\d]*)/i, name: 'Edge', icon: 'Globe' },
      { re: /OPR\/(\d+[\.\d]*)/i, name: 'Opera', icon: 'Globe' },
      { re: /Chrome\/(\d+[\.\d]*)/i, name: 'Chrome', icon: 'Globe' },
      { re: /CriOS\/(\d+[\.\d]*)/i, name: 'Chrome (iOS)', icon: 'Globe' },
      { re: /Firefox\/(\d+[\.\d]*)/i, name: 'Firefox', icon: 'Zap' },
      { re: /FxiOS\/(\d+[\.\d]*)/i, name: 'Firefox (iOS)', icon: 'Zap' },
      { re: /Version\/(\d+[\.\d]*)\s+Safari\//i, name: 'Safari', icon: 'Compass' },
      { re: /Safari\/(\d+[\.\d]*)/i, name: 'Safari', icon: 'Compass' },
      { re: /Mobile\/\w+.*Safari/i, name: 'Mobile Safari', icon: 'Compass' },
      { re: /PostmanRuntime\//i, name: 'Postman', icon: 'Package' },
      { re: /Insomnia\//i, name: 'Insomnia', icon: 'Package' },
      { re: /curl\/(\d+[\.\d]*)/i, name: 'curl', icon: 'Terminal' },
      { re: /python-requests\/(\d+[\.\d]*)/i, name: 'python-requests', icon: 'Terminal' },
      { re: /okhttp\/(\d+[\.\d]*)/i, name: 'okhttp', icon: 'Terminal' }
    ]
    for (const c of checks) {
      const m = s.match(c.re)
      if (m) {
        return { name: c.name, version: m[1] || null, icon: c.icon || 'Globe' }
      }
    }
    const prod = s.split(' ')[0]
    if (prod && prod.includes('/')) {
      const [prodName, prodVer] = prod.split('/')
      return { name: prodName, version: prodVer }
    }
    return { name: s.slice(0, 30) }
  }

  // Detect SSO users reliably: backend flag or local marker set during SSO login
  const isSSO = Boolean(
    user?.ssoProvider || user?.sso_provider || (typeof window !== 'undefined' && localStorage.getItem('ghassicloud-sso') === 'true')
  )

  // SSO editor state (admin)
  const [showSSOEditor, setShowSSOEditor] = useState(false)
  const [ssoConfig, setSsoConfig] = useState({ authUrl: '', clientId: '', scope: '', realm: '' })
  const [ssoLoading, setSsoLoading] = useState(false)
  const ssoFirstInputRef = useRef(null)

  // Confirmation modals for sign out actions
  const [showConfirmSignOutAll, setShowConfirmSignOutAll] = useState(false)
  const [confirmSignOutAllLoading, setConfirmSignOutAllLoading] = useState(false)
  const [confirmSession, setConfirmSession] = useState(null) // holds session object when confirming single session


  const [confirmSessionLoading, setConfirmSessionLoading] = useState(false)

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
      const sessionList = data.sessions || []
      setSessions(sessionList)
      
      // Fetch geolocation for each unique IP address
      const uniqueIPs = [...new Set(sessionList.map(s => s.ipAddress).filter(Boolean))]
      const geoPromises = uniqueIPs.map(async (ip) => {
        try {
          // Use query parameter instead of route parameter for better IPv6 support
          const geoRes = await fetch(`/api/auth/ip-geo?ip=${encodeURIComponent(ip)}`, { headers: { 'Authorization': token } })
          if (geoRes.ok) {
            const geo = await geoRes.json()
            return { ip, geo }
          }
        } catch (e) {
          console.warn('Failed to fetch geo for IP:', ip, e)
        }
        return { ip, geo: null }
      })
      
      const geoResults = await Promise.all(geoPromises)
      const geoMap = {}
      geoResults.forEach(({ ip, geo }) => {
        if (geo) geoMap[ip] = geo
      })
      setSessionGeoData(geoMap)
    } catch (err) {
      console.error('Load sessions error:', err)
      setSessions([])
    } finally {
      setSessionsLoading(false)
    }
  }


  useEffect(() => {
    if (activeSection === 'security') {
      handleLoadSessions()
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

  // User Management Functions (Admin only)
  const fetchUsers = async () => {
    if (!isAdmin) return
    setUsersLoading(true)
    try {
      const token = getAuthToken()
      const res = await fetch('/api/auth/users', {
        headers: { Authorization: token }
      })
      if (res.ok) {
        const data = await res.json()
        setAllUsers(data.users || [])
      } else {
        showToast({ message: t('settings.userManagement.loadFailed') || 'Failed to load users', type: 'error' })
      }
    } catch (err) {
      console.error('Fetch users error:', err)
      showToast({ message: t('settings.userManagement.loadFailed') || 'Failed to load users', type: 'error' })
    } finally {
      setUsersLoading(false)
    }
  }

  const handleUpdateUserRole = async (userId, newRole) => {
    try {
      const token = getAuthToken()
      const res = await fetch(`/api/auth/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: token
        },
        body: JSON.stringify({ role: newRole })
      })
      if (res.ok) {
        showToast({ message: t('settings.userManagement.roleUpdated') || 'User role updated successfully', type: 'success' })
        fetchUsers()
      } else {
        const data = await res.json()
        showToast({ message: data.message || t('settings.userManagement.roleUpdateFailed') || 'Failed to update role', type: 'error' })
      }
    } catch (err) {
      console.error('Update role error:', err)
      showToast({ message: t('settings.userManagement.roleUpdateFailed') || 'Failed to update role', type: 'error' })
    }
  }

  const handleDeleteUser = async (userId) => {
    try {
      const token = getAuthToken()
      const res = await fetch(`/api/auth/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: token }
      })
      if (res.ok) {
        showToast({ message: t('settings.userManagement.userDeleted') || 'User deleted successfully', type: 'success' })
        setShowDeleteConfirm(null)
        fetchUsers()
      } else {
        const data = await res.json()
        showToast({ message: data.message || t('settings.userManagement.userDeleteFailed') || 'Failed to delete user', type: 'error' })
      }
    } catch (err) {
      console.error('Delete user error:', err)
      showToast({ message: t('settings.userManagement.userDeleteFailed') || 'Failed to delete user', type: 'error' })
    }
  }

  useEffect(() => {
    if (activeSection === 'users' && isAdmin) {
      fetchUsers()
    }
  }, [activeSection, isAdmin])

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
    setAvatarPreview(getProxiedAvatarUrl(user.avatar))
    setAvatarFile(null)
    setAvatarError(false)
    setAvatarRetryCount(0)
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
      
      // Persist appearance settings (remove preview mode)
      setTheme(previewTheme, false) // false = persist mode, save and log
      setLogo(previewLogo, false)
      if (previewAccent === 'custom') {
        setAccent('custom', previewAccentColor, false)
      } else {
        setAccent(previewAccent, undefined, false)
      }
      
      // Update saved values to match what was just persisted
      setSavedTheme(previewTheme)
      setSavedLogoId(previewLogo)
      setSavedAccentId(previewAccent)
      setSavedAccentColor(previewAccentColor)
      
      showToast({ message: t('settings.profileSaved') || 'Profile saved', type: 'success' })
    } catch (err) {
      console.error('Save profile error:', err)
      showToast({ message: t('settings.saveFailed') || 'Failed to save profile', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleSectionClick = (id) => {
    // Check if leaving appearance tab with unsaved changes
    if (activeSection === 'appearance' && id !== 'appearance') {
      const hasUnsavedTheme = savedTheme !== previewTheme
      const hasUnsavedLogo = savedLogoId !== previewLogo
      const hasUnsavedAccent = savedAccentId !== previewAccent || 
        (previewAccent === 'custom' && savedAccentColor !== previewAccentColor)
      
      if (hasUnsavedTheme || hasUnsavedLogo || hasUnsavedAccent) {
        setPendingSection(id)
        setShowUnsavedConfirm(true)
        return
      }
    }
    
    // lightweight debug logging to help reproduce tab-switching issues
    console.debug('Settings: switch to', id)
    setActiveSection(id)
  }

  const handleDiscardChanges = () => {
    // Revert preview changes to current saved values
    setPreviewTheme(savedTheme)
    setPreviewLogo(savedLogoId)
    setPreviewAccent(savedAccentId)
    setPreviewAccentColor(savedAccentColor)
    
    // Switch to the pending section
    setActiveSection(pendingSection)
    setShowUnsavedConfirm(false)
    setPendingSection(null)
  }

  const handleKeepEditing = () => {
    setShowUnsavedConfirm(false)
    setPendingSection(null)
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

      {/* Unsaved appearance changes confirmation */}
      {showUnsavedConfirm && (
        <div className="unsaved-confirm-overlay" role="dialog" aria-modal="true">
          <div className="unsaved-confirm-content">
            <div className="unsaved-confirm-icon">
              <AlertTriangle size={56} strokeWidth={1.5} />
            </div>
            <div className="unsaved-confirm-body">
              <h2>{t('settings.unsavedChanges.title')}</h2>
              <p>{t('settings.unsavedChanges.message')}</p>
            </div>
            <div className="unsaved-confirm-actions">
              <button className="btn-secondary" onClick={handleDiscardChanges}>
                {t('settings.unsavedChanges.discard')}
              </button>
              <button className="btn-primary" onClick={handleKeepEditing}>
                {t('settings.unsavedChanges.keepEditing')}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Confirmation modal: Sign out everywhere */}
      {showConfirmSignOutAll && (
        <motion.div className="sso-config-modal" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onClick={(e) => { if (e.target === e.currentTarget) setShowConfirmSignOutAll(false) }}>
          <div className="sso-config-zone danger-zone" role="dialog" aria-modal="true" >
            <h3>{t('settings.signOutEverywhereConfirm') || 'Sign out from all devices?'}</h3>
            <p className="muted">{t('settings.signOutEverywhereDesc') || 'You will be logged out from all active sessions.'}</p>
            <div className="danger-action">
              <button className="btn-secondary" onClick={() => setShowConfirmSignOutAll(false)}>{t('common.cancel')}</button>
              <button className="btn-danger" onClick={async () => {
                setConfirmSignOutAllLoading(true)
                try {
                  const token = getAuthToken()
                  if (!token) return showToast({ message: 'Not authenticated', type: 'error' })
                  const r = await fetch('/api/auth/sessions/revoke', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': token }, body: JSON.stringify({ all: true }) })
                  if (r.ok) {
                    showToast({ message: t('settings.signOutEverywhereSuccess') || 'Signed out everywhere', type: 'success' })
                    try { logout() } catch (e) {}
                    setTimeout(() => { window.location.href = '/login' }, 350)
                  } else {
                    const data = await r.json()
                    showToast({ message: data.message || 'Failed to revoke sessions', type: 'error' })
                  }
                } catch (err) {
                  console.error('Sign out everywhere error:', err)
                  showToast({ message: t('settings.signOutEverywhereFailed') || 'Failed to sign out everywhere', type: 'error' })
                } finally {
                  setConfirmSignOutAllLoading(false)
                  setShowConfirmSignOutAll(false)
                }
              }}>{confirmSignOutAllLoading ? (t('common.loading') || 'Loading...') : (t('settings.signOutEverywhere') || 'Sign out everywhere')}</button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Confirmation modal: Sign out single session */}
      {confirmSession && (
        <motion.div className="sso-config-modal" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onClick={(e) => { if (e.target === e.currentTarget) setConfirmSession(null) }}>
          <div className="sso-config-zone danger-zone" role="dialog" aria-modal="true">
            <h3>{t('settings.signOutSessionConfirm') || 'Sign out this session?'}</h3>
            <p className="muted">{confirmSession.clientId || confirmSession.client || ''} {confirmSession.ipAddress ? `• ${confirmSession.ipAddress}` : ''}</p>
            <div className="danger-action">
              <button className="btn-secondary" onClick={() => setConfirmSession(null)}>{t('common.cancel')}</button>
              <button className="btn-danger" onClick={async () => {
                setConfirmSessionLoading(true)
                try {
                  const token = getAuthToken()
                  if (!token) return showToast({ message: 'Not authenticated', type: 'error' })
                  const r = await fetch('/api/auth/sessions/revoke', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': token }, body: JSON.stringify({ sessionId: confirmSession.id }) })
                  if (r.ok) {
                    showToast({ message: t('settings.signOutSessionSuccess') || 'Session revoked', type: 'success' })
                    if (confirmSession.isCurrent) {
                      try { logout() } catch (e) {}
                      setTimeout(() => { window.location.href = '/login' }, 350)
                    } else {
                      handleLoadSessions()
                    }
                  } else {
                    const data = await r.json()
                    showToast({ message: data.message || 'Failed to revoke session', type: 'error' })
                  }
                } catch (err) {
                  console.error('Revoke session error:', err)
                  showToast({ message: t('settings.signOutSessionFailed') || 'Failed to revoke session', type: 'error' })
                } finally {
                  setConfirmSessionLoading(false)
                  setConfirmSession(null)
                }
              }}>{confirmSessionLoading ? (t('common.loading') || 'Loading...') : (t('settings.signOut') || 'Sign out')}</button>
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
              <span>{label}</span>
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
                <>
                <div className="sso-card sso-top-card">
                  <div className="sso-card-left"><Lock size={22} /></div>
                  <div className="sso-card-body">
                    <h4>{t('settings.passwordManagedBySSOTitle') || 'Password managed by your identity provider'}</h4>
                    <p>{t('settings.passwordManagedBySSO') || 'Your account uses single sign-on. To change your password, please visit your authentication provider.'}</p>
                  </div>
                  <div className="sso-card-actions">
                    <a className="btn-primary btn-icon" href="https://auth.ghassi.cloud/realms/master/account/account-security/signing-in" target="_blank" rel="noopener noreferrer"><Lock size={14} />{t('settings.changeOnAuthPlatform') || 'Change password'}</a>
                  </div>
                </div>


                </>
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


              {/* Danger Zone (moved below Active sessions) */}

              <hr className="section-sep" />
              {/* Active sessions (Keycloak-backed users) */}
              <div className="settings-section sessions-section">
                <h3>{t('settings.activeSessionsTitle') || 'Active sessions'}</h3>
                <p className="form-hint">{t('settings.activeSessionsDesc') || 'See devices and browsers currently signed in. Revoke any session you don\'t recognize.'}</p>


                <div className="sessions-list">
                  {sessionsLoading ? (
                    <p>{t('common.loading') || 'Loading...'}</p>
                  ) : (
                    sessions.length === 0 ? (
                      <p className="muted">{t('settings.noActiveSessions') || 'No active sessions'}</p>
                    ) : (
                      sessions.map(s => {
                        const geo = s.ipAddress ? sessionGeoData[s.ipAddress] : null
                        return (
                        <div key={s.id} className="session-row">
                          <div className="session-info">
                            <strong title={s.rawClientId || s.clientId || ''}>{s.clientId || s.client || 'Unknown'}</strong>
                            <div className="muted" title={s.userAgent || ''}>
                              {s.userAgent ? (() => { const parsed = parseUserAgent(s.userAgent); const name = parsed.name + (parsed.version ? ` ${parsed.version}` : ''); const Icon = parsed.icon ? ({ 'Globe': Globe, 'Zap': Zap, 'Compass': Compass, 'Terminal': Terminal, 'Package': Package, 'Box': Box, 'Monitor': Monitor }[parsed.icon]) : Globe; return (<><Icon size={14} className="ua-icon" />&nbsp;{ name.length > 80 ? `${name.slice(0,80)}…` : name }</>) })() : ''}
                            </div>
                            <div className="muted small session-ip" title={t('settings.copyIpTooltip') || 'Click to copy IP'} onClick={(e) => { e.stopPropagation(); copyToClipboard(s.ipAddress) }}>{s.ipAddress || (t('settings.noIp') || 'No IP address')}</div>
                            {geo && (geo.city || geo.country) && (
                              <div className="muted small session-location">
                                <Globe size={12} /> {[geo.city, geo.country].filter(Boolean).join(', ')}
                              </div>
                            )}
                            <div className="muted small">{s.createdAt ? `${t('settings.started') || 'Started'} ${new Date(s.createdAt).toLocaleString()}` : ''} {s.lastAccess ? ` • ${t('settings.lastActive') || 'Last active'} ${new Date(s.lastAccess).toLocaleString()}` : ''}</div>
                            <div className="session-flags">
                              {s.isCurrent && <span className="badge current">{t('settings.currentSession') || 'Current session'}</span>}
                              {s.risk && s.risk.map(r => (
                                <span key={r} className={`badge risk ${r}`}>{t(`settings.risk.${r}`) || r}</span>
                              ))}
                            </div>
                          </div>
                          {geo && geo.lat && geo.lon && (
                            <div className="session-map" title={[geo.city, geo.country].filter(Boolean).join(', ')}>
                              <img 
                                src={`/api/auth/static-map?lat=${geo.lat}&lon=${geo.lon}`}
                                alt={`Map showing ${geo.city || 'location'}`}
                                loading="lazy"
                              />
                            </div>
                          )}
                          {geo && geo.private && (
                            <div className="session-map session-map-local" title={t('settings.localNetwork') || 'Local Network'}>
                              <div className="local-network-indicator">
                                <Monitor size={24} />
                                <span>{t('settings.localNetwork') || 'Local'}</span>
                              </div>
                            </div>
                          )}
                          {!geo && s.ipAddress && (
                            <div className="session-map session-map-local" title={s.ipAddress}>
                              <div className="local-network-indicator">
                                <Globe size={24} />
                                <span>{s.ipAddress.length > 15 ? s.ipAddress.slice(0, 12) + '...' : s.ipAddress}</span>
                              </div>
                            </div>
                          )}
                          <div className="session-actions">
                            <button className="btn-danger" onClick={() => setConfirmSession(s)}>{t('settings.signOut') || 'Sign Out'}</button>
                          </div>
                        </div>
                      )})
                    )
                  )}
                </div>

                <div className="sessions-actions sessions-actions-bottom" style={{ marginTop: '0.75rem' }}>
                  <button className="btn-danger" onClick={() => setShowConfirmSignOutAll(true)}>{t('settings.signOutEverywhere') || 'Sign out everywhere'}</button>
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
                    {avatarPreview && !avatarError ? (
                      <img 
                        src={avatarPreview} 
                        alt="Avatar"
                        loading="eager"
                        onError={() => {
                          console.warn('Avatar failed to load')
                          setAvatarError(true)
                        }}
                        onLoad={() => {
                          setAvatarError(false)
                        }}
                      />
                    ) : (
                      <div className="avatar-placeholder"><User size={36} /></div>
                    )}
                  </div>
                  <div className="avatar-actions">
                    <label className="btn-secondary btn-file">
                      <input type="file" accept="image/*" onChange={handleAvatarChange} />
                      <span>{t('settings.uploadAvatar')}</span>
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
                    className={`theme-option ${previewTheme === 'light' ? 'active' : ''}`}
                    onClick={() => setPreviewTheme('light')}
                  >
                    <Sun size={24} />
                    <span>{t('settings.theme.light')}</span>
                  </button>
                  <button
                    className={`theme-option ${previewTheme === 'dark' ? 'active' : ''}`}
                    onClick={() => setPreviewTheme('dark')}
                  >
                    <Moon size={24} />
                    <span>{t('settings.theme.dark')}</span>
                  </button>
                  <button
                    className={`theme-option ${previewTheme === 'system' ? 'active' : ''}`}
                    onClick={() => setPreviewTheme('system')}
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
                      className={`color-option ${previewAccent === id ? 'active' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => {
                        setPreviewAccent(id)
                        setPreviewAccentColor(color)
                      }}
                      title={name}
                    >
                      {previewAccent === id && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>{t('settings.customAccentColor') || 'Custom Accent Color'}</label>
                <p className="form-hint">{t('settings.customAccentHint') || 'Choose your own accent color'}</p>
                <div className="custom-color-picker-container">
                  <button 
                    type="button"
                    className={`custom-color-trigger ${previewAccent === 'custom' ? 'active' : ''} ${showColorPicker ? 'expanded' : ''}`}
                    onClick={() => setShowColorPicker(!showColorPicker)}
                  >
                    <div 
                      className="color-preview" 
                      style={{ backgroundColor: previewAccent === 'custom' ? previewAccentColor : '#6366f1' }}
                    ></div>
                    <span className="color-label">{previewAccent === 'custom' ? previewAccentColor.toUpperCase() : '#6366F1'}</span>
                    {previewAccent === 'custom' && <Check size={16} />}
                  </button>
                  
                  {showColorPicker && (
                    <motion.div 
                      className="custom-color-picker-panel"
                      initial={{ opacity: 0, height: 0, y: -10 }}
                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -10 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                      <div className="color-picker-header">
                        <Palette size={18} />
                        <span>{t('settings.customAccentColor') || 'Custom Color'}</span>
                        <button type="button" onClick={() => setShowColorPicker(false)} className="close-btn">×</button>
                      </div>
                      <div className="color-picker-body">
                        
                        {/* Visual Color Picker */}
                        <div className="visual-color-picker">
                          {/* Saturation/Lightness Picker */}
                          <div 
                            className="color-gradient-box"
                            style={{ 
                              background: `
                                linear-gradient(to top, #000, transparent),
                                linear-gradient(to right, #fff, hsl(${hue}, 100%, 50%))
                              `
                            }}
                            onMouseDown={(e) => {
                              const box = e.currentTarget
                              const updateColor = (clientX, clientY) => {
                                const rect = box.getBoundingClientRect()
                                const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
                                const y = Math.max(0, Math.min(clientY - rect.top, rect.height))
                                
                                // Calculate saturation (0-100% from left to right)
                                const newSat = Math.round((x / rect.width) * 100)
                                
                                // Calculate lightness based on both gradients
                                // Left side: white (100% lightness) to black (0% lightness)
                                // Right side: pure hue (50% lightness) to black (0% lightness)
                                const yPercent = y / rect.height
                                const baseLightness = 100 - (newSat * 0.5) // 100% at left, 50% at right
                                const newLight = Math.round(baseLightness * (1 - yPercent * 0.95)) // Keep 5% min
                                
                                setSaturation(newSat)
                                setLightness(newLight)
                                const hex = hslToHex(hue, newSat, newLight)
                                setPreviewAccent('custom')
                                setPreviewAccentColor(hex)
                                setHexInput(hex)
                              }
                              
                              updateColor(e.clientX, e.clientY)
                              
                              const handleMouseMove = (moveEvent) => {
                                updateColor(moveEvent.clientX, moveEvent.clientY)
                              }
                              
                              const handleMouseUp = () => {
                                document.removeEventListener('mousemove', handleMouseMove)
                                document.removeEventListener('mouseup', handleMouseUp)
                              }
                              
                              document.addEventListener('mousemove', handleMouseMove)
                              document.addEventListener('mouseup', handleMouseUp)
                            }}
                          >
                            <div 
                              className="color-picker-thumb"
                              style={{
                                left: `${saturation}%`,
                                top: `${(() => {
                                  const baseLightness = 100 - (saturation * 0.5)
                                  if (baseLightness === 0) return 100
                                  const yPercent = 1 - (lightness / baseLightness / 0.95)
                                  return Math.max(0, Math.min(100, yPercent * 100))
                                })()}%`
                              }}
                            />
                          </div>

                          {/* Hue Slider */}
                          <div className="hue-slider-container">
                            <input
                              type="range"
                              min="0"
                              max="360"
                              value={hue}
                              onChange={(e) => {
                                const newHue = parseInt(e.target.value)
                                setHue(newHue)
                                const hex = hslToHex(newHue, saturation, lightness)
                                setPreviewAccent('custom')
                                setPreviewAccentColor(hex)
                                setHexInput(hex)
                              }}
                              className="hue-slider"
                            />
                          </div>
                        </div>

                        <div className="hex-input-group">
                          <label>{t('settings.hexCode') || 'Hex Code'}</label>
                          <div className="hex-input-wrapper">
                            <input
                              type="text"
                              value={hexInput || (previewAccent === 'custom' ? previewAccentColor : '#6366f1')}
                              onChange={(e) => {
                                let value = e.target.value.toUpperCase()
                                if (!value.startsWith('#')) value = '#' + value
                                if (/^#[0-9A-F]{0,6}$/.test(value)) {
                                  setHexInput(value)
                                  if (value.length === 7) {
                                    setPreviewAccent('custom')
                                    setPreviewAccentColor(value)
                                    const hsl = hexToHSL(value)
                                    setHue(hsl.h)
                                    setSaturation(hsl.s)
                                    setLightness(hsl.l)
                                  }
                                }
                              }}
                              onBlur={() => {
                                if (previewAccent === 'custom') {
                                  setHexInput(previewAccentColor)
                                } else {
                                  setHexInput('')
                                }
                              }}
                              placeholder="#6366F1"
                              className="hex-input"
                              maxLength={7}
                            />
                            <div 
                              className="hex-preview" 
                              style={{ backgroundColor: (hexInput && hexInput.length === 7) ? hexInput : (previewAccent === 'custom' ? previewAccentColor : '#6366f1') }}
                            ></div>
                          </div>
                        </div>
                        <div className="color-swatches-label">Quick Colors</div>
                        <div className="color-grid">
                          {[
                            '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', 
                            '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
                            '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#dc2626'
                          ].map(color => (
                            <button
                              key={color}
                              type="button"
                              className="color-swatch"
                              style={{ backgroundColor: color }}
                              onClick={() => {
                                setPreviewAccent('custom')
                                setPreviewAccentColor(color)
                                setHexInput(color.toUpperCase())
                              }}
                              title={color.toUpperCase()}
                            />
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>{t('settings.logoStyle')}</label>
                <p className="form-hint">{t('settings.logoHint')}</p>
                <div className="logo-selector">
                  {logoOptions.map((logo) => {
                    // For circle logo, show the current theme's version
                    let previewPath
                    if (logo.id === 'circle') {
                      previewPath = previewTheme === 'dark' ? logo.pathDark : logo.pathLight
                    } else {
                      previewPath = logo.path
                    }
                    
                    return (
                      <button
                        key={logo.id}
                        className={`logo-option ${previewLogo === logo.id ? 'active' : ''}`}
                        onClick={() => setPreviewLogo(logo.id)}
                        title={logo.id === 'circle' ? `${logo.name} (adapts to theme)` : logo.name}
                      >
                        <div className="logo-preview">
                          <img src={previewPath} alt={logo.name} />
                        </div>
                        <span className="logo-name">{logo.name}</span>
                        {logo.id === 'circle' && (
                          <span className="logo-hint">Auto</span>
                        )}
                        {previewLogo === logo.id && (
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

          {/* User Management Section (Admin Only) */}
          {activeSection === 'users' && isAdmin && (
            <div className="settings-section">
              <div className="section-header">
                <div>
                  <h2>{t('settings.userManagement.title') || 'User Management'}</h2>
                  <p>{t('settings.userManagement.description') || 'Manage user accounts and permissions'}</p>
                </div>
              </div>

              {usersLoading ? (
                <div className="loading-state">
                  <div className="spinner" />
                  <p>{t('settings.userManagement.loadingUsers') || 'Loading users...'}</p>
                </div>
              ) : (
                <div className="users-table-container">
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>{t('settings.userManagement.tableUser') || 'User'}</th>
                        <th>{t('settings.userManagement.tableEmail') || 'Email'}</th>
                        <th>{t('settings.userManagement.tableRole') || 'Role'}</th>
                        <th>{t('settings.userManagement.tableSSO') || 'SSO'}</th>
                        <th>{t('settings.userManagement.tableActions') || 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allUsers.map(u => (
                        <tr key={u.id}>
                          <td>
                            <div className="user-info">
                              {u.avatar ? (
                                <img src={u.avatar} alt={u.username} className="user-avatar-small" />
                              ) : (
                                <div className="user-avatar-small placeholder">
                                  <User size={16} />
                                </div>
                              )}
                              <div>
                                <div className="user-name">{u.display_name || u.username}</div>
                                <div className="user-username">@{u.username}</div>
                              </div>
                            </div>
                          </td>
                          <td>{u.email}</td>
                          <td>
                            <select 
                              className="role-select"
                              value={u.role}
                              onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                              disabled={u.id === user?.id}
                            >
                              <option value="user">{t('settings.userManagement.roleUser') || 'User'}</option>
                              <option value="admin">{t('settings.userManagement.roleAdmin') || 'Admin'}</option>
                            </select>
                          </td>
                          <td>
                            {u.sso_provider ? (
                              <span className="sso-badge">
                                <Check size={14} />
                                {t('settings.userManagement.ssoEnabled') || 'SSO'}
                              </span>
                            ) : (
                              <span className="local-badge">{t('settings.userManagement.localAccount') || 'Local'}</span>
                            )}
                          </td>
                          <td>
                            {u.id !== user?.id && (
                              <button 
                                className="btn-icon-danger"
                                onClick={() => setShowDeleteConfirm(u)}
                                title={t('settings.userManagement.deleteUser') || 'Delete user'}
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {allUsers.length === 0 && (
                    <div className="empty-state">
                      <Users size={48} />
                      <p>{t('settings.userManagement.noUsers') || 'No users found'}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Delete Confirmation Modal */}
              {showDeleteConfirm && (
                <motion.div 
                  className="modal-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setShowDeleteConfirm(null)}
                >
                  <motion.div 
                    className="modal-content"
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <AlertTriangle size={48} className="warning-icon" />
                    <h3>{t('settings.userManagement.deleteConfirmTitle') || 'Delete User'}</h3>
                    <p>{t('settings.userManagement.deleteConfirmMessage') || 'Are you sure you want to delete this user? This action cannot be undone.'} <strong>{showDeleteConfirm.username}</strong></p>
                    <div className="modal-actions">
                      <button 
                        className="btn-secondary" 
                        onClick={() => setShowDeleteConfirm(null)}
                      >
                        {t('common.cancel') || 'Cancel'}
                      </button>
                      <button 
                        className="btn-danger" 
                        onClick={() => handleDeleteUser(showDeleteConfirm.id)}
                      >
                        {t('settings.userManagement.deleteUser') || 'Delete User'}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
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
      </div>
    </div>
  )
}
