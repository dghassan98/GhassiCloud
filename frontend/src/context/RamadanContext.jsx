import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { isNative } from '../hooks/useCapacitor'
import logger from '../logger'

const RamadanContext = createContext()

const STORAGE_KEY = 'ghassicloud-ramadan-enabled'

/**
 * Checks whether the Ramadan theme season is currently active
 * based on admin-configured end date (defaults to March 31 of current year).
 */
function isRamadanSeason(endDateStr) {
  const now = new Date()
  // Default: active from Feb 1 to Mar 31
  const year = now.getFullYear()
  const seasonStart = new Date(year, 1, 1) // Feb 1
  let seasonEnd

  if (endDateStr) {
    seasonEnd = new Date(endDateStr)
    // If parsed date is invalid, fall back
    if (isNaN(seasonEnd.getTime())) {
      seasonEnd = new Date(year, 2, 31, 23, 59, 59) // Mar 31
    }
  } else {
    seasonEnd = new Date(year, 2, 31, 23, 59, 59) // Mar 31
  }

  return now >= seasonStart && now <= seasonEnd
}

export function RamadanProvider({ children }) {
  const auth = useAuth()
  const user = auth?.user
  const isAdmin = user?.role === 'admin'

  // Admin settings from server
  const [adminStartDate, setAdminStartDate] = useState('')
  const [adminEndDate, setAdminEndDate] = useState('')
  const [adminShowPreference, setAdminShowPreference] = useState(true) // whether users see toggle
  const [adminEnabled, setAdminEnabled] = useState(true) // master on/off

  // User preference (opt-out)
  const [userEnabled, setUserEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved === null ? true : saved === 'true'
    } catch { return true }
  })

  // Whether the season is currently active
  const [seasonActive, setSeasonActive] = useState(false)

  // Whether we're in pre-Ramadan countdown mode
  const [isPreRamadan, setIsPreRamadan] = useState(false)

  // Fetch admin Ramadan settings
  const fetchAdminSettings = useCallback(async () => {
    try {
      const token = localStorage.getItem('ghassicloud-token')
      const headers = {}
      if (token) headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`

      const res = await fetch('/api/auth/ramadan-settings', { headers })
      if (res.ok) {
        const data = await res.json()
        setAdminStartDate(data.startDate || '')
        setAdminEndDate(data.endDate || '')
        setAdminShowPreference(data.showPreference !== false)
        setAdminEnabled(data.enabled !== false)
        const inSeason = data.enabled !== false && isRamadanSeason(data.endDate)
        setSeasonActive(inSeason)
        // Check if we're before Ramadan start but in the season window
        if (inSeason && data.startDate) {
          const now = new Date()
          const start = new Date(data.startDate + 'T00:00:00')
          setIsPreRamadan(now < start)
        } else {
          setIsPreRamadan(false)
        }
      } else {
        // Fallback: use defaults
        setSeasonActive(isRamadanSeason())
      }
    } catch (e) {
      logger.debug('Failed to fetch Ramadan settings, using defaults:', e)
      setSeasonActive(isRamadanSeason())
    }
  }, [])

  useEffect(() => {
    fetchAdminSettings()
  }, [fetchAdminSettings])

  // Listen for admin settings updates
  useEffect(() => {
    const handler = (e) => {
      const d = e?.detail
      if (!d?.key) return
      if (d.key === 'ramadanEnabled') {
        setAdminEnabled(d.value === 'true')
        setSeasonActive(d.value === 'true' && isRamadanSeason(adminEndDate))
      }
      if (d.key === 'ramadanStartDate') {
        setAdminStartDate(d.value || '')
      }
      if (d.key === 'ramadanEndDate') {
        setAdminEndDate(d.value || '')
        setSeasonActive(adminEnabled && isRamadanSeason(d.value))
      }
      if (d.key === 'ramadanShowPreference') {
        setAdminShowPreference(d.value === 'true')
      }
    }
    window.addEventListener('ghassicloud:settings-updated', handler)
    return () => window.removeEventListener('ghassicloud:settings-updated', handler)
  }, [adminEnabled, adminEndDate])

  // Persist user preference
  const setRamadanEnabled = useCallback((enabled) => {
    setUserEnabled(enabled)
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false')
    } catch (e) {
      logger.error('Failed to save Ramadan preference:', e)
    }
  }, [])

  // Final computed: is the Ramadan theme active right now?
  const isRamadanActive = seasonActive && adminEnabled && userEnabled

  // Whether the user toggle should be shown in settings
  const showUserToggle = seasonActive && adminEnabled && adminShowPreference

  return (
    <RamadanContext.Provider value={{
      isRamadanActive,
      isPreRamadan,
      showUserToggle,
      userEnabled,
      setRamadanEnabled,
      // Admin-only
      adminStartDate,
      adminEndDate,
      adminShowPreference,
      adminEnabled,
      setAdminStartDate,
      setAdminEndDate,
      setAdminShowPreference,
      setAdminEnabled,
      seasonActive,
      fetchAdminSettings,
      isAdmin
    }}>
      {children}
    </RamadanContext.Provider>
  )
}

export function useRamadan() {
  const ctx = useContext(RamadanContext)
  if (!ctx) throw new Error('useRamadan must be used within RamadanProvider')
  return ctx
}

export default RamadanContext
