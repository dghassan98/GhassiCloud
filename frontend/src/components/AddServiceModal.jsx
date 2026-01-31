import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Plus, Globe } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'

const iconOptions = [
  'server', 'database', 'cloud', 'storage', 'security',
  'monitor', 'media', 'music', 'documents', 'photos', 'home', 'compute'
]

const colorOptions = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#64748b'
]

export default function AddServiceModal({ onClose, onAdd, iconMap }) {
  const { t } = useLanguage()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    url: '',
    icon: 'cloud',
    color: '#6366f1',
    useFavicon: true
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onAdd({
      ...formData,
      id: Date.now().toString(),
      status: 'online'
    })
  }

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{t('service.addTitle')}</h2>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{t('service.fields.name')}</label>
            <input
              type="text"
              placeholder={t('service.placeholders.name') || 'e.g., Jellyfin'}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>{t('service.fields.description')}</label>
            <input
              type="text"
              placeholder={t('service.placeholders.description') || 'e.g., Media streaming server'}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>{t('service.fields.url')}</label>
            <input
              type="url"
              placeholder={t('service.placeholders.url') || 'https://service.example.com'}
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>{t('service.fields.icon')}</label>
            <div className="icon-mode-toggle">
              <button
                type="button"
                className={`mode-btn ${formData.useFavicon ? 'active' : ''}`}
                onClick={() => setFormData({ ...formData, useFavicon: true })}
              >
                <Globe size={16} />
                {t('service.icon.auto')}
              </button>
              <button
                type="button"
                className={`mode-btn ${!formData.useFavicon ? 'active' : ''}`}
                onClick={() => setFormData({ ...formData, useFavicon: false })}
              >
                {t('service.icon.choose')}
              </button>
            </div>
            {!formData.useFavicon && (
              <div className="icon-selector" style={{ marginTop: '0.75rem' }}>
                {iconOptions.map((icon) => {
                  const Icon = iconMap[icon]
                  return (
                    <button
                      key={icon}
                      type="button"
                      className={`icon-option ${formData.icon === icon ? 'active' : ''}`}
                      onClick={() => setFormData({ ...formData, icon })}
                      style={formData.icon === icon ? {
                        backgroundColor: `${formData.color}20`,
                        borderColor: formData.color,
                        color: formData.color
                      } : {}}
                    >
                      <Icon size={20} />
                    </button>
                  )
                })}
              </div>
            )}
            {formData.useFavicon && formData.url && (() => {
              try {
                const url = new URL(formData.url)
                return (
                  <div className="favicon-preview" style={{ marginTop: '0.75rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('service.fields.preview')}</span>
                    <img
                      src={`${url.origin}/favicon.ico`}
                      alt={t('service.faviconPreview') || 'Favicon preview'}
                      style={{ width: 24, height: 24, marginLeft: '0.5rem' }}
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  </div>
                )
              } catch {
                return null
              }
            })()}
          </div>

          <div className="form-group">
            <label>{t('service.fields.color')}</label>
            <div className="color-selector">
              {colorOptions.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-option ${formData.color === color ? 'active' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setFormData({ ...formData, color })}
                />
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <motion.button
              type="submit"
              className="btn-primary"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Plus size={18} />
              {t('dashboard.addService')}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
