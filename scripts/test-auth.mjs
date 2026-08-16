/**
 * Auth smoke test — uses the single project test account (admin).
 * Usage: node scripts/test-auth.mjs [API_BASE]
 */
import 'dotenv/config'
import { purgeTestUsers } from './lib/purge-test-users.mjs'

const base = (process.argv[2] || 'http://127.0.0.1:5000/api').replace(/\/$/, '')
const username = process.env.ADMIN_USERNAME || 'admin'
const password = process.env.ADMIN_PASSWORD || 'admin123'

async function main() {
  // Clear leftover temporary test users from prior runs
  const purged = await purgeTestUsers()
  if (purged) console.log('OK purged temp users', purged)

  const health = await fetch(`${base}/health`)
  const healthBody = await health.json()
  if (!health.ok || !healthBody.ok) {
    throw new Error(`Health failed: ${health.status} ${JSON.stringify(healthBody)}`)
  }
  console.log('OK health', healthBody.database, healthBody.mongo)

  const loginRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const loginBody = await loginRes.json()
  if (loginRes.status !== 200 || !loginBody.token) {
    throw new Error(`Login failed: ${loginRes.status} ${JSON.stringify(loginBody)}`)
  }
  if (loginBody.user?.role !== 'admin') {
    throw new Error(`Expected admin role, got ${loginBody.user?.role}`)
  }
  console.log('OK login', loginBody.user.username, loginBody.user.role)

  const meRes = await fetch(`${base}/auth/me`, {
    headers: { Authorization: `Bearer ${loginBody.token}` },
  })
  const meBody = await meRes.json()
  if (meRes.status !== 200 || meBody.user?.username !== username) {
    throw new Error(`Me failed: ${meRes.status} ${JSON.stringify(meBody)}`)
  }
  console.log('OK me', meBody.user.id)
  console.log('AUTH_SMOKE_PASSED')
}

main().catch((err) => {
  console.error('AUTH_SMOKE_FAILED', err.message)
  process.exit(1)
})
