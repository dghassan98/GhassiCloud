import fetch from 'node-fetch'
import logger from '../backend/src/logger.js'

const url = process.argv[2]
if (!url) {
  logger.error('Usage: node check-avatar-url.js <url>')
  process.exit(1)
}

(async () => {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    logger.info('Status:', res.status)
    logger.info('Content-Type:', res.headers.get('content-type'))
    logger.info('Cache-Control:', res.headers.get('cache-control'))
  } catch (err) {
    logger.error('Fetch failed:', err)
  }
})()
