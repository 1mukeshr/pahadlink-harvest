import api from './api'
import { resolveProductImage } from '../data/siteData'

/** Customer-facing labels */
export const STATUS_LABELS = {
  pending: 'Order Placed',
  confirmed: 'Confirmed',
  processing: 'Packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

/**
 * Delivery tracker steps:
 * Order Placed → Confirmed → Packed → Shipped → Out for delivery → Delivered
 */
const DELIVERY_FLOW_STEPS = [
  {
    key: 'pending',
    label: 'Order Placed',
    shortLabel: 'Placed',
    hint: 'Your order has been placed',
    matchStatuses: ['pending'],
  },
  {
    key: 'confirmed',
    label: 'Confirmed',
    shortLabel: 'Confirmed',
    hint: 'Your order is confirmed',
    matchStatuses: ['confirmed'],
  },
  {
    key: 'processing',
    label: 'Packed',
    shortLabel: 'Packed',
    hint: 'Your item has been packed',
    matchStatuses: ['processing'],
  },
  {
    key: 'shipped',
    label: 'Shipped',
    shortLabel: 'Shipped',
    hint: 'Package is on the way',
    matchStatuses: ['shipped'],
  },
  {
    key: 'out_for_delivery',
    label: 'Out for delivery',
    shortLabel: 'Out for delivery',
    hint: 'Arriving today',
    matchStatuses: ['out_for_delivery'],
  },
  {
    key: 'delivered',
    label: 'Delivered',
    shortLabel: 'Delivered',
    hint: 'Package delivered',
    matchStatuses: ['delivered'],
  },
]

/** Map internal status → tracker index */
const DELIVERY_FLOW_INDEX = {
  pending: 0,
  confirmed: 1,
  processing: 2,
  shipped: 3,
  out_for_delivery: 4,
  delivered: 5,
  cancelled: -1,
}

const PAYMENT_STATUS_LABELS = {
  pending: 'Pending',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
}

/** Customer-facing payment copy (COD-aware) */
export function paymentStatusLabel(order) {
  const method = String(order?.payment || order?.paymentMethod || '').toLowerCase()
  const pay = String(order?.paymentStatus || 'pending').toLowerCase()
  if (method === 'cod' || method === 'cash on delivery') {
    if (pay === 'paid') return 'Paid · Cash on delivery'
    if (pay === 'refunded') return 'Refunded'
    if (order?.status === 'delivered') return 'Paid · Cash on delivery'
    if (order?.status === 'out_for_delivery' || order?.status === 'shipped') {
      return 'Pay on delivery · Due'
    }
    return 'Pay on delivery'
  }
  return PAYMENT_STATUS_LABELS[pay] || pay
}

/**
 * Build PahadLink delivery activity from live timeline + current status.
 * Always returns every delivery step so the tracker can show full progress
 * (past filled, current active, upcoming muted).
 */
export function buildDeliveryActivity(order) {
  if (!order) return []
  const status = String(order.status || 'pending').toLowerCase()
  if (status === 'cancelled') {
    const events = Array.isArray(order.timeline) ? order.timeline : []
    const cancel = events.find((e) => e.status === 'cancelled')
    return [
      {
        status: 'cancelled',
        label: STATUS_LABELS.cancelled,
        note: cancel?.note || 'Order cancelled',
        at: cancel?.at || order.updatedAt || order.createdAt,
        isPast: true,
        isCurrent: true,
        isUpcoming: false,
      },
    ]
  }

  const apiEvents = (Array.isArray(order.timeline) ? order.timeline : [])
    .filter((e) => e && e.status)
    .slice()
    .sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0))

  const byStatus = new Map()
  for (const ev of apiEvents) {
    byStatus.set(String(ev.status).toLowerCase(), ev)
  }

  let currentIdx = DELIVERY_FLOW_INDEX[status]
  if (currentIdx == null || currentIdx < 0) currentIdx = 0

  const built = DELIVERY_FLOW_STEPS.map((step, i) => {
    const matches = step.matchStatuses || [step.key]
    let hit = null
    for (const key of matches) {
      const found = byStatus.get(key)
      if (found) {
        hit = found
        break
      }
    }
    const isPast = i < currentIdx
    const isCurrent = i === currentIdx
    const isUpcoming = i > currentIdx
    let at = hit?.at || null
    if (!at && i === 0) at = order.createdAt || null
    if (!at && isCurrent) at = order.updatedAt || order.createdAt || null
    return {
      status: step.key,
      label: step.label,
      hint: step.hint,
      note: hit?.note || step.hint || STATUS_LABELS[step.key],
      at,
      isPast,
      isCurrent,
      isUpcoming,
    }
  })

  return built
}

/** Normalize API order into the shape used by customer Orders UI */
export function mapApiOrderToUi(order) {
  if (!order) return null
  const addr = order.shippingAddress || {}
  return {
    id: order.orderNumber || order.id,
    apiId: order.id,
    payment: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    total: order.totalAmount,
    shipping: order.shippingFee,
    discount: order.discountAmount,
    couponCode: order.couponCode || '',
    taxableValue: order.taxableValue,
    gstRate: order.gstRate,
    gstAmount: order.gstAmount,
    cgstAmount: order.cgstAmount,
    sgstAmount: order.sgstAmount,
    igstAmount: order.igstAmount,
    gstType: order.gstType,
    pricesIncludeGst: order.pricesIncludeGst === true,
    itemCount: (order.items || []).reduce((s, i) => s + (i.quantity || 1), 0),
    items: (order.items || []).map((item) => {
      const productId = item.productId || ''
      const mapped = {
        id: productId || item.name,
        productId,
        name: item.name,
        qty: item.quantity || 1,
        price: item.price,
        size: item.size,
      }
      mapped.image = resolveProductImage(mapped)
      return mapped
    }),
    email: order.customerEmail,
    userEmail: order.customerEmail,
    userId: order.user,
    name: order.customerName,
    phone: order.customerPhone,
    city: addr.city,
    state: addr.state,
    pincode: addr.pincode,
    address: addr.line1,
    notes: order.notes,
    trackingNumber: order.trackingNumber,
    courier: order.courier,
    status: order.status,
    statusLabel: STATUS_LABELS[order.status] || order.status,
    review: order.review,
    timeline: order.timeline || [],
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  }
}

export async function fetchMyOrders() {
  const { data } = await api.get('/orders/mine')
  return (data.orders || []).map(mapApiOrderToUi)
}

export async function fetchOrders(params = {}) {
  const { data } = await api.get('/orders', { params })
  return data.orders
}

export async function fetchOrderStats(params = {}) {
  const { data } = await api.get('/orders/stats', { params })
  return data
}

export async function fetchInventory() {
  const { data } = await api.get('/orders/inventory')
  return data.items
}

/** Admin: update product stock (optional size) */
export async function updateInventoryStock(productId, { stock, size } = {}) {
  const { data } = await api.put(`/orders/inventory/${encodeURIComponent(productId)}`, {
    stock,
    ...(size ? { size } : null),
  })
  return data
}

/** Public storefront stock levels */
export async function fetchStockLevels() {
  const { data } = await api.get('/orders/stock')
  return data.items || []
}

export async function createOrder(payload) {
  const { data } = await api.post('/orders', payload)
  return data.order
}

export async function validateCoupon({ code, subtotal, email }) {
  const { data } = await api.post('/coupons/validate', {
    code,
    subtotal,
    email,
  })
  return data
}

/** True for every customer until they place a non-cancelled order */
export async function fetchFirstOrderStatus(email = '') {
  const { data } = await api.get('/coupons/first-order', {
    params: email ? { email } : undefined,
  })
  return Boolean(data?.isFirstOrder)
}

export async function updateOrder(id, payload) {
  const { data } = await api.patch(`/orders/${id}`, payload)
  return data
}
