import { motion } from 'framer-motion'
import { ExternalLink, MoreVertical, Edit2, Trash2 } from 'lucide-react'
import { useState } from 'react'

// Get favicon URL from a service URL
function getFaviconUrl(url) {
  try {
    const domain = new URL(url).origin
    // Use Google's favicon service as a reliable fallback, or direct favicon
    return `${domain}/favicon.ico`
  } catch {
    return null
  }
}

export default function ServiceCard({ service, iconMap, index, viewMode, onDelete, onEdit }) {
  const [showMenu, setShowMenu] = useState(false)
  const [faviconError, setFaviconError] = useState(false)
  const Icon = iconMap[service.icon] || iconMap.default
  
  const faviconUrl = service.useFavicon !== false ? getFaviconUrl(service.url) : null
  const showFavicon = faviconUrl && !faviconError

  const statusColors = {
    online: '#22c55e',
    offline: '#ef4444',
    warning: '#f59e0b'
  }

  const handleClick = (e) => {
    if (e.target.closest('.card-menu') || e.target.closest('.menu-button')) {
      return
    }
    window.open(service.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <motion.div
      className={`service-card ${viewMode}`}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onClick={handleClick}
      style={{ '--accent-color': service.color }}
    >
      <div className="card-glow" style={{ backgroundColor: service.color }} />
      
      <div className="card-header">
        <div 
          className="service-icon"
          style={{ backgroundColor: `${service.color}20`, color: service.color }}
        >
          {showFavicon ? (
            <img 
              src={faviconUrl}
              alt={`${service.name} icon`}
              onError={() => setFaviconError(true)}
              style={{ 
                width: viewMode === 'list' ? 20 : 24, 
                height: viewMode === 'list' ? 20 : 24,
                objectFit: 'contain'
              }}
            />
          ) : (
            <Icon size={viewMode === 'list' ? 20 : 24} />
          )}
        </div>
        
        <div className="card-actions">
          <div 
            className="status-indicator"
            style={{ backgroundColor: statusColors[service.status] }}
            title={service.status}
          />
          <button 
            className="menu-button"
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
          >
            <MoreVertical size={16} />
          </button>
          
          {showMenu && (
            <motion.div 
              className="card-menu"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <button onClick={(e) => { 
                e.stopPropagation()
                setShowMenu(false)
                onEdit(service)
              }}>
                <Edit2 size={14} />
                Edit
              </button>
              <button 
                className="danger"
                onClick={(e) => { 
                  e.stopPropagation()
                  setShowMenu(false)
                  onDelete()
                }}
              >
                <Trash2 size={14} />
                Delete
              </button>
            </motion.div>
          )}
        </div>
      </div>

      <div className="card-content">
        <h3>{service.name}</h3>
        <p>{service.description}</p>
      </div>

      <div className="card-footer">
        <span className="service-url">{new URL(service.url).hostname}</span>
        <ExternalLink size={14} />
      </div>
    </motion.div>
  )
}
