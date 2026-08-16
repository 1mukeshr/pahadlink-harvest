/**
 * Full functionality smoke test against a running API.
 * Temp *@pahadlink.test users are removed after the run.
 * Usage: node scripts/test-full.mjs [API_BASE]
 */
import {
  applyCoupon,
  calcShipping,
  FREE_SHIP_AT,
  SHIPPING_FEE,
  FIRST_ORDER_DISCOUNT,
} from '../shared/coupons.js'
import { resolveUnitPrice, PRODUCT_PRICING } from '../shared/catalog.js'
import {
  MAX_QTY_PER_ITEM_PER_CUSTOMER,
  PASSWORD_MIN_LENGTH,
  ROLE_VALUES,
} from '../shared/constants.js'
import { STOCK_DEFAULTS } from '../shared/inventoryDefaults.js'
import { buildRatingSummary } from '../shared/ratings.js'
import { purgeTestUsers } from './lib/purge-test-users.mjs'

const base = (process.argv[2] || 'http://127.0.0.1:5000/api').replace(/\/$/, '')
const fails = []

function ok(name) {
  console.log('OK', name)
}

function bad(name, msg) {
  fails.push(`${name}: ${msg}`)
  console.log('FAIL', name, msg)
}

async function api(path, opts) {
  const res = await fetch(`${base}${path}`, opts)
  const text = await res.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }
  return { status: res.status, ok: res.ok, body }
}

async function main() {
  // --- shared domain ---
  if (PRODUCT_PRICING.length !== 15) bad('catalog.count', PRODUCT_PRICING.length)
  else ok('catalog.count=15')

  if (!PRODUCT_PRICING.some((p) => p.id === 'pahadi-pichodi')) {
    bad('catalog.pichodi', 'missing pahadi-pichodi')
  } else ok('catalog.pichodi')

  if (!PRODUCT_PRICING.some((p) => p.id === 'aipan-art')) {
    bad('catalog.aipan', 'missing aipan-art')
  } else ok('catalog.aipan')

  if (PRODUCT_PRICING.some((p) => p.id === 'herbal-tea')) {
    bad('catalog.herbal', 'herbal-tea should be removed')
  } else ok('catalog.noHerbalTea')

  const priced = resolveUnitPrice('pahadi-rajma', '1 kg')
  if (!priced || priced.price !== 479) bad('catalog.price', JSON.stringify(priced))
  else ok('catalog.price')

  const c1 = applyCoupon(1000, 'PAHAD15', { isFirstOrder: true })
  if (!c1.ok || c1.discount !== FIRST_ORDER_DISCOUNT) {
    bad('coupon.PAHAD15', JSON.stringify(c1))
  } else ok('coupon.PAHAD15')

  if (applyCoupon(1000, 'PAHAD15', { isFirstOrder: false }).ok) {
    bad('coupon.firstOnly', 'should reject')
  } else ok('coupon.firstOnly')

  if (applyCoupon(400, 'HILL50').ok) bad('coupon.min', 'should reject')
  else ok('coupon.minSubtotal')

  if (calcShipping(498) !== SHIPPING_FEE) bad('ship.fee', String(calcShipping(498)))
  else ok('ship.fee')

  if (calcShipping(200, { isFirstOrder: true }) !== 0) {
    bad('ship.firstFree', String(calcShipping(200, { isFirstOrder: true })))
  } else ok('ship.firstFree')

  if (calcShipping(FREE_SHIP_AT) !== 0) bad('ship.free', String(calcShipping(FREE_SHIP_AT)))
  else ok('ship.free')

  if (MAX_QTY_PER_ITEM_PER_CUSTOMER !== 3) bad('maxQty', String(MAX_QTY_PER_ITEM_PER_CUSTOMER))
  else ok('maxQty')

  if (PASSWORD_MIN_LENGTH !== 6) bad('pwdMin', String(PASSWORD_MIN_LENGTH))
  else ok('pwdMin')

  if (ROLE_VALUES.join(',') !== 'customer,seller,admin') bad('roles', ROLE_VALUES.join(','))
  else ok('roles')

  const sum = buildRatingSummary([{ rating: 5 }, { rating: 4 }, { rating: 0 }])
  if (sum.count !== 2 || sum.average !== 4.5) bad('ratings', JSON.stringify(sum))
  else ok('ratings.summary')

  if (!STOCK_DEFAULTS['pahadi-rajma']) bad('stock.defaults', 'missing')
  else ok('stock.defaults')

  // --- API ---
  const health = await api('/health')
  if (!health.ok || !health.body.ok || !health.body.authReady) {
    bad('api.health', JSON.stringify(health.body))
  } else ok(`api.health mongo=${health.body.mongo} orders=${health.body.ordersReady}`)

  const stock = await api('/orders/stock')
  const catalogIds = new Set(PRODUCT_PRICING.map((p) => p.id))
  const stockItems = Array.isArray(stock.body?.items) ? stock.body.items : []
  const stockOk =
    stock.ok &&
    stockItems.length === PRODUCT_PRICING.length &&
    stockItems.every(
      (row) =>
        catalogIds.has(row.productId) &&
        typeof row.stock === 'number' &&
        Number.isFinite(row.stock)
    )
  if (!stockOk) bad('api.stock', JSON.stringify(stock.body).slice(0, 160))
  else ok('api.stock')

  const coupon = await api('/coupons/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'HILL50', subtotal: 600 }),
  })
  if (coupon.status !== 200 || !coupon.body.ok) bad('api.coupon', JSON.stringify(coupon.body))
  else ok('api.coupon')

  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const email = `full_${stamp}@pahadlink.test`
  const password = 'pass1234'
  let reg = await api('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Full Test', email, password }),
  })
  // If a prior run left this email, sign in instead so order checks still run
  if (reg.status === 409) {
    reg = await api('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password }),
    })
  }
  if ((reg.status !== 201 && reg.status !== 200) || !reg.body.token) {
    bad('api.register', `${reg.status} ${JSON.stringify(reg.body)}`)
  } else ok('api.register')

  const short = await api('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'X',
      email: `short_${stamp}@pahadlink.test`,
      password: '123',
    }),
  })
  if (short.status === 400) ok('api.pwdMin.rejected')
  else bad('api.pwdMin', String(short.status))

  const token = reg.body.token
  const orderBody = {
    customerName: 'Full Test',
    customerEmail: email,
    customerPhone: '9876543210',
    paymentMethod: 'cod',
    shippingAddress: {
      line1: '12 Mall Road, Lane 1',
      city: 'Dehradun',
      state: 'Uttarakhand',
      pincode: '248001',
    },
    items: [{ productId: 'pahadi-rajma', size: '500g', quantity: 1 }],
  }

  const order = await api('/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(orderBody),
  })
  if (order.status !== 201 || !order.body.order) {
    bad('api.order', `${order.status} ${JSON.stringify(order.body).slice(0, 200)}`)
  } else ok(`api.order ${order.body.order.orderNumber || order.body.order.id}`)

  const overQty = await api('/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...orderBody,
      items: [{ productId: 'raw-honey', size: '250g', quantity: 4 }],
    }),
  })
  if (overQty.status >= 400) ok(`api.maxQty.rejected ${overQty.status}`)
  else bad('api.maxQty', 'accepted qty 4')

  const reviews = await api('/reviews/product/pahadi-rajma')
  if (reviews.status !== 200) bad('api.reviews', String(reviews.status))
  else ok('api.reviews.product')

  const recent = await api('/reviews/recent')
  if (recent.status !== 200) bad('api.reviews.recent', String(recent.status))
  else ok('api.reviews.recent')

  const mine = await api('/orders/mine', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (mine.status !== 200 || !Array.isArray(mine.body.orders)) {
    bad('api.orders.mine', JSON.stringify(mine.body).slice(0, 120))
  } else ok(`api.orders.mine count=${mine.body.orders.length}`)

  const contact = await api('/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Smoke',
      email: 'smoke@pahadlink.test',
      message: 'full smoke contact',
    }),
  })
  if (contact.status === 200 || contact.status === 201) ok('api.contact')
  else bad('api.contact', `${contact.status} ${JSON.stringify(contact.body).slice(0, 100)}`)

  try {
    const purged = await purgeTestUsers()
    if (purged) ok(`purged temp users ${purged}`)
  } catch (err) {
    bad('purgeTempUsers', err.message || String(err))
  }

  console.log('---')
  if (fails.length) {
    console.log('FULL_SMOKE_FAILED', fails.length)
    fails.forEach((f) => console.log(' -', f))
    process.exit(1)
  }
  console.log('FULL_SMOKE_PASSED')
}

main().catch(async (err) => {
  try {
    await purgeTestUsers()
  } catch {
    /* ignore */
  }
  console.error('FULL_SMOKE_FAILED', err.message)
  process.exit(1)
})
