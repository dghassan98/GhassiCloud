import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  User, Lock, Palette, Bell, Shield, Database,
  Save, Moon, Sun, Monitor, ChevronRight, Check, AlertTriangle,
  Globe, Zap, Compass, Terminal, Package, Box, Users, UserCog, Trash2, Edit3, RefreshCw, Sparkles, Contrast, Coffee
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useLogo, logoOptions } from '../context/LogoContext'
import { useAccent, accentColors } from '../context/AccentContext'
import { useLanguage } from '../context/LanguageContext'
import { useToast } from '../context/ToastContext'
import { usePWAUpdate } from '../hooks/usePWAUpdate'
import { isPWA, isMobile } from '../hooks/useCapacitor'
import { useWebview } from '../context/WebviewContext'
import logger from '../logger'
import '../styles/settings.css'
import ErrorBoundary from '../components/ErrorBoundary'


export default function Settings() {
  const { user, logout, updateUser, refreshUser } = useAuth()
  const { theme, setTheme } = useTheme()
  const { currentLogo, setLogo } = useLogo()
  const { currentAccent, setAccent, confirmAccent, revertAccent, isPreview: accentPreviewActive } = useAccent()
  const { t, language, setLanguage } = useLanguage()
  const { showToast } = useToast()
  const { checkForUpdate, forceRefresh, showChangelog, dismissChangelog } = usePWAUpdate()
  const { openWebview } = useWebview()
  const isAdmin = user?.role === 'admin'
  const [forceRefreshing, setForceRefreshing] = useState(false)

  const [syncPreferences, setSyncPreferences] = useState(() => {
    try {
      const local = localStorage.getItem('ghassicloud-sync-preferences')
      if (local !== null) return local === 'true'
      return user?.preferences?.syncPreferences === true
    } catch (e) { logger.error('Failed to get sync preferences from localStorage:', e); return false }
  })

  const [showWeather, setShowWeather] = useState(() => {
    try {
      const saved = localStorage.getItem('ghassicloud-show-weather')
      return saved === null ? true : saved === 'true'
    } catch { return true }
  })

  useEffect(() => {
    try {
      const local = localStorage.getItem('ghassicloud-sync-preferences')
      if (local !== null) setSyncPreferences(local === 'true')
      else setSyncPreferences(user?.preferences?.syncPreferences === true)
    } catch (e) { logger.error('Failed to get sync preferences from localStorage:', e) }
  }, [user])

  const handleToggleSync = async () => {
    const next = !syncPreferences
    setSyncPreferences(next)
    try { localStorage.setItem('ghassicloud-sync-preferences', next ? 'true' : 'false') } catch (e) { logger.error('Failed to set sync preferences in localStorage:', e) }

    if (user) {
      try {
        const token = localStorage.getItem('ghassicloud-token')
        if (!token) return
        const res = await fetch('/api/auth/appearance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ syncPreferences: next })
        })
        if (res.ok) {
          try {
            const data = await res.json()
            try {
              const prefs = data && data.preferences ? data.preferences : null
              if (prefs) {
                if (prefs.theme) localStorage.setItem('ghassicloud-theme', prefs.theme)
                if (prefs.accent) localStorage.setItem('ghassicloud-accent', prefs.accent)
                if (prefs.customAccent) localStorage.setItem('ghassicloud-custom-accent', prefs.customAccent)
                if (prefs.logo) localStorage.setItem('ghassicloud-logo', prefs.logo)
                localStorage.setItem('ghassicloud-sync-preferences', prefs.syncPreferences === true ? 'true' : 'false')
                try { window.__ghassicloud_server_prefs_applied = true } catch (e) { logger.error('Failed to set __ghassicloud_server_prefs_applied flag:', e) }
                try { window.dispatchEvent(new CustomEvent('ghassicloud:preferences-updated', { detail: { prefs } })) } catch (e) { logger.error('Failed to dispatch preferences-updated event:', e) }
                try { setTimeout(() => { try { window.dispatchEvent(new CustomEvent('ghassicloud:preferences-updated', { detail: { prefs } })) } catch (e) { logger.error('Failed to dispatch preferences-updated event:', e) } }, 150) } catch (e) { logger.error('Failed to set timeout for preferences-updated event:', e) }
              }
            } catch (e) { logger.error('Failed to apply server preferences:', e) }

            try { await refreshUser() } catch (e) { logger.error('Failed to refresh user after updating preferences:', e) }
          } catch (e) { try { await refreshUser() } catch (e) { logger.error('Failed to refresh user after JSON parse error:', e) } }

          showToast({ message: next ? (t('settings.syncPreferences.enabled') || 'Preferences will be synced') : (t('settings.syncPreferences.disabled') || 'Preferences will be stored locally'), type: 'success' })
        } else {
          showToast({ message: t('settings.syncPreferences.toggleFailed') || 'Failed to update sync preference', type: 'error' })
        }
      } catch (e) {
        logger.error('Failed to update sync preference:', e)
        showToast({ message: t('settings.syncToggleFailed') || 'Failed to update sync preference', type: 'error' })
      }
    } else {
      showToast({ message: next ? (t('settings.syncPreferences.enabled') || 'Preference will be used when you sign in') : (t('settings.syncPreferences.disabled') || 'Preferences will be stored locally on this device'), type: 'info' })
    }
  }

  const handleToggleWeather = () => {
    const next = !showWeather
    setShowWeather(next)
    try {
      localStorage.setItem('ghassicloud-show-weather', next ? 'true' : 'false')
      window.dispatchEvent(new Event('ghassicloud:weather-preference-changed'))
      showToast({ message: next ? (t('settings.weather.enabled') || 'Weather widget enabled') : (t('settings.weather.disabled') || 'Weather widget disabled'), type: 'success' })
    } catch (e) {
      logger.error('Failed to update weather preference:', e)
      showToast({ message: t('settings.weather.toggleFailed') || 'Failed to update weather preference', type: 'error' })
    }
  }

  const settingsSections = [
    { id: 'profile', label: t('settings.tabs.profile'), icon: User },
    { id: 'appearance', label: t('settings.tabs.appearance'), icon: Palette },
    { id: 'security', label: t('settings.tabs.security'), icon: Shield },
    { id: 'data', label: t('settings.tabs.data'), icon: Database },
    ...(isAdmin ? [{ id: 'users', label: t('settings.userManagement.title') || 'User Management', icon: Users }] : []),
    ...(isAdmin ? [{ id: 'eventqr', label: t('settings.tabs.eventQr') || 'Event Spotlight', icon: Sparkles }] : []),
    { id: 'updates', label: t('settings.tabs.updates') || 'Updates', icon: RefreshCw }
  ]
  const [activeSection, setActiveSection] = useState('profile')
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [pendingLanguage, setPendingLanguage] = useState(language)
  const [showLangConfirm, setShowLangConfirm] = useState(false)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [langToConfirm, setLangToConfirm] = useState(null)

  const languageLabels = {
    system: t('settings.languageSystem') || 'System',
    en: 'English',
    es: 'Español',
    fr: 'Français',
    de: 'Deutsch',
    ar: 'العربية',
    ru: 'Русский',
    pt: 'Português'
  }

  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionGeoData, setSessionGeoData] = useState({})
  // Admin-only
  const [pwaDevToolsEnabled, setPwaDevToolsEnabled] = useState(false)
  const [savingPwaSetting, setSavingPwaSetting] = useState(false)
  const [pwaSaveError, setPwaSaveError] = useState(null)
  // Admin-only
  const [logLevel, setLogLevel] = useState('info')
  const [savingLogLevel, setSavingLogLevel] = useState(false)
  const [logLevelError, setLogLevelError] = useState(null)

  // Event QR admin state
  const [eventQrUrl, setEventQrUrl] = useState('')
  const [eventQrLabel, setEventQrLabel] = useState('')
  const [eventQrVisible, setEventQrVisible] = useState(false)
  const [savingEventQr, setSavingEventQr] = useState(false)
  const [eventQrSaved, setEventQrSaved] = useState(false)

  const [forgetServerPrefs, setForgetServerPrefs] = useState(false)

  // Revert unsaved accent preview when leaving the page
  useEffect(() => {
    return () => {
      revertAccent()
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const handleResetDefaults = async () => {
    if (!window.confirm(t('settings.resetDefaults.confirm') || 'This will restore appearance settings to defaults. Continue?')) return

    try {
      localStorage.removeItem('ghassicloud-theme')
      localStorage.removeItem('ghassicloud-accent')
      localStorage.removeItem('ghassicloud-custom-accent')
      localStorage.removeItem('ghassicloud-logo')
      localStorage.setItem('ghassicloud-sync-preferences', 'true')

      setTheme('system')
      setAccent('cyan')
      setLogo('circle')

      showToast({ message: t('settings.resetDefaults.localReset') || 'Appearance reset locally', type: 'success' })
    } catch (e) {
      logger.error('Failed to reset appearance locally', e)
      showToast({ message: t('settings.resetDefaults.failed') || 'Failed to reset appearance locally', type: 'error' })
    }

    if (forgetServerPrefs && user) {
      try {
        const token = localStorage.getItem('ghassicloud-token')
        if (!token) { showToast({ message: t('settings.resetDefaults.mustBeSignedIn') || 'Sign in to forget server preferences', type: 'info' }); return }
        const res = await fetch('/api/auth/appearance', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ clearPreferences: true, syncPreferences: false }) })
        if (res.ok) {
          await refreshUser()
          showToast({ message: t('settings.resetDefaults.serverReset') || 'Server preferences forgotten', type: 'success' })
        } else {
          showToast({ message: t('settings.resetDefaults.serverResetFailed') || 'Failed to clear server preferences', type: 'error' })
        }
      } catch (e) {
        logger.error('Failed to clear server prefs', e)
        showToast({ message: t('settings.resetDefaults.serverResetFailed') || 'Failed to clear server preferences', type: 'error' })
      }
    }
  }
  const [allUsers, setAllUsers] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)

  const [usernameVal, setUsernameVal] = useState(user?.username || '')
  const [emailVal, setEmailVal] = useState(user?.email || '')
  const [displayNameVal, setDisplayNameVal] = useState(user?.displayName || user?.username || '')
  const [firstName, setFirstName] = useState(user?.firstName || '')
  const [lastName, setLastName] = useState(user?.lastName || '')
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || null)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarError, setAvatarError] = useState(false)
  const [avatarRetryCount, setAvatarRetryCount] = useState(0)

  const [showColorPicker, setShowColorPicker] = useState(false)
  const [hexInput, setHexInput] = useState('')
  const [hue, setHue] = useState(180)
  const [saturation, setSaturation] = useState(100)
  const [lightness, setLightness] = useState(50)

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

  useEffect(() => {
    if (currentAccent.id === 'custom') {
      const hsl = hexToHSL(currentAccent.color)
      setHue(hsl.h)
      setSaturation(hsl.s)
      setLightness(hsl.l)
    }
  }, [currentAccent])

  const getProxiedAvatarUrl = (avatarUrl) => {
    if (!avatarUrl) return null
    if (avatarUrl.startsWith('/api/auth/avatar-proxy')) return avatarUrl
    if (avatarUrl.startsWith('data:')) return avatarUrl
    if (avatarUrl.startsWith('/')) return avatarUrl
    const externalDomains = ['googleusercontent.com', 'graph.microsoft.com', 'avatars.githubusercontent.com']
    if (externalDomains.some(domain => avatarUrl.includes(domain))) {
      return `/api/auth/avatar-proxy?url=${encodeURIComponent(avatarUrl)}`
    }
    return avatarUrl
  }

  const copyToClipboard = async (text) => {
    if (!text) return showToast({ message: t('settings.noIp') || 'No IP available', type: 'error' })
    try {
      await navigator.clipboard.writeText(text)
      showToast({ message: t('settings.ipCopied') || 'IP copied to clipboard', type: 'success' })
    } catch (e) {
      logger.error('Clipboard copy failed, falling back to textarea method:', e)
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy'); showToast({ message: t('settings.ipCopied') || 'IP copied to clipboard', type: 'success' }) } catch (e) { showToast({ message: t('settings.copyFailed') || 'Failed to copy IP', type: 'error' }) }
      ta.remove()
    }
  }

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

  const isSSO = Boolean(
    user?.ssoProvider || user?.sso_provider || (typeof window !== 'undefined' && localStorage.getItem('ghassicloud-sso') === 'true')
  )

  const [showSSOEditor, setShowSSOEditor] = useState(false)
  const [ssoConfig, setSsoConfig] = useState({ authUrl: '', clientId: '', scope: '', realm: '' })
  const [setSsoLoading] = useState(false)
  const ssoFirstInputRef = useRef(null)

  const [showConfirmSignOutAll, setShowConfirmSignOutAll] = useState(false)
  const [confirmSignOutAllLoading, setConfirmSignOutAllLoading] = useState(false)
  const [confirmSession, setConfirmSession] = useState(null)


  const [confirmSessionLoading, setConfirmSessionLoading] = useState(false)

  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const importFileRef = useRef(null)

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
        setSsoConfig({ authUrl: data.authUrl || '', clientId: data.clientId || '', scope: data.scope || '', realm: data.realm || '' })
      } else {
        showToast({ message: 'Failed to load SSO configuration', type: 'error' })
      }
    } catch (err) {
      logger.error('Load SSO config error:', err)
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
      logger.error('Save SSO config error:', err)
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
      logger.error('Reset SSO config error:', err)
      showToast({ message: 'Failed to reset SSO configuration', type: 'error' })
    }
  }

  useEffect(() => {
    if (showSSOEditor) handleLoadSSOConfig()
  }, [showSSOEditor])

  const handleLoadSessions = async () => {
    setSessionsLoading(true)
    try {
      const token = getAuthToken()
      if (!token) return setSessions([])
      const r = await fetch('/api/auth/sessions', { headers: { 'Authorization': token } })
      if (!r.ok) {
        logger.warn('Failed to load sessions')
        setSessions([])
        return
      }
      const data = await r.json()
      const sessionList = data.sessions || []
      setSessions(sessionList)

      const uniqueIPs = [...new Set(sessionList.map(s => s.ipAddress).filter(Boolean))]
      const geoPromises = uniqueIPs.map(async (ip) => {
        try {
          const geoRes = await fetch(`/api/auth/ip-geo?ip=${encodeURIComponent(ip)}`, { headers: { 'Authorization': token } })
          if (geoRes.ok) {
            const geo = await geoRes.json()
            return { ip, geo }
          }
        } catch (e) {
          logger.warn('Failed to fetch geo for IP:', ip, e)
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
      logger.error('Load sessions error:', err)
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

  useEffect(() => {
    if (activeSection !== 'security' || !isAdmin) return
    let cancelled = false
      ; (async () => {
        try {
          const token = getAuthToken()
          const headers = token ? { Authorization: token } : {}
          const res = await fetch('/api/auth/admin/settings/pwaDevtoolsEnabled', { headers })
          if (res.ok) {
            const data = await res.json()
            if (!cancelled) setPwaDevToolsEnabled(data && data.value === 'true')
          }
          const lvlRes = await fetch('/api/auth/admin/settings/logLevel', { headers })
          if (lvlRes.ok) {
            const lvlData = await lvlRes.json()
            if (!cancelled && lvlData && lvlData.value) setLogLevel(lvlData.value)
          }
        } catch (e) { logger.error('Failed to load admin settings', e) }
      })()
    return () => { cancelled = true }
  }, [activeSection, isAdmin])

  // Load Event QR settings when that section is active
  useEffect(() => {
    if (activeSection !== 'eventqr' || !isAdmin) return
    let cancelled = false
    ;(async () => {
      try {
        const token = getAuthToken()
        const headers = token ? { Authorization: token } : {}
        const qrRes = await fetch('/api/auth/event-qr', { headers })
        if (qrRes.ok) {
          const qrData = await qrRes.json()
          if (!cancelled) {
            setEventQrUrl(qrData.url || '')
            setEventQrLabel(qrData.label || '')
            setEventQrVisible(!!qrData.visible)
          }
        }
      } catch (e) { logger.error('Failed to load event QR settings', e) }
    })()
    return () => { cancelled = true }
  }, [activeSection, isAdmin])

  const handleLogLevelChange = async (e) => {
    const idx = parseInt(e.target.value)
    const next = ['error', 'warn', 'info', 'debug'][idx]
    try {
      setLogLevel(next)
      setSavingLogLevel(true)
      setLogLevelError(null)
      const token = getAuthToken()
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = token
      const res = await fetch('/api/auth/admin/settings', { method: 'POST', headers, body: JSON.stringify({ key: 'logLevel', value: next }) })
      if (res.ok) {
        showToast({ message: t('settings.logLevel.saved') || 'Log level saved', type: 'success' })
        try { window.dispatchEvent(new CustomEvent('ghassicloud:settings-updated', { detail: { key: 'logLevel', value: next } })) } catch (e) { }
        try { logger.setLevel(next); window.LOG_LEVEL = next } catch (e) { logger.error('Failed to set log level on logger or window:', e) }
      } else {
        let msg = t('settings.logLevel.saveFailed') || 'Failed to save log level'
        if (res.status === 403) msg = t('settings.adminRequired') || 'Admin access required'
        if (res.status === 401) msg = t('settings.notAuthenticated') || 'Not authenticated — please sign in'
        try { const data = await res.json(); if (data && data.message) msg = data.message } catch (e) { try { const txt = await res.text(); if (txt) msg = txt } catch (ee) { } }
        setLogLevelError(msg)
        try { const r = await fetch('/api/auth/admin/settings/logLevel'); if (r.ok) { const d = await r.json(); if (d && d.value) setLogLevel(d.value) } } catch (e) { }
        showToast({ message: msg, type: 'error' })
      }
    } catch (e) {
      logger.error('Save log level error:', e)
      setLogLevelError(t('settings.logLevel.saveFailed') || 'Failed to save log level')
      showToast({ message: t('settings.logLevel.saveFailed') || 'Failed to save log level', type: 'error' })
    } finally {
      setSavingLogLevel(false)
    }
  }


  useEffect(() => {
    if (!showSSOEditor) return
    setTimeout(() => ssoFirstInputRef.current?.focus?.(), 60)

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

  useEffect(() => {
    const label = t('settings.ssoConfig.button')
    const handler = (e) => {
      const el = e.target
      if (!el) return
      try {
        if ((el.textContent || '').trim() === label && isAdmin) setShowSSOEditor(true)
      } catch (err) {
        logger.error('SSO button click handler error:', err)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [t, isAdmin])

  useEffect(() => {
    const handler = (e) => {
      try {
        const d = e && e.detail
        if (!d || !d.key) return
        if (d.key === 'logLevel') {
          if (d.value) {
            setLogLevel(d.value)
            try { logger.setLevel(d.value); window.LOG_LEVEL = d.value } catch (e) { logger.error('Failed to set log level on logger or window:', e) }
          }
        }
        if (d.key === 'pwaDevtoolsEnabled') {
          setPwaDevToolsEnabled(d.value === 'true')
        }
      } catch (err) { logger.error('Settings update handler error:', err) }
    }
    window.addEventListener('ghassicloud:settings-updated', handler)
    return () => window.removeEventListener('ghassicloud:settings-updated', handler)
  }, [])

  const handleExportData = async () => {
    setExporting(true)
    try {
      const token = getAuthToken()
      const headers = token ? { Authorization: token } : {}
      const res = await fetch('/api/auth/export', { headers })
      if (!res.ok) {
        showToast({ message: t('settings.exportFailed') || 'Failed to export data', type: 'error' })
        return
      }
      const data = await res.json()

      const jsonBlob = new Blob([JSON.stringify(data.json, null, 2)], { type: 'application/json' })
      const jsonName = `ghassicloud-backup-${user?.username || 'user'}-${new Date().toISOString().replace(/[:.]/g, '')}.json`
      const a = document.createElement('a')
      a.href = URL.createObjectURL(jsonBlob)
      a.download = jsonName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(a.href)

      if (data.csv) {
        for (const [key, csv] of Object.entries(data.csv)) {
          if (!csv) continue
          const blob = new Blob([csv], { type: 'text/csv' })
          const name = `ghassicloud-${key}-${user?.username || 'user'}-${new Date().toISOString().replace(/[:.]/g, '')}.csv`
          const link = document.createElement('a')
          link.href = URL.createObjectURL(blob)
          link.download = name
          document.body.appendChild(link)
          link.click()
          link.remove()
          URL.revokeObjectURL(link.href)
        }
      }

      showToast({ message: t('settings.exportSuccess') || 'Exported data', type: 'success' })
    } catch (err) {
      logger.error('Export failed:', err)
      showToast({ message: t('settings.exportFailed') || 'Export failed', type: 'error' })
    } finally {
      setExporting(false)
    }
  }

  const handleImportClick = () => {
    importFileRef.current?.click()
  }

  const handleImportFile = async (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      let parsed
      try { parsed = JSON.parse(text) } catch (err) { showToast({ message: t('settings.importInvalid') || 'Invalid import file', type: 'error' }); setImporting(false); return }

      const token = getAuthToken()
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = token

      const res = await fetch('/api/auth/import', { method: 'POST', headers, body: JSON.stringify(parsed) })
      if (res.ok) {
        showToast({ message: t('settings.importSuccess') || 'Import complete', type: 'success' })
        try { await refreshUser() } catch (e) { }
      } else {
        let msg = t('settings.importFailed') || 'Import failed'
        try { const data = await res.json(); if (data && data.message) msg = data.message } catch (e) { }
        showToast({ message: msg, type: 'error' })
      }
    } catch (err) {
      logger.error('Import failed:', err)
      showToast({ message: t('settings.importFailed') || 'Import failed', type: 'error' })
    } finally {
      setImporting(false)
      try { e.target.value = '' } catch (e) { logger.error('Failed to clear file input value:', e) }
    }
  }

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
      logger.error('Reset services error:', err)
      showToast({ message: t('settings.resetFailed') || 'Failed to reset services', type: 'error' })
    } finally {
      setResetting(false)
    }
  }

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
      logger.error('Fetch users error:', err)
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
      logger.error('Update role error:', err)
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
      logger.error('Delete user error:', err)
      showToast({ message: t('settings.userManagement.userDeleteFailed') || 'Failed to delete user', type: 'error' })
    }
  }

  useEffect(() => {
    if (activeSection === 'users' && isAdmin) {
      fetchUsers()
    }
  }, [activeSection, isAdmin])

  useEffect(() => {
    if (!user) return
    setUsernameVal(user.username || '')
    setEmailVal(user.email || '')
    setDisplayNameVal(user.displayName || user.username || '')
    setFirstName(user.firstName || '')
    setLastName(user.lastName || '')

    const preferred = user?.language || null
    if (preferred && preferred !== language) setLanguage(preferred)
    setAvatarPreview(getProxiedAvatarUrl(user.avatar))
    setAvatarFile(null)
    setAvatarError(false)
    setAvatarRetryCount(0)

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
        language,
        avatar: avatarPreview
      }

      if (!isSSO) {
        updates.username = usernameVal
        updates.email = emailVal
      }
      await updateUser(updates)
      showToast({ message: t('settings.profileSaved') || 'Profile saved', type: 'success' })
    } catch (err) {
      logger.error('Save profile error:', err)
      showToast({ message: t('settings.saveFailed') || 'Failed to save profile', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleSectionClick = (id) => {
    logger.debug('Settings: switch to', id)
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
              {(() => {
                const label = langToConfirm ? (languageLabels[langToConfirm] || langToConfirm) : ''
                return <p>{t('settings.languageConfirmMsg') || `Apply ${label} as your UI language? If you don't apply, it will revert to the previous language.`}</p>
              })()}
            </div>
            <div className="lang-confirm-actions">
              <button className="btn-secondary" onClick={() => {
                // Revert
                setPendingLanguage(language)
                setLangToConfirm(null)
                setShowLangConfirm(false)
              }}>{t('common.cancel') || 'Cancel'}</button>
              <button className="btn-primary" onClick={() => {
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

      {showSSOEditor && isAdmin && (
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
                    try { logout() } catch (e) { }
                    setTimeout(() => { window.location.href = '/login' }, 350)
                  } else {
                    const data = await r.json()
                    showToast({ message: data.message || 'Failed to revoke sessions', type: 'error' })
                  }
                } catch (err) {
                  logger.error('Sign out everywhere error:', err)
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
                      try { logout() } catch (e) { }
                      setTimeout(() => { window.location.href = '/login' }, 350)
                    } else {
                      handleLoadSessions()
                    }
                  } else {
                    const data = await r.json()
                    showToast({ message: data.message || 'Failed to revoke session', type: 'error' })
                  }
                } catch (err) {
                  logger.error('Revoke session error:', err)
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

          {/* Save changes button */}

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
                      <a className="btn-primary btn-icon" href="https://auth.ghassi.cloud/realms/master/account/account-security/signing-in" target="_blank" rel="noopener noreferrer" onClick={(e) => {
                        const href = 'https://auth.ghassi.cloud/realms/master/account/account-security/signing-in'
                        // Desktop PWA: open in an embedded webview modal
                        if (isPWA() && !isMobile()) {
                          e.preventDefault()
                          openWebview(href, 'Auth')
                          return
                        }

                        // Non-PWA (normal browser): open a new tab
                        if (!isPWA()) {
                          e.preventDefault()
                          window.open(href, '_blank', 'noopener,noreferrer')
                          return
                        }

                        // Mobile PWA: allow the default behaviour (opens externally in the system browser)
                      }}><Lock size={14} />{t('settings.changeOnAuthPlatform') || 'Change password'}</a>
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

              {/* Admin-only: PWA Developer tools card (single area with action) */}
              {isAdmin && (
                <>
                  <div className="sso-card">
                    <div className="sso-card-left"><Monitor size={22} /></div>
                    <div className="sso-card-body">
                      <h4>{t('settings.pwaDevTools.title') || 'Allow Developer Tools (F12) in PWA'}</h4>
                      <p className="form-hint">{t('settings.pwaDevTools.desc') || 'When enabled by an administrator, pressing F12 in the installed PWA will open the app (or an embedded webview) in a new window so DevTools can be used.'}<br /><span className="muted small">{t('settings.pwaDevTools.adminHint') || 'Admins only — only administrators can enable this setting'}</span></p>
                    </div>
                    <div className="sso-card-actions">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <label className="toggle" style={{ margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={!!pwaDevToolsEnabled}
                            disabled={savingPwaSetting}
                            onChange={async () => {
                              const next = !pwaDevToolsEnabled
                              setPwaDevToolsEnabled(next)
                              setSavingPwaSetting(true)
                              setPwaSaveError(null)
                              try {
                                const token = getAuthToken()
                                const headers = { 'Content-Type': 'application/json' }
                                if (token) headers.Authorization = token
                                const res = await fetch('/api/auth/admin/settings', {
                                  method: 'POST',
                                  headers,
                                  body: JSON.stringify({ key: 'pwaDevtoolsEnabled', value: next ? 'true' : 'false' })
                                })

                                if (res.ok) {
                                  showToast({ message: (t('settings.pwaDevTools.saved') || 'Setting saved'), type: 'success' })
                                  try { window.dispatchEvent(new CustomEvent('ghassicloud:settings-updated', { detail: { key: 'pwaDevtoolsEnabled', value: next ? 'true' : 'false' } })) } catch (e) { }
                                } else {
                                  let msg = t('settings.pwaDevTools.saveFailed') || 'Failed to save setting'
                                  if (res.status === 403) msg = t('settings.adminRequired') || 'Admin access required'
                                  if (res.status === 401) msg = t('settings.notAuthenticated') || 'Not authenticated — please sign in'
                                  try {
                                    const data = await res.json()
                                    if (data && data.message) msg = data.message
                                  } catch (e) {
                                    try { const txt = await res.text(); if (txt) msg = txt } catch (ee) { }
                                  }
                                  setPwaDevToolsEnabled(!next)
                                  setPwaSaveError(msg)
                                }
                              } catch (e) {
                                setPwaDevToolsEnabled(!next)
                                setPwaSaveError(t('settings.pwaDevTools.saveFailed') || 'Failed to save setting')
                              } finally {
                                setSavingPwaSetting(false)
                              }
                            }}
                          />
                          <span className="toggle-slider" />
                        </label>
                        {pwaSaveError && <div className="muted small" style={{ color: 'var(--danger)', marginLeft: 12 }}>{pwaSaveError}</div>}
                      </div>
                    </div>
                  </div>

                  {/* Admin-only: Global Log Level control */}
                  <div className="sso-card">
                    <div className="sso-card-left"><Terminal size={22} /></div>
                    <div className="sso-card-body">
                      <h4>{t('settings.logLevel.title') || 'Global Log Level'}</h4>
                      <p className="form-hint">{t('settings.logLevel.desc') || 'Administrators can set the global log level. This affects both frontend and backend logging for all users.'}<br /><span className="muted small">{t('settings.pwaDevTools.adminHint') || 'Admins only — only administrators can change this setting'}</span></p>

                      <div style={{ marginTop: 8 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span className="muted small">error</span>
                          <input
                            type="range"
                            min={0}
                            max={3}
                            step={1}
                            value={['error', 'warn', 'info', 'debug'].indexOf(logLevel)}
                            disabled={savingLogLevel}
                            onChange={handleLogLevelChange}
                          />
                          <span className="muted small">debug</span>
                          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                            <strong>{logLevel}</strong>
                            <span className="muted small">{t('settings.logLevel.scope') || 'Applies to frontend and backend'}</span>
                          </div>
                        </div>

                        {logLevelError && (
                          <div className="muted small" style={{ color: 'var(--danger)' }}>{logLevelError}</div>
                        )}
                      </div>
                    </div>
                  </div>

                </>)}


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
                                {s.userAgent ? (() => { const parsed = parseUserAgent(s.userAgent); const name = parsed.name + (parsed.version ? ` ${parsed.version}` : ''); const Icon = parsed.icon ? ({ 'Globe': Globe, 'Zap': Zap, 'Compass': Compass, 'Terminal': Terminal, 'Package': Package, 'Box': Box, 'Monitor': Monitor }[parsed.icon]) : Globe; return (<><Icon size={14} className="ua-icon" />&nbsp;{name.length > 80 ? `${name.slice(0, 80)}…` : name}</>) })() : ''}
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
                        )
                      })
                    )
                  )}
                </div>

                <div className="sessions-actions sessions-actions-bottom" style={{ marginTop: '0.75rem' }}>
                  <button className="btn-danger" onClick={() => setShowConfirmSignOutAll(true)}>{t('settings.signOutEverywhere') || 'Sign out everywhere'}</button>
                </div>

              </div>

              <hr className="section-sep" />
              {isAdmin && (
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
              )}

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
                          logger.warn('Avatar failed to load')
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
                      <option value="system">{t('settings.languageSystem') || 'System'}</option>
                      <option value="en">{languageLabels.en}</option>
                      <option value="es">{languageLabels.es}</option>
                      <option value="fr">{languageLabels.fr}</option>
                      <option value="de">{languageLabels.de}</option>
                      <option value="ar">{languageLabels.ar}</option>
                      <option value="ru">{languageLabels.ru}</option>
                      <option value="pt">{languageLabels.pt}</option>
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
              <div className="toggle-group">
                <div className="toggle-item">
                  <div>
                    <h4>{t('settings.syncPreferences.title') || 'Sync preferences across devices'}</h4>
                    <p>{t('settings.syncPreferences.desc') || 'Save appearance preferences to your account and sync them across devices. Turn off to keep settings local to this browser.'}</p>
                  </div>
                  <label className="toggle">
                    <input type="checkbox" checked={!!syncPreferences} onChange={handleToggleSync} />
                    <span className="toggle-slider" />
                  </label>
                </div>
                <div className="toggle-item">
                  <div>
                    <h4>{t('settings.weather.title') || 'Show weather widget'}</h4>
                    <p>{t('settings.weather.desc') || 'Display local weather on your dashboard. Uses browser location (not stored on servers). You can disable this anytime.'}</p>
                  </div>
                  <label className="toggle">
                    <input type="checkbox" checked={!!showWeather} onChange={handleToggleWeather} />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>{t('settings.theme')}</label>
                <div className="theme-selector">
                  <button
                    className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                    onClick={() => setTheme('light')}
                  >
                    <Sun size={24} />
                    <span>{t('settings.themeOptions.light') || 'Light'}</span>
                  </button>
                  <button
                    className={`theme-option ${theme === 'beige' ? 'active' : ''}`}
                    onClick={() => setTheme('beige')}
                  >
                    <Coffee size={24} />
                    <span>{t('settings.themeOptions.beige') || 'Beige'}</span>
                  </button>
                  <button
                    className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                    onClick={() => setTheme('dark')}
                  >
                    <Moon size={24} />
                    <span>{t('settings.themeOptions.dark') || 'Dark'}</span>
                  </button>
                  <button
                    className={`theme-option ${theme === 'midnight' ? 'active' : ''}`}
                    onClick={() => setTheme('midnight')}
                  >
                    <Contrast size={24} />
                    <span>{t('settings.themeOptions.midnight') || 'Midnight'}</span>
                  </button>
                  <button
                    className={`theme-option ${theme === 'system' ? 'active' : ''}`}
                    onClick={() => setTheme('system')}
                  >
                    <Monitor size={24} />
                    <span>{t('settings.themeOptions.system') || 'System'}</span>
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
                      onClick={() => setAccent(id, undefined, true)}
                      title={name}
                    >
                      {currentAccent.id === id && <Check size={14} />}
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
                    className={`custom-color-trigger ${currentAccent.id === 'custom' ? 'active' : ''} ${showColorPicker ? 'expanded' : ''}`}
                    onClick={() => setShowColorPicker(!showColorPicker)}
                  >
                    <div
                      className="color-preview"
                      style={{ backgroundColor: currentAccent.id === 'custom' ? currentAccent.color : '#6366f1' }}
                    ></div>
                    <span className="color-label">{currentAccent.id === 'custom' ? currentAccent.color.toUpperCase() : '#6366F1'}</span>
                    {currentAccent.id === 'custom' && <Check size={16} />}
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
                                setAccent('custom', hex, true)
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
                                setAccent('custom', hex, true)
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
                              value={hexInput || (currentAccent.id === 'custom' ? currentAccent.color : '#6366f1')}
                              onChange={(e) => {
                                let value = e.target.value.toUpperCase()
                                if (!value.startsWith('#')) value = '#' + value
                                if (/^#[0-9A-F]{0,6}$/.test(value)) {
                                  setHexInput(value)
                                  if (value.length === 7) {
                                    setAccent('custom', value, true)
                                    const hsl = hexToHSL(value)
                                    setHue(hsl.h)
                                    setSaturation(hsl.s)
                                    setLightness(hsl.l)
                                  }
                                }
                              }}
                              onBlur={() => {
                                if (currentAccent.id === 'custom') {
                                  setHexInput(currentAccent.color)
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
                              style={{ backgroundColor: (hexInput && hexInput.length === 7) ? hexInput : (currentAccent.id === 'custom' ? currentAccent.color : '#6366f1') }}
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
                                setAccent('custom', color, true)
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
              {accentPreviewActive && (
                <div className="form-group" style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => { confirmAccent(); showToast({ message: t('settings.accentSaved') || 'Accent color saved', type: 'success' }) }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <Save size={14} />
                    {t('settings.saveAccent') || 'Save Accent Color'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => revertAccent()}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    {t('settings.revertAccent') || 'Revert'}
                  </button>
                </div>
              )}
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

              <hr className="section-sep" />
              <div className="danger-zone reset-danger">
                <h3>{t('settings.resetDefaults.title') || 'Reset appearance to defaults'}</h3>
                <p className="form-hint">{t('settings.resetDefaults.desc') || 'Restore default theme, accent and logo. Optionally forget server-saved preferences.'}</p>
                <div className="danger-action">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <label className="toggle">
                      <input type="checkbox" checked={forgetServerPrefs} onChange={() => setForgetServerPrefs(prev => !prev)} aria-label={t('settings.resetDefaults.forgetServer') || 'Forget server preferences'} />
                      <span className="toggle-slider" />
                    </label>
                    <span className="toggle-label">{t('settings.resetDefaults.forgetServer') || 'Forget server preferences'}</span>
                  </div>
                  <button className="btn btn-danger" onClick={handleResetDefaults}>
                    <AlertTriangle size={14} className="reset-icon" />
                    <span>{t('settings.resetDefaults.button') || 'Reset to defaults'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'updates' && (
            <div className="settings-section">
              <h2>{t('settings.updates.title')}</h2>
              <div className="form-group">
                <label>{t('settings.updates.checkLabel')}</label>
                <p className="form-hint">{t('settings.updates.description')}</p>
                <button
                  className="btn-secondary"
                  onClick={async () => {
                    setCheckingUpdate(true)
                    try {
                      const hasUpdate = await checkForUpdate()
                      if (hasUpdate) {
                        showToast({ message: t('settings.updates.available'), type: 'success' })
                      } else {
                        showToast({ message: t('settings.updates.upToDate'), type: 'info' })
                      }
                    } catch (err) {
                      logger.error('Update check failed:', err)
                      showToast({ message: t('settings.updates.checkFailed'), type: 'error' })
                    } finally {
                      setCheckingUpdate(false)
                    }
                  }}
                  disabled={checkingUpdate}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <RefreshCw size={16} className={checkingUpdate ? 'spinning' : ''} />
                  {checkingUpdate ? t('settings.updates.checking') : t('settings.updates.check')}
                </button>
              </div>
              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label>{t('settings.updates.versionInfo')}</label>
                <p className="form-hint">
                  {t('settings.updates.currentVersion')}: <strong>{import.meta.env.VITE_APP_VERSION || '1.9.8'}</strong>
                </p>
              </div>
              <div className="form-group" style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <label style={{ color: 'var(--danger)' }}>{t('settings.updates.forceRefresh') || 'Force Refresh'}</label>
                <p className="form-hint">
                  {t('settings.updates.forceRefreshDesc') || 'If the app is stuck on an old version, force refresh will clear all caches and reload. Your login will be preserved.'}
                </p>
                <button
                  className="btn-danger"
                  onClick={async () => {
                    if (window.confirm(t('settings.updates.forceRefreshConfirm') || 'This will clear all cached data and reload the app. Your login will be preserved. Continue?')) {
                      setForceRefreshing(true)
                      try {
                        await forceRefresh()
                      } catch (err) {
                        logger.error('Force refresh failed:', err)
                        setForceRefreshing(false)
                        showToast({ message: t('settings.updates.forceRefreshFailed') || 'Force refresh failed', type: 'error' })
                      }
                    }
                  }}
                  disabled={forceRefreshing}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <RefreshCw size={16} className={forceRefreshing ? 'spinning' : ''} />
                  {forceRefreshing ? (t('settings.updates.forceRefreshing') || 'Refreshing...') : (t('settings.updates.forceRefreshBtn') || 'Force Refresh')}
                </button>
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
                  <button className="btn-secondary" onClick={handleExportData} disabled={exporting} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    {exporting ? <div className="button-spinner" /> : t('settings.exportJSON')}
                  </button>
                </div>
                <div className="data-card">
                  <Database size={32} />
                  <h4>{t('settings.importData')}</h4>
                  <p>{t('settings.importDataDesc')}</p>
                  <button className="btn-secondary" onClick={handleImportClick} disabled={importing} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>{importing ? <div className="button-spinner" /> : t('settings.import')}</button>
                  <input ref={importFileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={handleImportFile} />
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

          {/* Event Spotlight Section (Admin Only) */}
          {activeSection === 'eventqr' && isAdmin && (
            <div className="settings-section">
              <div className="section-header">
                <div>
                  <h2>{t('settings.eventQr.title') || 'Event Spotlight'}</h2>
                  <p>{t('settings.eventQr.desc') || 'Configure a featured event highlight on the dashboard for events, temporary links, or promotions. Visible to all users when enabled.'}</p>
                </div>
              </div>

              <div className="sso-card">
                <div className="sso-card-left"><Sparkles size={22} /></div>
                <div className="sso-card-body">
                  <h4>{t('settings.eventQr.visibility') || 'Visibility'}</h4>
                  <p className="form-hint">{t('settings.eventQr.visibilityDesc') || 'Toggle whether the event spotlight is displayed on the dashboard for all users.'}</p>
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label className="toggle" style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={eventQrVisible}
                        disabled={savingEventQr}
                        onChange={async () => {
                          const next = !eventQrVisible
                          setEventQrVisible(next)
                          try {
                            setSavingEventQr(true)
                            const token = getAuthToken()
                            const headers = { 'Content-Type': 'application/json' }
                            if (token) headers.Authorization = token
                            const res = await fetch('/api/auth/admin/settings', { method: 'POST', headers, body: JSON.stringify({ key: 'eventQrVisible', value: next ? 'true' : 'false' }) })
                            if (res.ok) {
                              showToast({ message: next ? (t('settings.eventQr.enabled') || 'Event spotlight enabled') : (t('settings.eventQr.disabled') || 'Event spotlight hidden'), type: 'success' })
                              try { window.dispatchEvent(new CustomEvent('ghassicloud:settings-updated', { detail: { key: 'eventQrVisible', value: next ? 'true' : 'false' } })) } catch (e) { }
                            } else {
                              setEventQrVisible(!next)
                              showToast({ message: t('settings.eventQr.saveFailed') || 'Failed to save', type: 'error' })
                            }
                          } catch (e) {
                            setEventQrVisible(!next)
                            showToast({ message: t('settings.eventQr.saveFailed') || 'Failed to save', type: 'error' })
                          } finally { setSavingEventQr(false) }
                        }}
                      />
                      <span className="toggle-slider" />
                    </label>
                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{eventQrVisible ? (t('settings.eventQr.visibleLabel') || 'Visible on dashboard') : (t('settings.eventQr.hiddenLabel') || 'Hidden')}</span>
                  </div>
                </div>
              </div>

              <div className="sso-card" style={{ marginTop: '1rem' }}>
                <div className="sso-card-left"><Globe size={22} /></div>
                <div className="sso-card-body">
                  <h4>{t('settings.eventQr.configTitle') || 'Event Configuration'}</h4>
                  <p className="form-hint">{t('settings.eventQr.configDesc') || 'Set the target URL and a display label for the event spotlight.'}</p>

                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label className="muted small" style={{ marginBottom: 4, display: 'block' }}>{t('settings.eventQr.urlLabel') || 'Target URL'}</label>
                      <input
                        type="url"
                        value={eventQrUrl}
                        onChange={(e) => setEventQrUrl(e.target.value)}
                        placeholder="https://example.com/event"
                        style={{ width: '100%', padding: '0.5rem 0.7rem', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-input, var(--bg-secondary))', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                      />
                    </div>

                    <div>
                      <label className="muted small" style={{ marginBottom: 4, display: 'block' }}>{t('settings.eventQr.labelField') || 'Display Label'}</label>
                      <input
                        type="text"
                        value={eventQrLabel}
                        onChange={(e) => setEventQrLabel(e.target.value)}
                        placeholder={t('settings.eventQr.labelPlaceholder') || 'e.g., Summer Event 2026'}
                        maxLength={60}
                        style={{ width: '100%', padding: '0.5rem 0.7rem', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-input, var(--bg-secondary))', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button
                        className="btn-primary"
                        disabled={savingEventQr}
                        style={{ padding: '0.45rem 1.2rem', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600 }}
                        onClick={async () => {
                          try {
                            setSavingEventQr(true)
                            setEventQrSaved(false)
                            const token = getAuthToken()
                            const headers = { 'Content-Type': 'application/json' }
                            if (token) headers.Authorization = token
                            const [r1, r2] = await Promise.all([
                              fetch('/api/auth/admin/settings', { method: 'POST', headers, body: JSON.stringify({ key: 'eventQrUrl', value: eventQrUrl }) }),
                              fetch('/api/auth/admin/settings', { method: 'POST', headers, body: JSON.stringify({ key: 'eventQrLabel', value: eventQrLabel }) })
                            ])
                            if (r1.ok && r2.ok) {
                              setEventQrSaved(true)
                              showToast({ message: t('settings.eventQr.saved') || 'Event spotlight saved', type: 'success' })
                              try {
                                window.dispatchEvent(new CustomEvent('ghassicloud:settings-updated', { detail: { key: 'eventQrUrl', value: eventQrUrl } }))
                                window.dispatchEvent(new CustomEvent('ghassicloud:settings-updated', { detail: { key: 'eventQrLabel', value: eventQrLabel } }))
                              } catch (e) { }
                              setTimeout(() => setEventQrSaved(false), 2500)
                            } else {
                              showToast({ message: t('settings.eventQr.saveFailed') || 'Failed to save', type: 'error' })
                            }
                          } catch (e) {
                            logger.error('Save event QR error:', e)
                            showToast({ message: t('settings.eventQr.saveFailed') || 'Failed to save', type: 'error' })
                          } finally { setSavingEventQr(false) }
                        }}
                      >
                        {savingEventQr ? (t('common.loading') || 'Saving...') : eventQrSaved ? '✓ Saved' : (t('settings.saveChanges') || 'Save Changes')}
                      </button>
                      {eventQrUrl && (
                        <a href={eventQrUrl} target="_blank" rel="noopener noreferrer" className="muted small" style={{ textDecoration: 'none', color: 'var(--accent)' }}>
                          {t('settings.eventQr.preview') || 'Preview link ↗'}
                        </a>
                      )}
                    </div>

                    {/* Live preview */}
                    {eventQrUrl && eventQrVisible && (
                      <div style={{ marginTop: 8, padding: '1rem', borderRadius: 12, background: 'rgba(99, 102, 241, 0.06)', border: '1px solid rgba(99, 102, 241, 0.12)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(eventQrUrl)}&bgcolor=0f1724&color=ffffff&margin=1`}
                          alt="Event Preview"
                          style={{ width: 64, height: 64, borderRadius: 8, imageRendering: 'pixelated' }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{eventQrLabel || 'No label'}</span>
                          <span className="muted small">{eventQrUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                          <span className="muted small" style={{ color: '#22c55e' }}>✓ {t('settings.eventQr.visibleLabel') || 'Visible on dashboard'}</span>
                        </div>
                      </div>
                    )}
                  </div>
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
                      {allUsers.map(u => { const isGeneratedAvatar = (url) => { if (!url) return false; return /(ui-avatars\.com|avatars\.dicebear\.org|identicon|initials|avatar=)/i.test(url); }; const generated = isGeneratedAvatar(u.avatar); return (
                        <tr key={u.id}>
                          <td data-label={t('settings.userManagement.tableUser') || 'User'}>
                            <div className="user-info">
                              <div className={`avatar-wrapper ${u.avatar && !generated ? '' : 'placeholder-active'}`}>
                                <img
                                  src={!generated && u.avatar ? getProxiedAvatarUrl(u.avatar) : undefined}
                                  alt={generated ? '' : u.username}
                                  className="user-avatar-small"
                                  onLoad={(e) => {
                                    const wrapper = e.currentTarget.parentElement
                                    if (wrapper) wrapper.classList.remove('placeholder-active')
                                    const ph = e.currentTarget.nextElementSibling
                                    if (ph) ph.style.display = 'none'
                                    e.currentTarget.style.display = 'block'
                                  }}
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none'
                                    const wrapper = e.currentTarget.parentElement
                                    if (wrapper) wrapper.classList.add('placeholder-active')
                                    const ph = e.currentTarget.nextElementSibling
                                    if (ph) ph.style.display = 'flex'
                                  }}
                                />
                                <div className="user-avatar-small placeholder" style={{ display: u.avatar && !generated ? 'none' : 'flex' }} aria-hidden="true">
                                  {(u.display_name || u.username || '?')[0]?.toUpperCase()}
                                </div>
                              </div>
                              <div>
                                <div className="user-name">{u.display_name || u.username}</div>
                                <div className="user-username">@{u.username}</div>
                              </div>
                            </div>
                          </td>
                          <td data-label={t('settings.userManagement.tableEmail') || 'Email'}>{u.email}</td>
                          <td data-label={t('settings.userManagement.tableRole') || 'Role'}>
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
                          <td data-label={t('settings.userManagement.tableSSO') || 'SSO'}>
                            {u.sso_provider ? (
                              <span className="sso-badge">
                                <Check size={14} />
                                {t('settings.userManagement.ssoEnabled') || 'SSO'}
                              </span>
                            ) : (
                              <span className="local-badge">{t('settings.userManagement.localAccount') || 'Local'}</span>
                            )}
                          </td>
                          <td data-label={t('settings.userManagement.tableActions') || 'Actions'}>
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
                      )})}
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
