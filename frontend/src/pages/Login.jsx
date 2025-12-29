import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, User, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useLogo } from '../context/LogoContext'
import '../styles/login.css'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ssoLoading, setSsoLoading] = useState(false)
  const { login, loginWithSSO } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { currentLogo } = useLogo()
  const navigate = useNavigate()
  
  const showBrandText = currentLogo.id !== 'cloud-only'
  const isWideLogo = currentLogo.id === 'cloud-only'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      await login(username, password)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSSOLogin = async () => {
    setError('')
    setSsoLoading(true)
    
    try {
      await loginWithSSO()
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setSsoLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* Animated background */}
      <div className="login-bg">
        <div className="gradient-orb orb-1" />
        <div className="gradient-orb orb-2" />
        <div className="gradient-orb orb-3" />
        <div className="grid-overlay" />
      </div>

      <motion.div 
        className="login-container"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Logo & Branding */}
        <motion.div 
          className="login-header"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className={`logo ${isWideLogo ? 'wide' : ''}`}>
            <img src={currentLogo.path} alt="GhassiCloud" />
          </div>
          <AnimatePresence>
            {showBrandText && (
              <motion.h1
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                GhassiCloud
              </motion.h1>
            )}
          </AnimatePresence>
          <p>Embrace Digital Sovereignty.</p>
        </motion.div>

        {/* Login Form */}
        <motion.form 
          className="login-form"
          onSubmit={handleSubmit}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {error && (
            <motion.div 
              className="error-message"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              {error}
            </motion.div>
          )}

          <div className="input-group">
            <User size={20} className="input-icon" />
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div className="input-group">
            <Lock size={20} className="input-icon" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <motion.button
            type="submit"
            className="login-button"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? (
              <div className="button-spinner" />
            ) : (
              <>
                Sign In
                <ArrowRight size={20} />
              </>
            )}
          </motion.button>

          <div className="login-divider">
            <span>or</span>
          </div>

          <motion.button
            type="button"
            className="sso-button"
            disabled={ssoLoading}
            onClick={handleSSOLogin}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {ssoLoading ? (
              <div className="button-spinner" />
            ) : (
              <>
                <img
                  src="https://icons.duckduckgo.com/ip3/ghassandarwish.com.ico"
                  alt="GhassiCloud"
                  className="sso-icon"
                />
                Sign in with GhassiCloud
              </>
            )}
          </motion.button>
        </motion.form>

        {/* Footer */}
        <motion.div 
          className="login-footer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
        </motion.div>
      </motion.div>
    </div>
  )
}
