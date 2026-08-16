import api from './api'
import { getApiBaseUrl, isLocalAppHost } from '../config'

/**
 * Confirm API + auth store (Mongo preferred) are ready before register/login.
 */
async function ensureAuthApiReady() {
  const base = getApiBaseUrl()
  if (!base) {
    throw new Error(
      'API URL is not configured. Set public/runtime-config.json apiUrl (or VITE_API_URL) and redeploy.'
    )
  }

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 12000)
  try {
    const res = await fetch(`${base}/health?t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      mode: 'cors',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok || !data?.authReady) {
      if (isLocalAppHost()) {
        throw new Error(
          'Database is not ready. Keep MongoDB on and run: npm start (or npm run server).'
        )
      }
      throw new Error(
        'GitHub Pages cannot reach the hosted API. Open Render → start/redeploy pahadlink-api, then confirm /api/health returns ok.'
      )
    }
    // Local shop needs Mongo for checkout/orders — don't let file-store auth fake readiness.
    if (isLocalAppHost() && data.ordersReady === false) {
      throw new Error(
        'MongoDB is not connected. Start MongoDB (npm run db:start), then restart the API.'
      )
    }
    return data
  } catch (err) {
    if (err instanceof Error && /Database is not ready|API URL|hosted API|GitHub Pages/i.test(err.message)) {
      throw err
    }
    if (isLocalAppHost()) {
      throw new Error(
        'Cannot reach local API. Keep MongoDB on and run: npm start (or npm run server).',
        { cause: err }
      )
    }
    throw new Error(
      `GitHub Pages cannot reach API (${base}). Render service may be stopped — redeploy pahadlink-api from the pahadlink-harvest repo.`,
      { cause: err }
    )
  } finally {
    window.clearTimeout(timer)
  }
}

export async function registerUser(payload) {
  await ensureAuthApiReady()
  const { data } = await api.post('/auth/register', {
    name: String(payload.name || '').trim(),
    email: String(payload.email || '').trim().toLowerCase(),
    // Backend creates a unique username from email when omitted
    ...(payload.username
      ? { username: String(payload.username).trim().toLowerCase() }
      : {}),
    password: payload.password,
  })
  if (!data?.token || !data?.user) {
    throw new Error('Registration succeeded but no session was returned. Try signing in.')
  }
  return data
}

export async function loginUser(payload) {
  await ensureAuthApiReady()
  const { data } = await api.post('/auth/login', payload)
  if (!data?.token || !data?.user) {
    throw new Error('Login succeeded but no session was returned. Try again.')
  }
  return data
}

export async function fetchMe(token) {
  const { data } = await api.get('/auth/me', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  return data.user
}

export async function forgotPassword(email) {
  const { data } = await api.post('/auth/forgot-password', { email })
  return data
}

export async function resetPassword(token, password) {
  const { data } = await api.post('/auth/reset-password', { token, password })
  return data
}

export async function googleLogin(idToken) {
  await ensureAuthApiReady()
  const { data } = await api.post('/auth/google', { idToken })
  if (!data?.token || !data?.user) {
    throw new Error(
      'Google sign-in succeeded but no session was returned. Try again.'
    )
  }
  return data
}
