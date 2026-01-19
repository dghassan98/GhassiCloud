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
const supported = ['en','de','fr','es','ru','ar']

const LanguageContext = createContext()

export function LanguageProvider({ children }) {
  const { user, updateUser } = useAuth()
  const [language, setLanguageState] = useState(() => {
    const stored = localStorage.getItem('ghassicloud-lang')
    if (stored && supported.includes(stored)) return stored
    return supported.includes(defaultLang) ? defaultLang : 'en'
  })

  useEffect(() => {
    // If user has language preference from server, prefer it
    if (user?.language && supported.includes(user.language)) {
      setLanguageState(user.language)
    }
  }, [user])

  useEffect(() => {
    localStorage.setItem('ghassicloud-lang', language)
    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
  }, [language])

  const setLanguage = (lang) => {
    if (!supported.includes(lang)) return
    // No-op if language didn't change
    if (lang === language) return
    setLanguageState(lang)
    // Persist to server if user exists and if it's actually different
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

    let node = resolve(key, language)
    if (typeof node === 'string') return node

    // Fallback to English if not found or not a string
    let nodeEn = resolve(key, 'en')
    if (typeof nodeEn === 'string') return nodeEn

    // Try a few common fallbacks (theme -> themeOptions, notifications -> tabs.notifications)
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
