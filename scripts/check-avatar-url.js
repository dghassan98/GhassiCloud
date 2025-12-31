import fetch from 'node-fetch'

const url = process.argv[2]
if (!url) {
  console.error('Usage: node check-avatar-url.js <url>')
  process.exit(1)
}

(async () => {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    console.log('Status:', res.status)
    console.log('Content-Type:', res.headers.get('content-type'))
    console.log('Cache-Control:', res.headers.get('cache-control'))
  } catch (err) {
    console.error('Fetch failed:', err)
  }
})()
