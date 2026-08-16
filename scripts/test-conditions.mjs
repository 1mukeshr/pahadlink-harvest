/**
 * Condition / access-control smoke checks against the running API + shared rules.
 * Uses the single admin test account; temp customer is deleted after the run.
 * Usage: npm run test:conditions
 */
import {
  validateCheckoutForm,
  firstCheckoutErrorField,
  digitsPhone,
  ADDRESS_MIN_LENGTH,
} from '../src/utils/checkoutValidation.js'
import { resolveUnitPrice, PRODUCT_PRICING } from '../shared/catalog.js'
import { STOCK_DEFAULTS } from '../shared/inventoryDefaults.js'
import { purgeTestUsers } from './lib/purge-test-users.mjs'

const fails = []
const ok = (n) => console.log('OK', n)
const bad = (n, m) => {
  fails.push(`${n}: ${m}`)
  console.log('FAIL', n, m)
}

const base = 'http://127.0.0.1:5000/api'

async function api(path, opts = {}) {
  const res = await fetch(`${base}${path}`, opts)
  let body
  try {
    body = await res.json()
  } catch {
    body = null
  }
  return { status: res.status, ok: res.ok, body }
}

// Mirror of src/config routing helpers (Node can't import Vite config aliases)
const ROUTES = {
  HOME: '/',
  ADMIN: '/admin',
  ADMIN_LOGIN: '/admin/login',
  SELLER: '/seller',
  CHECKOUT: '/checkout',
}
const ROLES = { CUSTOMER: 'customer', SELLER: 'seller', ADMIN: 'admin' }

function homePathForRole(user) {
  if (user?.role === ROLES.ADMIN) return ROUTES.ADMIN
  if (user?.role === ROLES.SELLER) return ROUTES.SELLER
  return ROUTES.HOME
}

function isOpsPlatformPath(pathname = '') {
  return (
    pathname === ROUTES.ADMIN ||
    pathname.startsWith(`${ROUTES.ADMIN}/`) ||
    pathname === ROUTES.SELLER ||
    pathname.startsWith(`${ROUTES.SELLER}/`)
  )
}

function isStaffAllowedStorefrontPath(pathname = '') {
  return pathname === '/forgot-password' || pathname === '/reset-password'
}

function resolvePostAuthPath(user, from, intent) {
  const role = user?.role
  const isStaff = role === ROLES.ADMIN || role === ROLES.SELLER
  const dest = typeof from === 'string' ? from : ''
  if (intent === 'checkout' || dest.startsWith(ROUTES.CHECKOUT)) {
    if (isStaff) return homePathForRole(user)
    return ROUTES.HOME
  }
  if (isStaff) {
    if (
      (dest.startsWith(ROUTES.ADMIN) && dest !== ROUTES.ADMIN_LOGIN) ||
      dest.startsWith(ROUTES.SELLER)
    ) {
      return dest
    }
    return homePathForRole(user)
  }
  return dest || ROUTES.HOME
}

{
  const admin = { role: ROLES.ADMIN }
  const seller = { role: ROLES.SELLER }
  const customer = { role: ROLES.CUSTOMER }

  if (homePathForRole(admin) !== ROUTES.ADMIN) bad('home.admin', homePathForRole(admin))
  else ok('home.admin')
  if (homePathForRole(seller) !== ROUTES.SELLER) bad('home.seller', homePathForRole(seller))
  else ok('home.seller')
  if (homePathForRole(customer) !== ROUTES.HOME) bad('home.customer', homePathForRole(customer))
  else ok('home.customer')

  if (resolvePostAuthPath(admin, '/shop') !== ROUTES.ADMIN) {
    bad('postAuth.adminShop', resolvePostAuthPath(admin, '/shop'))
  } else ok('postAuth.adminShop→admin')

  if (resolvePostAuthPath(admin, '/admin/orders') !== '/admin/orders') {
    bad('postAuth.adminOrders', resolvePostAuthPath(admin, '/admin/orders'))
  } else ok('postAuth.adminOrders')

  if (resolvePostAuthPath(customer, '/checkout', 'checkout') !== ROUTES.HOME) {
    bad('postAuth.checkoutIntent', resolvePostAuthPath(customer, '/checkout', 'checkout'))
  } else ok('postAuth.checkoutIntent→home')

  if (resolvePostAuthPath(admin, '/checkout', 'checkout') !== ROUTES.ADMIN) {
    bad('postAuth.adminCheckout', resolvePostAuthPath(admin, '/checkout', 'checkout'))
  } else ok('postAuth.adminCheckout→admin')
}

{
  const cases = [
    ['/admin', true],
    ['/admin/login', true],
    ['/admin/orders', true],
    ['/seller', true],
    ['/', false],
    ['/shop', false],
    ['/account', false],
    ['/login', false],
  ]
  for (const [p, expect] of cases) {
    const got = isOpsPlatformPath(p)
    if (got !== expect) bad(`opsPath.${p}`, `${got}!=${expect}`)
    else ok(`opsPath.${p}=${expect}`)
  }
  if (!isStaffAllowedStorefrontPath('/forgot-password')) bad('staffAllowed.forgot', 'false')
  else ok('staffAllowed.forgot')
  if (isStaffAllowedStorefrontPath('/shop')) bad('staffAllowed.shop', 'true')
  else ok('staffAllowed.shop=false')
}

{
  const empty = validateCheckoutForm({}, '', [])
  if (!empty.name || !empty.phone || !empty.email || !empty.address) {
    bad('checkout.empty', JSON.stringify(empty))
  } else ok('checkout.emptyErrors')

  const good = validateCheckoutForm(
    {
      name: 'Test User',
      phone: '9876543210',
      email: 'test@pahadlink.com',
      address: '12 Mall Road',
      city: 'Dehradun',
      state: 'Uttarakhand',
      pincode: '248001',
    },
    'cod',
    ['cod', 'upi'],
  )
  if (Object.keys(good).length) bad('checkout.valid', JSON.stringify(good))
  else ok('checkout.valid')

  const shortAddr = validateCheckoutForm(
    {
      name: 'Test User',
      phone: '9876543210',
      email: 'test@pahadlink.com',
      address: 'Lane 1',
      city: 'Dehradun',
      state: 'Uttarakhand',
      pincode: '248001',
    },
    'cod',
    ['cod'],
  )
  if (!shortAddr.address) bad('checkout.shortAddress', 'expected address error')
  else ok(`checkout.shortAddress(<${ADDRESS_MIN_LENGTH})`)

  const badPhone = validateCheckoutForm(
    {
      name: 'Test User',
      phone: '12345',
      email: 'test@pahadlink.com',
      address: '12 Mall Road',
      city: 'Dehradun',
      state: 'Uttarakhand',
      pincode: '248001',
    },
    'cod',
    ['cod'],
  )
  if (!badPhone.phone) bad('checkout.phone', 'missing phone error')
  else ok('checkout.badPhone')

  if (digitsPhone('+91 98765-43210') !== '9876543210') {
    bad('digitsPhone', digitsPhone('+91 98765-43210'))
  } else ok('digitsPhone.+91')

  if (digitsPhone('09876543210') !== '9876543210') {
    bad('digitsPhone.0', digitsPhone('09876543210'))
  } else ok('digitsPhone.leading0')

  const first = firstCheckoutErrorField({ email: 'x', phone: 'y', name: 'z' })
  if (first !== 'name') bad('firstErrorField', first)
  else ok('firstErrorField')
}

{
  const stockIds = new Set(Object.keys(STOCK_DEFAULTS))
  const catalogIds = new Set(PRODUCT_PRICING.map((p) => p.id))
  for (const id of catalogIds) {
    if (!stockIds.has(id)) bad('stock.missing', id)
  }
  for (const id of stockIds) {
    if (!catalogIds.has(id)) bad('stock.orphan', id)
  }
  if (!fails.some((f) => f.startsWith('stock.'))) ok('stock↔catalog ids match')

  if (PRODUCT_PRICING.some((p) => p.id === 'herbal-tea')) {
    bad('catalog.herbal', 'herbal-tea still present')
  } else ok('catalog.noHerbalTea')

  if (PRODUCT_PRICING.length !== 15) bad('catalog.count', String(PRODUCT_PRICING.length))
  else ok('catalog.count=15')
}

const adminLogin = await api('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' }),
})
if (!adminLogin.ok || adminLogin.body?.user?.role !== 'admin') {
  bad('api.adminLogin', JSON.stringify(adminLogin.body))
} else ok('api.adminLogin')

const adminToken = adminLogin.body?.token
const stamp = Date.now()
const reg = await api('/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Cond User',
    email: `cond_${stamp}@pahadlink.test`,
    password: 'pass1234',
  }),
})
if (!reg.ok || !reg.body?.token) bad('api.register', JSON.stringify(reg.body))
else ok('api.register')

const custToken = reg.body?.token

const adminInvAsCustomer = await api('/orders/inventory', {
  headers: { Authorization: `Bearer ${custToken}` },
})
if (adminInvAsCustomer.status !== 403) {
  bad('api.customerCannotInventory', String(adminInvAsCustomer.status))
} else ok('api.customer↛inventory (403)')

const adminInvAsAdmin = await api('/orders/inventory', {
  headers: { Authorization: `Bearer ${adminToken}` },
})
if (!adminInvAsAdmin.ok) bad('api.adminInventory', String(adminInvAsAdmin.status))
else ok('api.adminInventory')

const crmAsCustomer = await api('/crm/leads', {
  headers: { Authorization: `Bearer ${custToken}` },
})
if (crmAsCustomer.status !== 403) {
  bad('api.customerCannotCrm', String(crmAsCustomer.status))
} else ok('api.customer↛crm (403)')

const crmAsAdmin = await api('/crm/stats', {
  headers: { Authorization: `Bearer ${adminToken}` },
})
if (!crmAsAdmin.ok) bad('api.adminCrm', String(crmAsAdmin.status))
else ok('api.adminCrm')

const stockPublic = await api('/orders/stock')
if (!stockPublic.ok) bad('api.publicStock', String(stockPublic.status))
else ok('api.publicStock')

const guestOrders = await api('/orders')
if (guestOrders.status !== 401) bad('api.guestOrders', String(guestOrders.status))
else ok('api.guest↛orders (401)')

const product = PRODUCT_PRICING.find((p) => p.id === 'pahadi-rajma') || PRODUCT_PRICING[0]
const unit = resolveUnitPrice(product.id, product.sizes[0])
const order = await api('/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${custToken}`,
  },
  body: JSON.stringify({
    customerName: 'Cond User',
    customerEmail: `cond_${stamp}@pahadlink.test`,
    customerPhone: '9876543210',
    paymentMethod: 'cod',
    shippingAddress: {
      line1: '12 Mall Road, Lane 1',
      city: 'Dehradun',
      state: 'Uttarakhand',
      pincode: '248001',
    },
    items: [
      {
        productId: product.id,
        name: product.name,
        size: product.sizes[0],
        quantity: 1,
        price: unit.price,
      },
    ],
  }),
})
const placed = order.body?.order || order.body
if (!order.ok || !(placed?.orderNumber || placed?.id)) {
  bad('api.placeOrder', JSON.stringify(order.body))
} else ok(`api.placeOrder ${placed.orderNumber || placed.id}`)

const list = await api('/orders', {
  headers: { Authorization: `Bearer ${adminToken}` },
})
if (!list.ok) bad('api.adminListOrders', String(list.status))
else ok('api.adminListOrders')

const orderId = placed?.id || placed?._id
if (orderId) {
  const patch = await api(`/orders/${orderId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${custToken}`,
    },
    body: JSON.stringify({ status: 'confirmed' }),
  })
  if (patch.status !== 403) bad('api.customerCannotPatch', String(patch.status))
  else ok('api.customer↛patchOrder (403)')
} else {
  bad('api.customerCannotPatch', 'missing order id')
}

// +91 phone must normalize & accept on API (same as checkout digitsPhone)
const phone91 = await api('/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${custToken}`,
  },
  body: JSON.stringify({
    customerName: 'Cond User',
    customerEmail: `cond_${stamp}@pahadlink.test`,
    customerPhone: '+91 98765-43210',
    paymentMethod: 'cod',
    shippingAddress: {
      line1: '12 Mall Road, Lane 1',
      city: 'Dehradun',
      state: 'Uttarakhand',
      pincode: '248001',
    },
    items: [
      {
        productId: product.id,
        name: product.name,
        size: product.sizes[0],
        quantity: 1,
        price: unit.price,
      },
    ],
  }),
})
const phone91Order = phone91.body?.order || phone91.body
if (!phone91.ok || phone91Order?.customerPhone !== '9876543210') {
  bad(
    'api.phone91',
    `status=${phone91.status} phone=${phone91Order?.customerPhone} body=${JSON.stringify(phone91.body)}`,
  )
} else ok('api.phone91→9876543210')

// short address must be rejected by API (same rule as checkout UI)
const shortOrder = await api('/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${custToken}`,
  },
  body: JSON.stringify({
    customerName: 'Cond User',
    customerEmail: `cond_${stamp}@pahadlink.test`,
    customerPhone: '9876543210',
    paymentMethod: 'cod',
    shippingAddress: {
      line1: 'Lane 1',
      city: 'Dehradun',
      state: 'Uttarakhand',
      pincode: '248001',
    },
    items: [
      {
        productId: product.id,
        name: product.name,
        size: product.sizes[0],
        quantity: 1,
        price: unit.price,
      },
    ],
  }),
})
if (shortOrder.status !== 400) bad('api.shortAddressRejected', String(shortOrder.status))
else ok('api.shortAddressRejected (400)')

try {
  const purged = await purgeTestUsers()
  if (purged) ok(`purged temp users ${purged}`)
} catch (err) {
  bad('purgeTempUsers', err.message || String(err))
}

console.log('\n' + (fails.length ? `COND_FAILED ${fails.length}` : 'COND_PASSED'))
if (fails.length) {
  for (const f of fails) console.log(' -', f)
  process.exit(1)
}
