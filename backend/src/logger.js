import pino from 'pino'

// Always enable pretty logs
const enablePretty = true

let logger
if (enablePretty) {
  const transport = pino.transport({
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  })

  logger = pino(
    {
      level: process.env.LOG_LEVEL || 'info',
      base: null,
      timestamp: pino.stdTimeFunctions.isoTime
    },
    transport
  )
} else {
  logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    base: null,
    timestamp: pino.stdTimeFunctions.isoTime
  })
}

export function setLevel(level) {
  if (!level) return
  logger.level = level
}

export function getLevel() {
  return logger.level
}

export default logger
