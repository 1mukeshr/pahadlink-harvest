import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import { connectDB, getMongoDbName } from './config/db.js'
import { getAuthStoreMode } from './services/users.js'
import authRoutes from './routes/auth.js'
import orderRoutes from './routes/orders.js'
import couponRoutes from './routes/coupons.js'
import crmRoutes from './routes/crm.js'
import contactRoutes from './routes/contact.js'
import reviewRoutes from './routes/reviews.js'

const app = express()
const PORT = process.env.PORT || 5000

app.set('trust proxy', 1)

const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

function isPrivateLanHostname(hostname = '') {
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

function isAllowedOrigin(origin) {
  if (!origin) return true
  if (allowedOrigins.length === 0) return true
  if (allowedOrigins.includes(origin)) return true
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return true
  // GitHub Pages project + user sites
  if (/^https:\/\/[\w-]+\.github\.io$/i.test(origin)) return true
  // Vercel preview + production
  if (/^https:\/\/[\w.-]+\.vercel\.app$/i.test(origin)) return true
  // Phones / other PCs on the same Wi‑Fi (http://192.168.x.x:5173, etc.)
  try {
    const { hostname, protocol } = new URL(origin)
    if (
      (protocol === 'http:' || protocol === 'https:') &&
      isPrivateLanHostname(hostname)
    ) {
      return true
    }
  } catch {
    // ignore invalid Origin
  }
  return false
}

app.use(
  cors({
    origin: (origin, cb) => {
      if (isAllowedOrigin(origin)) return cb(null, true)
      return cb(new Error(`CORS blocked for origin: ${origin}`))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)
app.use(express.json({ limit: '1mb' }))

function healthPayload() {
  const dbState = mongoose.connection.readyState
  const store = getAuthStoreMode()
  const usingFile = store === 'file'
  const mongoOk = dbState === 1
  const authReady = store === 'mongo' || store === 'file'
  // Service is healthy when auth can run (Mongo or file-store).
  // ordersReady stays false without Mongo so clients know checkout needs Atlas.
  return {
    ok: authReady,
    service: 'pahadlink-api',
    database: mongoOk ? getMongoDbName() : usingFile ? 'file-store' : 'unavailable',
    mongo: mongoOk ? 'connected' : usingFile ? 'file-fallback' : 'disconnected',
    authStore: store,
    ordersReady: mongoOk,
    authReady,
    time: new Date().toISOString(),
  }
}

app.get('/', (_req, res) => {
  res.json(healthPayload())
})

app.get('/api/health', (_req, res) => {
  const payload = healthPayload()
  res.status(payload.ok ? 200 : 503).json(payload)
})

app.use('/api/auth', authRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/coupons', couponRoutes)
app.use('/api/crm', crmRoutes)
app.use('/api/contact', contactRoutes)
app.use('/api/reviews', reviewRoutes)

app.use((err, _req, res, next) => {
  void next
  console.error(err)
  const isCors = String(err.message || '').startsWith('CORS blocked')
  res.status(isCors ? 403 : err.status || 500).json({
    message: err.message || 'Internal server error',
  })
})

async function start() {
  try {
    await connectDB()
    const health = healthPayload()
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`API listening on http://0.0.0.0:${PORT} (all interfaces)`)
      console.log(`  Local:   http://127.0.0.1:${PORT}`)
      console.log(
        `Database: ${health.database} (authReady=${health.authReady}, ordersReady=${health.ordersReady})`,
      )
    })
  } catch (error) {
    console.error('Failed to start server:', error.message)
    console.error(
      'Tip: Local → start MongoDB. Production → set MONGODB_URI (Atlas) on the host.'
    )
    process.exit(1)
  }
}

start()
