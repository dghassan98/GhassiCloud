const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 }
let levelName = import.meta.env?.VITE_LOG_LEVEL || (typeof window !== 'undefined' && window.LOG_LEVEL) || 'info'
let current = LEVELS[levelName] ?? LEVELS.info

const origConsole = {
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  log: console.log.bind(console),
  debug: console.debug ? console.debug.bind(console) : console.log.bind(console)
}

function shouldLog(name) {
  return LEVELS[name] <= current
}

export function setLevel(level) {
  if (!level || !LEVELS.hasOwnProperty(level)) return
  levelName = level
  current = LEVELS[level]
  try { if (typeof window !== 'undefined') window.LOG_LEVEL = level } catch (e) {}
}

export function getLevel() {
  return levelName
}

const logger = {
  error: (...a) => { if (shouldLog('error')) origConsole.error(new Date().toISOString(), ...a) },
  warn:  (...a) => { if (shouldLog('warn'))  origConsole.warn(new Date().toISOString(), ...a) },
  info:  (...a) => { if (shouldLog('info'))  origConsole.log(new Date().toISOString(), ...a) },
  debug: (...a) => { if (shouldLog('debug')) origConsole.debug(new Date().toISOString(), ...a) }
}

export default logger
