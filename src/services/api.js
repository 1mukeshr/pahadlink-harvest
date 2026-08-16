import axios from 'axios'
import {
  getApiBaseUrl,
  isHostedStaticApp,
  isLocalAppHost,
  STORAGE,
  getAuthScopeFromWindow,
} from '../config'

const hosted = typeof window !== 'undefined' && isHostedStaticApp()
const local = typeof window !== 'undefined' && isLocalAppHost()

const api = axios.create({
  headers: { 'Content-Type': 'application/json' },
  // Free hosts (Render) can take ~30–50s to wake after sleep
  timeout: hosted ? 60000 : 20000,
})

function keysForScope(scope) {
  return scope === 'ops'
    ? { token: STORAGE.OPS_TOKEN, user: STORAGE.OPS_USER }
    : { token: STORAGE.TOKEN, user: STORAGE.USER }
}

function readToken(scope) {
  const keys = keysForScope(scope)
  return localStorage.getItem(keys.token) || sessionStorage.getItem(keys.token)
}

function clearAuthStorage(scope) {
  const keys = keysForScope(scope)
  localStorage.removeItem(keys.token)
  localStorage.removeItem(keys.user)
  sessionStorage.removeItem(keys.token)
  sessionStorage.removeItem(keys.user)
}

api.interceptors.request.use((config) => {
  const baseURL = getApiBaseUrl()
  if (!baseURL) {
    return Promise.reject(
      new Error(
        'API URL is not configured. Set public/runtime-config.json apiUrl (or VITE_API_URL) and redeploy.'
      )
    )
  }
  config.baseURL = baseURL
  config.headers = config.headers || {}

  // Allow callers (e.g. fetchMe during dual-session boot) to set Authorization.
  if (!config.headers.Authorization) {
    const scope = getAuthScopeFromWindow()
    const token = readToken(scope)
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = 'Something went wrong'
    const status = error.response?.status
    const apiHost = getApiBaseUrl()
    const reqUrl = String(error.config?.url || '')
    const isCredentialAttempt =
      /\/auth\/(login|register|google|forgot-password|reset-password)/i.test(reqUrl)

    if (error.message && !error.response && error.message.includes('API URL is not configured')) {
      message = error.message
    } else if (!error.response) {
      if (local) {
        message =
          'Cannot reach local API. Keep MongoDB on and run: npm start (or npm run server).'
      } else if (hosted) {
        message =
          apiHost
            ? `GitHub Pages cannot reach API (${apiHost}). Render may be stopped — open Render Dashboard and start pahadlink-api, then retry.`
            : 'GitHub Pages API URL missing. Set public/runtime-config.json apiUrl and redeploy Pages.'
      } else {
        message = 'Cannot reach server. Start API with: npm run server'
      }
    } else if (status === 502 || status === 503 || status === 504) {
      if (local) {
        message = 'Local API not ready. Keep MongoDB on and run: npm run server'
      } else if (hosted) {
        message =
          'Hosted API is waking up. Wait ~30s and try again (Render free tier sleeps).'
      } else {
        message = 'API not running. Keep MongoDB on and run: npm run server'
      }
    } else if (status === 404 && hosted) {
      message =
        'Hosted API URL not found (404). Redeploy pahadlink-api on Render from pahadlink-harvest, then update runtime-config.json if the service URL changed.'
    } else if (status === 405 && hosted) {
      message =
        'API URL missing in this build. Set public/runtime-config.json apiUrl (or VITE_API_URL) and redeploy.'
    } else if (error.response.data?.message) {
      message = error.response.data.message
    } else if (typeof error.response.data === 'object' && error.response.data?.ok === false) {
      message = error.response.data.message || 'Invalid coupon'
    } else if (error.message) {
      message = error.message
    }

    // Drop stale sessions only on 401 (invalid/expired token).
    // Do NOT clear on 403 — that is often "wrong role" on an otherwise valid session.
    const scope = getAuthScopeFromWindow()
    if (status === 401 && !isCredentialAttempt && readToken(scope)) {
      clearAuthStorage(scope)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('pahadlink:auth-expired', {
            detail: { status, scope },
          })
        )
      }
    }

    const err = new Error(message)
    err.status = status
    return Promise.reject(err)
  }
)

export default api
