import { useEffect, useState, useRef } from 'react';
import { RefreshCw, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';

export default function ServicesStatusCard({ token }) {
  const { t } = useLanguage()
  const [status, setStatus] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);
  const [error, setError] = useState(null);
  const intervalRef = useRef();

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/services/status/ping', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to check status');
      const data = await res.json();
      setStatus(data.services);
      setLastChecked(data.checkedAt);
    } catch (err) {
      setError('Could not check services');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, 5 * 60 * 1000); // 5 min
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line
  }, []);

  return (
    <motion.div className="services-status-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="ssc-header">
        <span>{t('dashboard.servicesOnline')}</span>
        <button className="ssc-refresh" onClick={fetchStatus} disabled={loading} title="Check Now">
          {loading ? (
            <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
              <Loader2 size={18} className="ssc-spin" />
            </motion.span>
          ) : (
            <RefreshCw size={18} />
          )}
        </button>
      </div>
      <div className="ssc-status-list">
        {loading && status.length === 0 ? (
          <div className="ssc-loading" aria-hidden>
            <div className="loading-spinner" />
          </div>
        ) : (
          <AnimatePresence>
            {status.length > 0 && status.map(s => (
              <motion.div key={s.id} className="ssc-status-item" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {s.online ? <CheckCircle2 color="#22c55e" size={16} /> : <XCircle color="#ef4444" size={16} />}
                <span className="ssc-name">{s.name}</span>
                <span className={`ssc-dot ${s.online ? 'online' : 'offline'}`}></span>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        {error && <div className="ssc-error">{error}</div>}
      </div>
      <div className="ssc-footer">
        <span>{t('dashboard.lastChecked')}: {lastChecked ? new Date(lastChecked).toLocaleTimeString() : t('dashboard.never')}</span>
      </div>
    </motion.div>
  );
}