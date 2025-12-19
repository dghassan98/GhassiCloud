import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, Search, Grid, List, ExternalLink, 
  Server, Database, Cloud, HardDrive, Shield, 
  Monitor, Film, Music, FileText, Image,
  Home, Cpu, Activity, MoreVertical, Edit2, Trash2, Smartphone
} from 'lucide-react'
import ServiceCard from '../components/ServiceCard'
import StatsCard from '../components/StatsCard'
import AddServiceModal from '../components/AddServiceModal'
import EditServiceModal from '../components/EditServiceModal'
import '../styles/dashboard.css'

// Icon mapping for services
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
}

// Placeholder services - will be loaded from API
const defaultServices = [
  {
    id: '1',
    name: 'Nextcloud',
    description: 'File sync & share',
    url: 'https://nextcloud.com',
    icon: 'cloud',
    color: '#0082c9',
    status: 'online',
    useFavicon: true
  },
  {
    id: '2',
    name: 'Plex',
    description: 'Media streaming',
    url: 'https://plex.tv',
    icon: 'media',
    color: '#e5a00d',
    status: 'online',
    useFavicon: true
  },
  {
    id: '3',
    name: 'Home Assistant',
    description: 'Smart home control',
    url: 'https://home-assistant.io',
    icon: 'home',
    color: '#41bdf5',
    status: 'online',
    useFavicon: true
  },
  {
    id: '4',
    name: 'Portainer',
    description: 'Container management',
    url: 'https://portainer.io',
    icon: 'server',
    color: '#13b9fd',
    status: 'online',
    useFavicon: true
  },
  {
    id: '5',
    name: 'Grafana',
    description: 'Metrics & dashboards',
    url: 'https://grafana.com',
    icon: 'monitor',
    color: '#f46800',
    status: 'warning',
    useFavicon: true
  },
  {
    id: '6',
    name: 'Pi-hole',
    description: 'Network-wide ad blocking',
    url: 'https://pi-hole.net',
    icon: 'security',
    color: '#96060c',
    status: 'online',
    useFavicon: true
  },
  {
    id: '7',
    name: 'Jellyfin',
    description: 'Free media system',
    url: 'https://jellyfin.org',
    icon: 'media',
    color: '#00a4dc',
    status: 'offline',
    useFavicon: true
  },
  {
    id: '8',
    name: 'GitHub',
    description: 'Code repository',
    url: 'https://github.com',
    icon: 'documents',
    color: '#171515',
    status: 'online',
    useFavicon: true
  }
]

// Placeholder stats
const defaultStats = [
  { label: 'Services Online', value: '7/8', trend: 'up', change: '+1' },
  { label: 'CPU Usage', value: '34%', trend: 'down', change: '-5%' },
  { label: 'Memory', value: '12.4 GB', trend: 'up', change: '+2.1 GB' },
  { label: 'Storage', value: '2.4 TB', trend: 'neutral', change: '78% used' }
]

export default function Dashboard() {
  const [services, setServices] = useState([])
  const [stats, setStats] = useState(defaultStats)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState('grid')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingService, setEditingService] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchServices()
  }, [])

  const fetchServices = async () => {
    try {
      const token = localStorage.getItem('ghassicloud-token')
      const res = await fetch('/api/services', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setServices(data.length > 0 ? data : defaultServices)
      } else {
        setServices(defaultServices)
      }
    } catch (err) {
      console.error('Failed to fetch services:', err)
      setServices(defaultServices)
    } finally {
      setLoading(false)
    }
  }

  const filteredServices = services.filter(service =>
    service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    service.description.toLowerCase().includes(searchQuery.toLowerCase())
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
        setServices([...services, service])
      }
    } catch (err) {
      console.error('Failed to add service:', err)
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
      setServices(services.filter(s => s.id !== id))
    } catch (err) {
      console.error('Failed to delete service:', err)
    }
  }

  const handleEditService = (service) => {
    setEditingService(service)
    setShowEditModal(true)
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
        setServices(services.map(s => s.id === service.id ? service : s))
      }
    } catch (err) {
      console.error('Failed to update service:', err)
    }
    setShowEditModal(false)
    setEditingService(null)
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    const locale = navigator.language || 'en'
    const lang = locale.split('-')[0]
    
    const greetings = {
      en: ['Good morning', 'Good afternoon', 'Good evening', 'Good night'],
      es: ['Buenos días', 'Buenas tardes', 'Buenas tardes', 'Buenas noches'],
      fr: ['Bonjour', 'Bon après-midi', 'Bonsoir', 'Bonne nuit'],
      de: ['Guten Morgen', 'Guten Tag', 'Guten Abend', 'Gute Nacht'],
      it: ['Buongiorno', 'Buon pomeriggio', 'Buonasera', 'Buonanotte'],
      pt: ['Bom dia', 'Boa tarde', 'Boa noite', 'Boa noite'],
      nl: ['Goedemorgen', 'Goedemiddag', 'Goedenavond', 'Goedenacht'],
      ar: ['صباح الخير', 'مساء الخير', 'مساء الخير', 'تصبح على خير'],
      zh: ['早上好', '下午好', '晚上好', '晚安'],
      ja: ['おはようございます', 'こんにちは', 'こんばんは', 'おやすみなさい'],
      ko: ['좋은 아침이에요', '좋은 오후에요', '좋은 저녁이에요', '좋은 밤이에요'],
      ru: ['Доброе утро', 'Добрый день', 'Добрый вечер', 'Доброй ночи'],
      hi: ['सुप्रभात', 'नमस्ते', 'शुभ संध्या', 'शुभ रात्रि'],
      tr: ['Günaydın', 'İyi günler', 'İyi akşamlar', 'İyi geceler']
    }
    
    const msgs = greetings[lang] || greetings.en
    
    if (hour < 12) return msgs[0]
    if (hour < 18) return msgs[1]
    if (hour < 22) return msgs[2]
    return msgs[3]
  }

  return (
    <div className="dashboard">
      <a href="https://ghassi.cloud" target="_blank" rel="noopener noreferrer" className="qr-code-widget">
        <img 
          src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=https://ghassi.cloud&bgcolor=1a1f2e&color=ffffff" 
          alt="Scan to open mobile app"
        />
        <div className="qr-code-text">
          <Smartphone size={14} />
          <span>Scan me</span>
        </div>
      </a>
      
      {/* Hero Section */}
      <motion.section 
        className="dashboard-hero"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="hero-content">
          <h1>{getGreeting()}</h1>
          <p>Welcome to GhassiCloud. Embrace Digital Sovereignty.</p>
        </div>
        <div className="hero-stats">
          {stats.map((stat, i) => (
            <StatsCard key={i} {...stat} index={i} />
          ))}
        </div>
      </motion.section>

      {/* Services Section */}
      <section className="services-section">
        <div className="services-header">
          <h2>Your Services</h2>
          <div className="services-controls">
            <div className="search-box">
              <Search size={18} />
              <input
                type="text"
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
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
              Add Service
            </motion.button>
          </div>
        </div>

        {loading ? (
          <div className="services-loading">
            <div className="loading-spinner" />
            <p>Loading services...</p>
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
            <h3>No services found</h3>
            <p>Add your first service to get started</p>
            <button onClick={() => setShowAddModal(true)}>
              <Plus size={20} />
              Add Service
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
  )
}
