import { faqsByPage } from '../data/faqData'
import { getOrdersForUser, readOrders } from './ordersStorage'

export const SUPPORT = {
  phoneTel: '+919690421423',
  phoneWa: '919690421423',
  email: 'care@pahadlink.com',
  hoursLabel: 'Mon-Sat, 10:00 AM - 7:00 PM IST',
}

const CHAT_STORAGE_KEY = 'pahadlink_support_chat'

/** Flatten all FAQ entries for matching */
export function getAllFaqs() {
  return Object.values(faqsByPage).flat()
}

function tokenize(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s₹]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
}

/** Score FAQ relevance against a user question */
export function findBestFaq(question) {
  const q = String(question || '').trim().toLowerCase()
  if (!q) return null
  const qTokens = new Set(tokenize(q))
  let best = null
  let bestScore = 0

  for (const faq of getAllFaqs()) {
    const hay = `${faq.q} ${faq.a}`.toLowerCase()
    let score = 0
    if (hay.includes(q) || q.includes(faq.q.toLowerCase().slice(0, 24))) {
      score += 8
    }
    for (const token of qTokens) {
      if (hay.includes(token)) score += 1
    }
    // Boost common intents
    if (/free\s*ship|shipping|deliver/.test(q) && /ship|deliver/.test(hay)) {
      score += 3
    }
    if (/track|order|status/.test(q) && /track|order/.test(hay)) {
      score += 2
    }
    if (score > bestScore) {
      bestScore = score
      best = faq
    }
  }

  return bestScore >= 3 ? best : null
}

/** IST support desk open? Mon–Sat 10:00–19:00 */
export function getSupportAvailability(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now)

  const weekday = parts.find((p) => p.type === 'weekday')?.value || ''
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || 0)
  const mins = hour * 60 + minute
  const isSunday = weekday === 'Sun'
  const open = !isSunday && mins >= 10 * 60 && mins < 19 * 60

  return {
    open,
    label: open ? 'Online now' : 'Away — we reply next business day',
    hoursLabel: SUPPORT.hoursLabel,
  }
}

export function extractOrderId(text = '') {
  const match = String(text)
    .toUpperCase()
    .match(/\b(PL[A-Z0-9]{6,14}|\d{6,12})\b/)
  return match ? match[1] : null
}

export function findOrderForUser(user, text = '') {
  const orderId = extractOrderId(text)
  const list = user ? getOrdersForUser(user) : readOrders()
  if (!list.length) return { orderId, order: null, recent: [] }

  if (orderId) {
    const order =
      list.find(
        (o) =>
          String(o.id || '').toUpperCase() === orderId ||
          String(o.orderNumber || '').toUpperCase() === orderId,
      ) || null
    return { orderId, order, recent: list.slice(0, 3) }
  }

  return { orderId: null, order: null, recent: list.slice(0, 3) }
}

export function formatOrderReply(order) {
  if (!order) return null
  const id = order.id || order.orderNumber || 'your order'
  const status = order.status || order.paymentStatus || 'processing'
  const total =
    order.payable != null
      ? `₹${Number(order.payable).toLocaleString('en-IN')}`
      : order.total != null
        ? `₹${Number(order.total).toLocaleString('en-IN')}`
        : null
  const when = order.createdAt
    ? new Date(order.createdAt).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null

  const bits = [`Order ${id} is currently “${status}”.`]
  if (when) bits.push(`Placed on ${when}.`)
  if (total) bits.push(`Amount ${total}.`)
  bits.push('Need more help? Continue on WhatsApp with this order ID.')
  return bits.join(' ')
}

export function pageGreeting(pathname = '/') {
  if (pathname.startsWith('/checkout')) {
    return 'Need help with checkout, coupons, or delivery? Ask here.'
  }
  if (pathname.startsWith('/product/')) {
    return 'Questions about this product, size, or ingredients? Ask away.'
  }
  if (pathname.startsWith('/orders') || pathname.startsWith('/account')) {
    return 'Need order status or account help? Type your question or order ID.'
  }
  if (pathname.startsWith('/shop') || pathname.startsWith('/category/')) {
    return 'Looking for the right pahadi pick? Ask about shipping, sizes, or products.'
  }
  return 'Hi! Ask about orders, shipping, or products. For a live reply, use WhatsApp.'
}

export function buildWaLink(message) {
  return `https://wa.me/${SUPPORT.phoneWa}?text=${encodeURIComponent(message)}`
}

export function readChatSession() {
  try {
    const raw = sessionStorage.getItem(CHAT_STORAGE_KEY)
    const list = raw ? JSON.parse(raw) : null
    return Array.isArray(list) ? list : null
  } catch {
    return null
  }
}

export function writeChatSession(messages) {
  try {
    sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-40)))
  } catch {
    /* ignore */
  }
}

export function clearChatSession() {
  try {
    sessionStorage.removeItem(CHAT_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
