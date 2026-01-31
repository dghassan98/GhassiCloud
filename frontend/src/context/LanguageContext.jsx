import React, { createContext, useContext, useEffect, useState } from 'react'
import logger from '../logger'
import en from '../locales/en.json'
import de from '../locales/de.json'
import fr from '../locales/fr.json'
import es from '../locales/es.json'
import ru from '../locales/ru.json'
import ar from '../locales/ar.json'
import { useAuth } from './AuthContext'

const translations = { en, de, fr, es, ru, ar }
const defaultLang = (navigator.language || 'en').split('-')[0]
const supported = ['system', 'en', 'de', 'fr', 'es', 'ru', 'ar']

const LanguageContext = createContext()

export function LanguageProvider({ children }) {
  const { user, updateUser } = useAuth()
  const [language, setLanguageState] = useState(() => {
    const stored = localStorage.getItem('ghassicloud-lang')
    if (stored && supported.includes(stored)) return stored
    return 'system'
  })

  useEffect(() => {
    // If user has language preference from server, prefer it
    if (user?.language && supported.includes(user.language)) {
      setLanguageState(user.language)
    }
  }, [user])

  useEffect(() => {
    try { localStorage.setItem('ghassicloud-lang', language) } catch (e) {}
    const resolved = language === 'system' ? ((navigator.language || 'en').split('-')[0]) : language
    document.documentElement.lang = resolved
    document.documentElement.dir = resolved === 'ar' ? 'rtl' : 'ltr'
  }, [language])

  const setLanguage = (lang) => {
    if (!supported.includes(lang)) return
    if (lang === language) return
    setLanguageState(lang)
    if (user && updateUser && user.language !== lang) {
      try {
        updateUser({ language: lang })
      } catch (e) {
        logger.error('Failed to persist language', e)
      }
    }
  }

  const t = (key) => {
    if (!key) return ''
    const resolve = (k, lang) => {
      const parts = k.split('.')
      let node = translations[lang]
      for (let p of parts) {
        if (!node) break
        node = node[p]
      }
      return node
    }

    const resolvedLang = (language === 'system') ? ((navigator.language || 'en').split('-')[0]) : language
    let node = resolve(key, resolvedLang)
    if (typeof node === 'string') return node

    // Fallback to English if not found or not a string
    let nodeEn = resolve(key, 'en')
    if (typeof nodeEn === 'string') return nodeEn

    const fallbacks = [key.replace('.theme.', '.themeOptions.'), key.replace('.notifications', '.tabs.notifications')]
    for (const alt of fallbacks) {
      if (alt === key) continue
      const altNode = resolve(alt, language)
      if (typeof altNode === 'string') return altNode
      const altNodeEn = resolve(alt, 'en')
      if (typeof altNodeEn === 'string') return altNodeEn
    }

    return key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, supported }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => useContext(LanguageContext)
