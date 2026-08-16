import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const indexHtml = resolve('dist/index.html')
const notFoundHtml = resolve('dist/404.html')
const noJekyll = resolve('dist/.nojekyll')
const runtimeConfig = resolve('dist/runtime-config.json')

if (!existsSync(indexHtml)) {
  console.error('dist/index.html missing - run vite build first')
  process.exit(1)
}

copyFileSync(indexHtml, notFoundHtml)
writeFileSync(noJekyll, '')

// Merge apiUrl + firebase into dist/runtime-config.json for GitHub Pages.
let existing = {}
try {
  if (existsSync(runtimeConfig)) {
    existing = JSON.parse(readFileSync(runtimeConfig, 'utf8')) || {}
  }
} catch {
  existing = {}
}

function normalizeApiUrl(value) {
  return String(value || '')
    .trim()
    .replace(/\/$/, '')
}

const fromFileApi = normalizeApiUrl(existing.apiUrl)
const fromEnvApi = normalizeApiUrl(process.env.VITE_API_URL)
// Allow temporary tunnels in runtime-config while Render is offline
const apiUrl = fromFileApi || fromEnvApi

const apiUrls = Array.isArray(existing.apiUrls)
  ? existing.apiUrls.map(normalizeApiUrl).filter(Boolean)
  : []
if (apiUrl && !apiUrls.includes(apiUrl)) apiUrls.unshift(apiUrl)

const envFirebase = {
  apiKey: (process.env.VITE_FIREBASE_API_KEY || '').trim(),
  authDomain: (process.env.VITE_FIREBASE_AUTH_DOMAIN || '').trim(),
  projectId: (process.env.VITE_FIREBASE_PROJECT_ID || '').trim(),
  storageBucket: (process.env.VITE_FIREBASE_STORAGE_BUCKET || '').trim(),
  messagingSenderId: (process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim(),
  appId: (process.env.VITE_FIREBASE_APP_ID || '').trim(),
  measurementId: (process.env.VITE_FIREBASE_MEASUREMENT_ID || '').trim(),
}

const fileFirebase =
  existing.firebase && typeof existing.firebase === 'object'
    ? existing.firebase
    : null

const firebase =
  fileFirebase?.apiKey && fileFirebase?.appId
    ? fileFirebase
    : envFirebase.apiKey && envFirebase.appId
      ? envFirebase
      : fileFirebase || null

const next = { ...existing }
if (apiUrl) next.apiUrl = apiUrl
if (apiUrls.length) next.apiUrls = apiUrls
else delete next.apiUrls
if (firebase?.apiKey && firebase?.appId) next.firebase = firebase

writeFileSync(runtimeConfig, `${JSON.stringify(next, null, 2)}\n`)

if (apiUrl) {
  console.log(
    `Wrote dist/runtime-config.json apiUrl=${apiUrl} (source=${fromFileApi ? 'runtime-config' : 'VITE_API_URL'})`,
  )
} else {
  console.warn('No apiUrl in runtime-config.json or VITE_API_URL - Pages auth will fail')
}

if (next.firebase?.apiKey && next.firebase?.appId) {
  console.log(
    `Wrote dist/runtime-config.json firebase projectId=${next.firebase.projectId || '(none)'}`,
  )
} else {
  console.warn(
    'No Firebase web config in runtime-config.json or VITE_FIREBASE_* - Google login on Pages will fail',
  )
}

console.log('Created dist/404.html and dist/.nojekyll for GitHub Pages')
