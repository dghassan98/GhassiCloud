import { useState, useEffect } from 'react'
import '../styles/nowPlaying.css'

export default function NowPlayingCard({ endpoint, accent }) {
  const DEFAULT_ENDPOINT = 'https://music.ghassandarwish.com/rest/getNowPlaying.view?u=root&t=807d88c2a912ca3aed81593b323b6212&s=&v=1.16.&c=app&f=json'
  const url = endpoint || DEFAULT_ENDPOINT
  const [track, setTrack] = useState(null)
  const [loading, setLoading] = useState(true)

  // extract auth/query params from endpoint so we can re-use the same credentials for cover art and controls
  const getAuthQuery = (endpointUrl) => {
    try {
      const u = new URL(endpointUrl)
      // prefer explicit keys but fall back to all params
      const params = new URLSearchParams(u.search)
      const keep = new URLSearchParams()
      const keys = ['u','t','s','c','v','f','u','s']
      keys.forEach(k => { if (params.has(k)) keep.set(k, params.get(k)) })
      if ([...keep.keys()].length === 0) {
        for (const [k,v] of params) keep.set(k, v)
      }
      return keep.toString()
    } catch (e) {
      return ''
    }
  }

  const authQuery = getAuthQuery(url)

  // fetch function pulled out so control handlers can trigger a refresh
  const fetchNowPlaying = async () => {
    try {
      setLoading(true)
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch now playing')
      const data = await res.json()
      const entryRoot = data && data['subsonic-response'] && data['subsonic-response'].nowPlaying && data['subsonic-response'].nowPlaying.entry
      if (!entryRoot) {
        setTrack(null)
        return
      }
      const entry = Array.isArray(entryRoot) ? entryRoot[0] : entryRoot
      setTrack(entry)
    } catch (e) {
      console.warn('NowPlaying fetch error', e)
      setTrack(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    fetchNowPlaying()
    // poll every 8 seconds
    const poll = setInterval(() => { if (mounted) fetchNowPlaying() }, 8000)
    return () => {
      mounted = false
      clearInterval(poll)
    }
  }, [url])

  // We no longer show playback position (read-only endpoint).
  // Compute player-related metadata to display (username removed) and prefer `playerName` field.
  const playerName = track ? (track.playerName || track.player) : null

  const isPlaying = Boolean(track && (
    (typeof track.state === 'string' && track.state.toLowerCase() === 'playing') ||
    track.playing === true ||
    track.isPlaying === true ||
    (typeof track.playState === 'string' && track.playState.toLowerCase() === 'playing')
  ))

  const extraInfo = (() => {
    if (!track) return ''
    const parts = []
    // show source/state/station but omit username (we surface player separately)
    if (track.source) parts.push(track.source)
    if (track.state) parts.push(track.state)
    if (track.station) parts.push(track.station)
    return parts.filter(Boolean).join(' • ')
  })()



  // derive a cover art url that includes the same auth/query params as the nowPlaying endpoint
  const coverUrl = (() => {
    if (!track) return null
    try {
      const base = new URL(url)
      const origin = base.origin
      const id = track.coverArt || track.albumId || track.albumId || track.album || track.id
      if (!id) return null
      const size = 160
      let q = `id=${encodeURIComponent(id)}&size=${size}`
      if (authQuery) q += '&' + authQuery
      return `${origin}/rest/getCoverArt.view?${q}`
    } catch (e) {
      return null
    }
  })()

  // try to detect a server accent color from fetched services if not explicitly passed
  const detectedAccent = (() => {
    if (accent) return accent
    try {
      const u = new URL(url)
      const host = u.hostname
      if (typeof window !== 'undefined' && window.__FETCHED_SERVICES && Array.isArray(window.__FETCHED_SERVICES)) {
        const found = window.__FETCHED_SERVICES.find(s => s.url && s.url.includes(host))
        if (found && found.color) return found.color
      }
    } catch (e) {}
    return '#4fb0ff' // fallback accent (neutral, not Spotify green)
  })()



  return (
    <div className="nowplaying-card" role="region" aria-label="Now playing" style={{ ['--np-accent']: detectedAccent }}>
      <div className="np-art-wrap">
        {coverUrl ? (
          <img src={coverUrl} alt={`${track ? track.album || track.name : 'cover art'}`} className="np-art" />
        ) : (
          <div className="np-art-fallback">🎶</div>
        )}
      </div>
      <div className="np-body">
        <div className="np-meta">
          <div className="np-title" title={track ? track.name : ''}>{track ? track.name : (loading ? 'Loading…' : 'Nothing playing')}</div>
          <div className="np-artist-album">
            <span className="np-artist">{track ? track.artist || track.creator || 'Unknown Artist' : ''}</span>
            {track && track.album && <span className="np-sep">•</span>}
            <span className="np-album">{track ? track.album : ''}</span>
          </div>
        </div>

        <div className="np-info-row">
          <div className={`np-playing-indicator ${track ? 'active' : ''}`} aria-hidden>
            <span className="bar b1" />
            <span className="bar b2" />
            <span className="bar b3" />
          </div>

          {playerName ? (
            <div className="np-player" title={playerName}>{playerName}</div>
          ) : extraInfo ? (
            <div className="np-info">{extraInfo}</div>
          ) : (
            <div className="np-info-placeholder">No player info</div>
          )}
        </div>
      </div>
    </div>
  )
}
