import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, Search, Grid, List, ExternalLink, 
  Server, Database, Cloud, HardDrive, Shield, 
  Monitor, Film, Music, FileText, Image,
  Home, Cpu, Smartphone, Lightbulb, ChevronRight,
  MapPin, Droplets, Wind, Thermometer, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, Sun, CloudSun, CloudFog, RefreshCw as RefreshIcon
} from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'
import ServiceCard from '../components/ServiceCard'
import StatsCard from '../components/StatsCard'
import { RefreshCw, Loader2 } from 'lucide-react'
import ServicesStatusCard from '../components/ServicesStatusCard'
import AddServiceModal from '../components/AddServiceModal'
import EditServiceModal from '../components/EditServiceModal'
import EventQRCard from '../components/EventQRCard'
import RamadanCountdownCard from '../components/RamadanCountdownCard'
import { isNative, isPWA, isMobile } from '../hooks/useCapacitor'
import { useWebview } from '../context/WebviewContext'
import '../styles/dashboard.css'
import logger from '../logger' 

const iconMap = {
  server: Server,
  database: Database,
  cloud: Cloud,
  storage: HardDrive,
  security: Shield,
  monitor: Monitor,
  media: Film,
  music: Music,
  documents: FileText,
  photos: Image,
  home: Home,
  compute: Cpu,
  default: Cloud
};

/* ── WMO Weather Code → icon & label key mapping ── */
const weatherMeta = (code) => {
  if (code === 0) return { icon: Sun, label: 'weather.clear', bg: 'weather-clear' }
  if (code <= 3) return { icon: CloudSun, label: 'weather.partlyCloudy', bg: 'weather-cloudy' }
  if (code <= 48) return { icon: CloudFog, label: 'weather.foggy', bg: 'weather-fog' }
  if (code <= 57) return { icon: CloudDrizzle, label: 'weather.drizzle', bg: 'weather-rain' }
  if (code <= 67) return { icon: CloudRain, label: 'weather.rain', bg: 'weather-rain' }
  if (code <= 77) return { icon: CloudSnow, label: 'weather.snow', bg: 'weather-snow' }
  if (code <= 82) return { icon: CloudRain, label: 'weather.showers', bg: 'weather-rain' }
  if (code <= 86) return { icon: CloudSnow, label: 'weather.snowShowers', bg: 'weather-snow' }
  if (code >= 95) return { icon: CloudLightning, label: 'weather.thunderstorm', bg: 'weather-storm' }
  return { icon: Cloud, label: 'weather.cloudy', bg: 'weather-cloudy' }
}

/* ── Weather Widget (Open-Meteo, free, no API key) ── */
function WeatherWidget() {
  const { t } = useLanguage()
  const [weather, setWeather] = useState(null)
  const [city, setCity] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchWeather = async () => {
    setLoading(true)
    setError(null)
    try {
      /* 1. Get coords from browser or fall back to IP geolocation */
      let lat, lon
      try {
        const pos = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 6000, maximumAge: 600000 })
        )
        lat = pos.coords.latitude
        lon = pos.coords.longitude
      } catch {
        /* Fallback: IP-based location via open API */
        const ipRes = await fetch('https://ipapi.co/json/')
        if (ipRes.ok) {
          const ipData = await ipRes.json()
          lat = ipData.latitude
          lon = ipData.longitude
          if (!city) setCity(ipData.city || '')
        } else {
          throw new Error('location')
        }
      }

      /* 2. Reverse geocode for city name (Open-Meteo geocoding) */
      if (!city) {
        try {
          const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`)
          if (geoRes.ok) {
            const geoData = await geoRes.json()
            setCity(geoData.address?.city || geoData.address?.town || geoData.address?.village || '')
          }
        } catch { /* ignore, city is optional */ }
      }

      /* 3. Fetch weather from Open-Meteo */
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`
      const res = await fetch(url)
      if (!res.ok) throw new Error('api')
      const data = await res.json()
      setWeather(data.current)
    } catch (err) {
      logger.debug('Weather fetch error', err)
      setError(err.message === 'location' ? 'location' : 'api')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWeather()
    const id = setInterval(fetchWeather, 15 * 60 * 1000) // refresh every 15 min
    return () => clearInterval(id)
  }, [])

  if (error === 'location') {
    return (
      <motion.div className="weather-widget weather-error" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <MapPin size={20} />
        <span className="weather-error-text">{t('weather.locationDenied') || 'Enable location for weather'}</span>
        <button className="weather-retry" onClick={fetchWeather}><RefreshIcon size={14} /></button>
      </motion.div>
    )
  }

  if (loading || !weather) {
    return (
      <motion.div className="weather-widget weather-loading" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="weather-skeleton">
          <div className="skel-circle" />
          <div className="skel-lines">
            <div className="skel-line skel-lg" />
            <div className="skel-line skel-sm" />
          </div>
        </div>
        <div className="weather-details" style={{ marginTop: '0.5rem' }}>
          <span className="weather-detail" style={{ width: '80px', height: '20px' }}></span>
          <span className="weather-detail" style={{ width: '70px', height: '20px' }}></span>
          <span className="weather-detail" style={{ width: '50px', height: '20px' }}></span>
        </div>
      </motion.div>
    )
  }

  const meta = weatherMeta(weather.weather_code)
  const WeatherIcon = meta.icon
  const temp = Math.round(weather.temperature_2m)
  const feelsLike = Math.round(weather.apparent_temperature)
  const humidity = weather.relative_humidity_2m
  const wind = Math.round(weather.wind_speed_10m)

  return (
    <motion.div
      className={`weather-widget ${meta.bg}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <div className="weather-main">
        <div className="weather-icon-wrap">
          <WeatherIcon size={32} strokeWidth={1.5} />
        </div>
        <div className="weather-temp-col">
          <span className="weather-temp">{temp}°</span>
          <span className="weather-desc">{t(meta.label)}</span>
        </div>
      </div>
      <div className="weather-details">
        {city && (
          <span className="weather-detail"><MapPin size={13} /> {city}</span>
        )}
        <span className="weather-detail"><Thermometer size={13} /> {t('weather.feelsLike') || 'Feels'} {feelsLike}°</span>
        <span className="weather-detail"><Droplets size={13} /> {humidity}%</span>
        <span className="weather-detail"><Wind size={13} /> {wind} km/h</span>
      </div>
    </motion.div>
  )
}

/* ── Quick Tips Widget (pure local, no API) ── */
const tipKeys = [
  'dashboard.tips.pin',
  'dashboard.tips.search',
  'dashboard.tips.theme',
  'dashboard.tips.pull',
  'dashboard.tips.qr',
  'dashboard.tips.language',
]

function QuickTips() {
  const { t } = useLanguage()
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * tipKeys.length))

  useEffect(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % tipKeys.length), 8000)
    return () => clearInterval(id)
  }, [])

  return (
    <motion.div
      className="quick-tips-widget"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <div className="tip-icon-wrap">
        <Lightbulb size={16} />
      </div>
      <AnimatePresence mode="wait">
        <motion.span
          className="tip-text"
          key={idx}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.3 }}
        >
          {t(tipKeys[idx]) || 'Pin your favorite services for quick access.'}
        </motion.span>
      </AnimatePresence>
      <button className="tip-next" onClick={() => setIdx(i => (i + 1) % tipKeys.length)} aria-label="Next tip">
        <ChevronRight size={16} />
      </button>
    </motion.div>
  )
}

const defaultServices = [
  {
    id: '1',
    name: 'GhassiDrive',
    description: 'Your personal cloud storage',
    descriptionKey: 'service.ghassiDriveDesc',
    url: 'https://drive.ghassi.cloud/api/auth/oidc/login?redirect=%2Ffiles%2F',
    icon: 'cloud',
    color: '#0082c9',
    status: 'online',
    useFavicon: true,
    sortOrder: 0
  },

  {
    id: '2',
    name: 'GhassiGallery',
    description: 'Your personal cloud gallery',
    descriptionKey: 'service.ghassiGalleryDesc',
    url: 'https://gallery.ghassi.cloud',
    icon: 'photo',
    color: '#e5a00d',
    status: 'online',
    useFavicon: true,
    sortOrder: 1
  },
  {
    id: '3',
    name: 'GhassiMusic',
    description: 'Your personal music library',
    descriptionKey: 'service.ghassiMusicDesc',
    url: 'https://music.ghassi.cloud/sso/OID/start/keycloak',
    icon: 'music',
    color: '#41bdf5',
    status: 'online',
    useFavicon: true,
    sortOrder: 2
  },
  {
    id: '4',
    name: 'GhassiStream',
    description: 'Your personal streaming service',
    descriptionKey: 'service.ghassiStreamDesc',
    url: 'https://stream.ghassi.cloud/sso/OID/start/keycloak',
    icon: 'media',
    color: '#13b9fd',
    status: 'online',
    useFavicon: true,
    sortOrder: 3
  },


  {
    id: '5',
    name: 'GhassiNotes',
    description: 'Your personal notes library',
    descriptionKey: 'service.ghassiNotesDesc',
    url: 'https://notes.ghassi.cloud/',
    icon: 'documents',
    color: '#f46800',
    status: 'online',
    useFavicon: true,
    requiresExtraAuth: true,
    sortOrder: 4
  },
  {
    id: '6',
    name: 'GhassiShare',
    description: 'Your personal file sharing service',
    descriptionKey: 'service.ghassiShareDesc',
    url: 'https://share.ghassi.cloud/api/oauth/auth/oidc',
    icon: 'share-2',
    color: '#96060c',
    status: 'online',
    useFavicon: true,
    sortOrder: 5
   }
]

//TODO: Placeholder stats - NEEDS REVISION
const defaultStats = [
  { label: 'CPU Usage', value: '34%', trend: 'down', change: '-5%' },
  { label: 'Memory', value: '12.4 GB', trend: 'up', change: '+2.1 GB' },
  { label: 'Storage', value: '2.4 TB', trend: 'neutral', change: '78% used' }
]

export default function Dashboard() {
  const [services, setServices] = useState([])
  const servicesRef = useRef([])
  const setServicesAndRef = (value) => {
    setServices(prev => {
      const next = typeof value === 'function' ? value(prev) : value
      servicesRef.current = next
      return next
    })
  }
  const [stats, setStats] = useState(defaultStats)
  const [servicesOnline, setServicesOnline] = useState({ value: '', trend: 'neutral', change: '' })
  const [servicesOnlineLoading, setServicesOnlineLoading] = useState(false)
  const [servicesStatus, setServicesStatus] = useState({ total: 0, online: 0, offline: 0 })
  const [servicesOnlineHistory, setServicesOnlineHistory] = useState([])
  const [showServicesPopover, setShowServicesPopover] = useState(false)
  const servicesCardRef = useRef(null)
  const [popoverStyle, setPopoverStyle] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState('grid')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingService, setEditingService] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showWeather, setShowWeather] = useState(() => {
    try {
      const saved = localStorage.getItem('ghassicloud-show-weather')
      return saved === null ? true : saved === 'true'
    } catch { return true }
  })
  const token = localStorage.getItem('ghassicloud-token')

  // RT Services Online with manual refresh
  const fetchServicesOnline = async () => {
    setServicesOnlineLoading(true);
    try {
      const payloadServices = (servicesRef.current && servicesRef.current.length > 0) ? servicesRef.current : defaultServices
      logger.debug('[DEBUG] fetchServicesOnline payloadServices count:', payloadServices.length, payloadServices.map(p => p.id))
      const toCheck = payloadServices.map(s => ({ id: s.id, name: s.name, url: s.url }))
      const res = await fetch('/api/services/status/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ services: toCheck })
      });
      if (res.ok) {
        const data = await res.json();
        logger.debug('[DEBUG] fetchServicesOnline result count:', data.services.length, data.services.map(s => ({ id: s.id, online: s.online })))
        const total = data.services.length;
        const online = data.services.filter(s => s.online).length;
        const offline = total - online;

        const prevCount = servicesOnlineHistory.length > 0 ? servicesOnlineHistory[servicesOnlineHistory.length - 1] : null
        const diff = prevCount === null ? 0 : (online - prevCount)
        let trend = 'neutral'
        let changeText = ''
        if (diff > 0) { trend = 'up'; changeText = `+${diff}` }
        else if (diff < 0) { trend = 'down'; changeText = `${diff}` }

        setServicesOnline({ value: `${online}/${total}`, trend, change: changeText });
        setServicesStatus({ total, online, offline });

        setServicesOnlineHistory(h => {
          const next = [...h, online]
          if (next.length > 12) next.shift()
          return next
        })
        try {
          const current = (servicesRef.current && servicesRef.current.length > 0) ? servicesRef.current : payloadServices
          logger.debug('[DEBUG] fetchServicesOnline current before merge:', current.length, current.map(s => s.id))
          const merged = current.map(s => {
            const found = data.services.find(ds => ds.id === s.id)
            if (found) {
              return { ...s, status: found.online ? 'online' : 'offline' }
            }
            return s
          })
          logger.debug('[DEBUG] fetchServicesOnline merged:', merged.length, merged.map(s => ({ id: s.id, status: s.status })))
          if (Array.isArray(merged) && merged.length > 0) {
            setServicesAndRef(merged)
          } else {
            logger.warn('Status check returned no merge results, keeping existing services')
          }
        } catch (e) {
          logger.error('Merge services status error', e)
        }
      } else {
        setServicesOnline({ value: 'N/A', trend: 'neutral', change: '' });
        setServicesStatus({ total: 0, online: 0, offline: 0 });
      }
    } catch (err) {
      logger.error('fetchServicesOnline error', err)
      setServicesOnline({ value: 'N/A', trend: 'neutral', change: '' });
    } finally {
      setServicesOnlineLoading(false);
    }
  };

  const checkSingleService = async (service) => {
    try {
      const res = await fetch('/api/services/status/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ services: [{ id: service.id, name: service.name, url: service.url }] })
      })
      if (!res.ok) return
      const data = await res.json()
      const result = Array.isArray(data.services) && data.services[0]
      if (result) {
        setServicesAndRef(prev => prev.map(s => s.id === result.id ? { ...s, status: result.online ? 'online' : 'offline' } : s))
        fetchServicesOnline()
      }
    } catch (err) {
      logger.error('checkSingleService error', err)
    }
  }

  useEffect(() => {
    fetchServicesOnline()
    const interval = setInterval(fetchServicesOnline, 5 * 60 * 1000)
    logger.debug('Started services online interval')
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handler = () => {
      try {
        const saved = localStorage.getItem('ghassicloud-show-weather')
        setShowWeather(saved === null ? true : saved === 'true')
      } catch {}
    }
    window.addEventListener('ghassicloud:weather-preference-changed', handler)
    return () => window.removeEventListener('ghassicloud:weather-preference-changed', handler)
  }, [])

  function PercentDelta({ online = 0, total = 0, trend = 'neutral', change = '' }) {
    const pct = total ? Math.round((online / total) * 100) : null
    return (
      <div className="percent-delta-wrap" title={total ? `${online}/${total} online` : 'No data'}>
        <div className="percent-number">{pct === null ? '–' : `${pct}%`}</div>
        <div className={`delta-pill ${trend} ${statusClass}`}>{trend === 'up' ? '▲' : trend === 'down' ? '▼' : '–'} {change}</div>
      </div>
    )
  }

  function computePopoverStyle() {
    if (!servicesCardRef.current) return {}
    const rect = servicesCardRef.current.getBoundingClientRect()
    const popWidth = Math.min(360, Math.max(260, rect.width + 20))
    const popHeight = 280

    let left = rect.left + window.scrollX + (rect.width - popWidth) / 2
    const minLeft = 12 + window.scrollX
    const maxLeft = window.innerWidth - popWidth - 12 + window.scrollX
    if (left < minLeft) left = minLeft
    if (left > maxLeft) left = maxLeft

    let top
    if (rect.bottom + popHeight + 16 > window.innerHeight) {
      top = rect.top + window.scrollY - popHeight - 8
      if (top < 12 + window.scrollY) top = 12 + window.scrollY
    } else {
      top = rect.bottom + window.scrollY + 8
    }

    return { position: 'fixed', top: `${Math.round(top)}px`, left: `${Math.round(left)}px`, width: `${popWidth}px`, zIndex: 999999 }
  }

  function toggleServicesPopover() {
    if (showServicesPopover) {
      setShowServicesPopover(false)
      return
    }
    setPopoverStyle(computePopoverStyle())
    setShowServicesPopover(true)
  }

  useEffect(() => {
    if (!showServicesPopover) return
    const update = () => setPopoverStyle(computePopoverStyle())
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, { passive: true })
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update)
    }
  }, [showServicesPopover])

  useEffect(() => {
    fetchServices()
  }, [])

  useEffect(() => {
    if (!showServicesPopover) return
    const onDoc = (e) => {
      if (!e.target.closest('.services-status-badge') && !e.target.closest('.services-popover')) {
        setShowServicesPopover(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [showServicesPopover])

  const fetchServices = async () => {
    try {
      const token = localStorage.getItem('ghassicloud-token')
      const res = await fetch('/api/services', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        logger.debug('[DEBUG] fetchServices fetched:', data.length, data.map(s => s.id))
        window.__FETCHED_SERVICES = data
        let finalList = data
        if (Array.isArray(data) && data.length > 0 && data.length < defaultServices.length) {
          const existingIds = new Set(data.map(s => s.id))
          const missingDefaults = defaultServices.filter(d => !existingIds.has(d.id))
          finalList = [...data, ...missingDefaults]
          logger.debug('[DEBUG] fetchServices merged with defaults:', finalList.map(s => s.id))
        }
        setServicesAndRef(finalList.length > 0 ? finalList : defaultServices)
        fetchServicesOnline()
      } else {
        setServicesAndRef(defaultServices)
      }
    } catch (err) {
      logger.error('Failed to fetch services:', err)
      setServicesAndRef(defaultServices)
    } finally {
      setLoading(false)
    }
  }

  const filteredServices = services.filter(service =>
    (service.name || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
    (service.description || '').toLowerCase().includes((searchQuery || '').toLowerCase())
  )

  const handleAddService = async (newService) => {
    try {
      const token = localStorage.getItem('ghassicloud-token')
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newService)
      })
      if (res.ok) {
        const service = await res.json()
        setServicesAndRef(prev => [...prev, service])
        try { fetchServicesOnline() } catch (e) { logger.debug('post-add refresh failed', e) }
      }
    } catch (err) {
      logger.error('Failed to add service:', err)
    }
    setShowAddModal(false)
  }

  const handleDeleteService = async (id) => {
    try {
      const token = localStorage.getItem('ghassicloud-token')
      await fetch(`/api/services/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      setServicesAndRef(prev => prev.filter(s => s.id !== id))
      try { fetchServicesOnline() } catch (e) { logger.debug('post-delete refresh failed', e) }
    } catch (err) {
      logger.error('Failed to delete service:', err)
    }
  }

  const handleEditService = (service) => {
    setEditingService(service)
    setShowEditModal(true)
  }

  const handlePinService = async (id, pinned) => {
    const sortServices = (servicesList) => {
      return [...servicesList].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        return (a.sortOrder || 0) - (b.sortOrder || 0)
      })
    }

    try {
      const token = localStorage.getItem('ghassicloud-token')
      const res = await fetch(`/api/services/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ pinned })
      })
      if (res.ok) {
        const updatedService = await res.json()
        setServicesAndRef(prev => sortServices(prev.map(s => s.id === id ? updatedService : s)))
      } else {
        setServicesAndRef(prev => sortServices(prev.map(s => s.id === id ? { ...s, pinned } : s)))
      }
    } catch (err) {
      logger.error('Failed to pin service:', err)
      setServicesAndRef(prev => sortServices(prev.map(s => s.id === id ? { ...s, pinned } : s)))
    }
  }

  const handleUpdateService = async (updatedService) => {
    try {
      const token = localStorage.getItem('ghassicloud-token')
      const res = await fetch(`/api/services/${updatedService.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updatedService)
      })
      if (res.ok) {
        const service = await res.json()
        setServicesAndRef(prev => prev.map(s => s.id === service.id ? service : s))
        try { fetchServicesOnline() } catch (e) { logger.debug('post-update refresh failed', e) }
      }
    } catch (err) {
      logger.error('Failed to update service:', err)
    }
    setShowEditModal(false)
    setEditingService(null)
  }



  const { t } = useLanguage()
  const { user } = useAuth()
  const { openWebview } = useWebview()

  const getGreeting = (firstName) => {
    const hour = new Date().getHours()
    let slot
    // Night: 22:00 - 05:59, Morning: 06:00 - 11:59, Afternoon: 12:00 - 17:59, Evening: 18:00 - 21:59
    if (hour >= 6 && hour < 12) slot = 'morning'
    else if (hour >= 12 && hour < 18) slot = 'afternoon'
    else if (hour >= 18 && hour < 22) slot = 'evening'
    else slot = 'night'
    const key = `dashboard.greetings.${slot}`
    let greeting = t(key)
    if (!greeting || greeting === key) {
      const fallbacks = {
        morning: 'Good morning',
        afternoon: 'Good afternoon',
        evening: 'Good evening',
        night: 'Good night'
      }
      greeting = fallbacks[slot]
    }
    return firstName ? `${greeting}, ${firstName}!` : greeting
  }

  const greeting = getGreeting(user?.firstName);

  const offlineCount = servicesStatus.offline || 0;
  const statusClass = servicesStatus.total === 0
    ? 'status-neutral'
    : offlineCount === 0
      ? 'status-green'
      : offlineCount >= 3
        ? 'status-red'
        : 'status-orange';

  const musicAccent = (services.find(s => s.url && s.url.includes('music.ghassi.cloud')) || services.find(s => s.icon === 'music'))?.color

  return (
    <div className="dashboard">
      
      {/* Hero Section */}
      <motion.section 
        className="dashboard-hero"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="hero-content">
          <h1>{greeting}</h1>
          <p>{t('general.welcome')}</p>
        </div>
        <div className="hero-widgets">
          {showWeather && <WeatherWidget />}
          <RamadanCountdownCard />
          {!isMobile() && <EventQRCard />}
          <QuickTips />
        </div>
        {isMobile() && (
          <div className="hero-stats">
            <EventQRCard />
          </div>
        )}
      </motion.section>

      {/* Services Section */}
      <section className="services-section">
        <div className="services-header">
          <div className="services-title-row">
            <h2>{t('dashboard.yourServices')}</h2>
            <motion.div
              ref={servicesCardRef}
              className={`services-status-badge ${statusClass}`}
              onClick={toggleServicesPopover}
              role="button"
              tabIndex={0}
              aria-label="Show services details"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <span className="badge-dot"></span>
              <span className="badge-count">{servicesOnlineLoading ? <Loader2 className="ssc-spin" size={14} /> : servicesOnline.value}</span>
              {servicesStatus.total > 0 && (
                <span className="badge-percent">{Math.round((servicesStatus.online / servicesStatus.total) * 100)}%</span>
              )}
              <button
                className="badge-refresh"
                onClick={(e) => { e.stopPropagation(); fetchServicesOnline(); }}
                disabled={servicesOnlineLoading}
                title="Check Now"
              >
                <RefreshCw size={14} />
              </button>
            </motion.div>
          </div>

          {showServicesPopover && createPortal(
            <AnimatePresence>
              <motion.div className="services-popover" style={popoverStyle} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                <div className="popover-list">
                  {servicesRef.current && servicesRef.current.length > 0 ? servicesRef.current.slice().sort((a, b) => {
                    if (a.status === 'offline' && b.status !== 'offline') return -1
                    if (b.status === 'offline' && a.status !== 'offline') return 1
                    return 0
                  }).map(s => (
                    <div className="popover-item" key={s.id}>
                      <span className={`dot ${s.status === 'online' ? 'online' : 'offline'}`}></span>
                      <a className="service-link" href={s.url} target="_blank" rel="noreferrer" onClick={(e) => { e.preventDefault(); if (isPWA() && !isMobile()) { openWebview(s.url, s.name) } else { window.open(s.url, '_blank', 'noopener,noreferrer') } }}>{s.name}</a>
                      <div className="item-actions">
                        <button className="btn-icon" title={t('service.check')} aria-label={t('service.check')} onClick={() => checkSingleService(s)}><RefreshCw size={14} /></button>
                        <a className="btn-icon" href={s.url} target="_blank" rel="noreferrer" title={t('service.open')} onClick={(e) => { e.preventDefault(); if (isPWA() && !isMobile()) { openWebview(s.url, s.name) } else { window.open(s.url, '_blank', 'noopener,noreferrer') } }}><ExternalLink size={14} /></a>
                      </div>
                    </div>
                  )) : <div className="popover-empty">{t('dashboard.noServicesPopover')}</div>}
                  <div className="popover-footer">{t('dashboard.lastChecked')}: {servicesOnlineLoading ? t('dashboard.checking') : (servicesStatus.total ? `${servicesStatus.online}/${servicesStatus.total}` : t('dashboard.never'))}</div>
                </div>
              </motion.div>
            </AnimatePresence>,
            document.body
          )}

          <div className="services-controls">
            <div className="search-box">
              <div className="search-input-wrap">
                <Search className="search-icon" size={18} />
                <input
                  id="search-input"
                  type="text"
                  aria-label="Search services"
                  placeholder={t('dashboard.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="search-clear"
                    aria-label="Clear search"
                    onClick={() => setSearchQuery('')}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
            <div className="view-toggle">
              <button
                className={viewMode === 'grid' ? 'active' : ''}
                onClick={() => setViewMode('grid')}
              >
                <Grid size={18} />
              </button>
              <button
                className={viewMode === 'list' ? 'active' : ''}
                onClick={() => setViewMode('list')}
              >
                <List size={18} />
              </button>
            </div>
            <motion.button
              className="add-service-btn"
              onClick={() => setShowAddModal(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Plus size={20} />
              {t('dashboard.addService')}
            </motion.button>
          </div>
        </div>

        {loading ? (
          <div className="services-loading">
            <div className="loading-spinner" />
            <p>{t('dashboard.loadingServices')}</p>
          </div>
        ) : (
          <motion.div 
            className={`services-grid ${viewMode}`}
            layout
          >
            <AnimatePresence>
              {filteredServices.map((service, index) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  iconMap={iconMap}
                  index={index}
                  viewMode={viewMode}
                  onDelete={() => handleDeleteService(service.id)}
                  onEdit={handleEditService}
                  onPin={handlePinService}
                  onCheck={checkSingleService}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {!loading && filteredServices.length === 0 && (
          <motion.div 
            className="no-services"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Cloud size={64} strokeWidth={1} />
            <h3>{t('dashboard.noServices')}</h3>
            <p>{t('dashboard.addService')} &nbsp;{t('dashboard.getStarted') || ''}</p>
            <button onClick={() => setShowAddModal(true)}>
              <Plus size={20} />
              {t('dashboard.addService')}
            </button>
          </motion.div>
        )}
      </section>

      {/* Add Service Modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddServiceModal
            onClose={() => setShowAddModal(false)}
            onAdd={handleAddService}
            iconMap={iconMap}
          />
        )}
      </AnimatePresence>

      {/* Edit Service Modal */}
      <AnimatePresence>
        {showEditModal && editingService && (
          <EditServiceModal
            service={editingService}
            onClose={() => {
              setShowEditModal(false)
              setEditingService(null)
            }}
            onSave={handleUpdateService}
            iconMap={iconMap}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
