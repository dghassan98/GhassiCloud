import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import '../styles/toast.css'

const ToastContext = createContext()

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const showToast = useCallback((options) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 8)
    const toast = {
      id,
      message: typeof options === 'string' ? options : options.message || '',
      title: options?.title || '',
      type: options?.type || 'info', // 'success' | 'error' | 'info'
      duration: options?.duration ?? 4000
    }
    setToasts((s) => [toast, ...s])
    // Auto remove
    if (toast.duration > 0) {
      setTimeout(() => {
        setToasts((s) => s.filter(t => t.id !== id))
      }, toast.duration)
    }
    return id
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((s) => s.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}

      {/* Toast container */}
      <div className="toast-container" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`} role="status">
            {t.title && <div className="toast-title">{t.title}</div>}
            <div className="toast-message">{t.message}</div>
            <button className="toast-close" onClick={() => removeToast(t.id)} aria-label="Close">OK</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
export default ToastContext
