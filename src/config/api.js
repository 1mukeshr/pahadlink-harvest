import { setRuntimeFirebaseConfig } from '../lib/firebase'

/**
 * Resolve API base URL + optional Firebase web config for browser calls.
 *
 * Priority (dynamic, not hard-coded tunnels):
 * 1. Local / LAN / Vite DEV → `/api` (Vite proxy → local Express on :5000)
 * 2. Hosted (GitHub Pages, etc.) → healthy URL from runtime-config.json
 * 3. VITE_API_URL (build-time fallback)
 *
 * Firebase config is stored on globalThis so Vite/Rolldown minification
 * cannot collide the getter with React internals.
 */
let runtimeApiUrl = ''

/** localhost, loopback, RFC1918 LAN, and *.local */
export function isLocalOrLanHost(hostname = '') {
  const host = String(hostname || '').trim().toLowerCase()
  if (!host) return false
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1') {
    return true
  }
  if (host.endsWith('.local')) return true
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  return false
}

/** True when the app is opened from this machine or LAN (not GitHub Pages / prod). */
export function isLocalAppHost() {
  if (typeof window === 'undefined') return false
  if (import.meta.env.DEV) return true
  return isLocalOrLanHost(window.location.hostname)
}

/** True when served from GitHub Pages (or similar remote static host). */
export function isHostedStaticApp() {
  if (typeof window === 'undefined') return false
  if (isLocalAppHost()) return false
  const host = window.location.hostname.toLowerCase()
  return /\.github\.io$/i.test(host) || Boolean(import.meta.env.PROD)
}

/** Ephemeral tunnel hosts — never treat as permanent API targets. */
function isEphemeralTunnelUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return (
      host.endsWith('.trycloudflare.com') ||
      host.endsWith('.loca.lt') ||
      host.endsWith('.ngrok-free.app') ||
      host.endsWith('.ngrok.io') ||
      host.endsWith('.ngrok.app')
    )
  } catch {
    return false
  }
}

function normalizeApiUrl(value) {
  return String(value || '')
    .trim()
    .replace(/\/$/, '')
}

function collectApiCandidates(data) {
  const list = []
  const push = (value, { allowEphemeral = false } = {}) => {
    const url = normalizeApiUrl(value)
    if (!url || list.includes(url)) return
    if (!allowEphemeral && isEphemeralTunnelUrl(url)) return
    list.push(url)
  }

  // Primary runtime apiUrl is always allowed (may be a temporary tunnel while Render is down)
  push(data?.apiUrl, { allowEphemeral: true })
  push(import.meta.env.VITE_API_URL, { allowEphemeral: true })
  if (Array.isArray(data?.apiUrls)) {
    data.apiUrls.forEach((value) => push(value, { allowEphemeral: true }))
  }
  return list
}

async function probeApiHealth(apiBase) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 12000)
  try {
    const res = await fetch(`${apiBase}/health?t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      mode: 'cors',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    })
    if (!res.ok) return false
    const data = await res.json().catch(() => null)
    return Boolean(data?.ok || data?.service)
  } catch {
    return false
  } finally {
    window.clearTimeout(timer)
  }
}

async function pickHealthyApiUrl(candidates) {
  if (!candidates.length) return ''
  // Don't block first paint on a sleeping free-tier API — use first URL now,
  // then upgrade if a healthier candidate answers quickly.
  const preferred = candidates[0]
  try {
    const winner = await Promise.race([
      (async () => {
        for (const url of candidates) {
          if (await probeApiHealth(url)) return url
        }
        return preferred
      })(),
      new Promise((resolve) => window.setTimeout(() => resolve(preferred), 2500)),
    ])
    return winner || preferred
  } catch {
    return preferred
  }
}

function pickFirebase(data) {
  if (!data || typeof data !== 'object') return null
  const src = data.firebase && typeof data.firebase === 'object' ? data.firebase : data
  const apiKey = String(src.apiKey || src.VITE_FIREBASE_API_KEY || '').trim()
  const appId = String(src.appId || src.VITE_FIREBASE_APP_ID || '').trim()
  const authDomain = String(
    src.authDomain || src.VITE_FIREBASE_AUTH_DOMAIN || '',
  ).trim()
  const projectId = String(
    src.projectId || src.VITE_FIREBASE_PROJECT_ID || '',
  ).trim()
  if (!apiKey || !appId || !authDomain || !projectId) return null
  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket: String(
      src.storageBucket || src.VITE_FIREBASE_STORAGE_BUCKET || '',
    ).trim(),
    messagingSenderId: String(
      src.messagingSenderId || src.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    ).trim(),
    appId,
    measurementId: String(
      src.measurementId || src.VITE_FIREBASE_MEASUREMENT_ID || '',
    ).trim(),
  }
}

export async function loadRuntimeConfig() {
  if (typeof window === 'undefined') return

  // Local / LAN: always use Vite `/api` proxy — never remote runtime apiUrl
  if (isLocalAppHost()) {
    runtimeApiUrl = ''
    // Still load Firebase from runtime-config if present (Google login on localhost)
    try {
      const base = import.meta.env.BASE_URL || '/'
      const url = new URL('runtime-config.json', window.location.origin + base).toString()
      const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setRuntimeFirebaseConfig(pickFirebase(data))
      }
    } catch {
      // optional; env / firebaseWebConfig still apply
    }
    return
  }

  try {
    const base = import.meta.env.BASE_URL || '/'
    const url = new URL('runtime-config.json', window.location.origin + base).toString()
    const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return
    const data = await res.json()
    const candidates = collectApiCandidates(data)
    runtimeApiUrl = await pickHealthyApiUrl(candidates)
    setRuntimeFirebaseConfig(pickFirebase(data))
  } catch {
    // optional file
  }
}

function detectApiBase() {
  // Localhost / LAN / Vite DEV → always proxy to local API
  if (isLocalAppHost()) return '/api'

  // Hosted: prefer healthy runtime-config URL
  if (runtimeApiUrl) return runtimeApiUrl

  const fromEnv = normalizeApiUrl(import.meta.env.VITE_API_URL)
  if (fromEnv && !isEphemeralTunnelUrl(fromEnv)) return fromEnv

  if (typeof window !== 'undefined' && /\.github\.io$/i.test(window.location.hostname)) {
    return ''
  }

  return '/api'
}

export const getApiBaseUrl = () => detectApiBase()
