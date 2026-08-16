import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  fetchInventory,
  fetchOrders,
  fetchOrderStats,
  STATUS_LABELS,
  updateOrder,
  buildDeliveryActivity,
  paymentStatusLabel,
} from '../services/orderService'
import { getProductById } from '../data/siteData'
import { ROUTES } from '../config'
import { CopyIcon, CheckIcon, PrintIcon, DownloadIcon } from '../components/icons'
import OrderInvoice, { downloadOrderInvoice } from '../components/orders/OrderInvoice'
import AdminLayout from './AdminLayout'
import { useAdminHeaderSearch } from './adminChrome'
import { GST_RATE_PERCENT, splitInclusiveGst, allocateGst } from '../data/gst'
import {
  StatusDonut,
  OrdersBarChart,
  RevenueSparkline,
  HorizontalBars,
  StockHealthBar,
  buildPeriodSeries,
  buildPaymentSeries,
  buildCategorySeries,
  buildTopProductSeries,
  PERIOD_OPTIONS,
  periodChartTitle,
  periodRevenueTitle,
  periodRangeHint,
} from './AdminCharts'

const formatPrice = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

function PeriodSwitch({ period, onChange }) {
  return (
    <div className="admin-period admin-period--panel" role="group" aria-label="Time range">
      {PERIOD_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          className={`admin-period__btn${period === opt.key ? ' is-active' : ''}`}
          onClick={() => onChange(opt.key)}
          aria-pressed={period === opt.key}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

const formatDate = (iso) => {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return '-'
  }
}

/** PahadLink track stamp: Wed, 22 Jul · 2:30 pm */
const formatTrackStamp = (iso) => {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const day = d.toLocaleDateString('en-IN', { weekday: 'short' })
    const date = d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    })
    const time = d.toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    return `${day}, ${date} · ${time}`
  } catch {
    return ''
  }
}

const productTitle = (productId) => {
  const p = getProductById(productId)
  if (!p?.name) return productId
  return p.name.split('|')[0].trim()
}

const productImage = (productId) => getProductById(productId)?.image || ''

const productCategory = (productId) =>
  getProductById(productId)?.categoryName || 'Product'

const paymentMethodLabel = (method) => {
  const map = {
    cod: 'Cash on Delivery',
    upi: 'UPI',
    netbanking: 'Net Banking',
    wallet: 'Wallet',
    razorpay: 'Online',
  }
  const key = String(method || '').toLowerCase()
  return map[key] || (method ? String(method).toUpperCase() : '—')
}

const formatShipLine = (order) => {
  const addr = order?.shippingAddress || {}
  const parts = []
  const push = (value) => {
    const s = String(value || '').trim()
    if (!s) return
    if (parts.join(' ').toLowerCase().includes(s.toLowerCase())) return
    parts.push(s)
  }
  push(addr.line1)
  push(addr.city)
  push(addr.state)
  push(addr.pincode)
  return parts.join(', ')
}

const ADMIN_NEXT = {
  pending: [
    { status: 'confirmed', label: 'Confirm' },
    { status: 'cancelled', label: 'Cancel' },
  ],
  confirmed: [
    { status: 'processing', label: 'Mark packed' },
    { status: 'shipped', label: 'Ship' },
  ],
  processing: [{ status: 'shipped', label: 'Ship' }],
  shipped: [
    { status: 'out_for_delivery', label: 'Out for delivery' },
    { status: 'delivered', label: 'Mark delivered' },
  ],
  out_for_delivery: [{ status: 'delivered', label: 'Mark delivered' }],
  delivered: [],
  cancelled: [],
}

const SELLER_NEXT = {
  pending: [{ status: 'confirmed', label: 'Confirm' }],
  confirmed: [
    { status: 'processing', label: 'Mark packed' },
    { status: 'shipped', label: 'Ship' },
  ],
  processing: [{ status: 'shipped', label: 'Ship' }],
  shipped: [
    { status: 'out_for_delivery', label: 'Out for delivery' },
    { status: 'delivered', label: 'Mark delivered' },
  ],
  out_for_delivery: [{ status: 'delivered', label: 'Mark delivered' }],
}

const STATUS_COLORS = {
  pending: '#b86a12',
  confirmed: '#2f6fa8',
  processing: '#5b6fd4',
  shipped: '#127048',
  out_for_delivery: '#0d8a5a',
  delivered: '#0a4f33',
  cancelled: '#c0394f',
}

const DANGER_STATUSES = new Set(['cancelled'])

export default function OrdersDesk({
  mode = 'admin',
  view = 'full',
  bare = false,
}) {
  const isAdmin = mode === 'admin'
  const showDashboard = view === 'full' || view === 'dashboard'
  const showOrders = view === 'full' || view === 'orders'
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const title =
    view === 'orders'
      ? 'Orders'
      : view === 'dashboard'
        ? 'Dashboard'
        : isAdmin
          ? 'Operations dashboard'
          : 'Sellers'
  const nextMap = isAdmin ? ADMIN_NEXT : SELLER_NEXT

  const [orders, setOrders] = useState([])
  const [allOrders, setAllOrders] = useState([])
  const [stats, setStats] = useState(null)
  const [inventory, setInventory] = useState([])
  const [statusFilter, setStatusFilter] = useState(() =>
    view === 'orders' ? searchParams.get('status') || '' : ''
  )
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [trackDrafts, setTrackDrafts] = useState({})
  const [message, setMessage] = useState('')
  const [copiedId, setCopiedId] = useState('')
  const [orderPage, setOrderPage] = useState(1)
  const [period, setPeriod] = useState('week')
  const [detailOrder, setDetailOrder] = useState(null)
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [invoiceDownloading, setInvoiceDownloading] = useState(false)
  const ORDER_PAGE_SIZE = 8

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 320)
    return () => clearTimeout(t)
  }, [query])

  useAdminHeaderSearch({
    enabled: showOrders,
    placeholder: 'Search order, name, email, tracking',
    value: query,
    onChange: (e) => setQuery(e.target.value),
    onClear: () => {
      setQuery('')
      setDebouncedQuery('')
      setFilter('')
    },
    onSubmit: () => setDebouncedQuery(query.trim()),
    'aria-label': 'Search orders',
  })

  useEffect(() => {
    if (!detailOrder) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (invoiceOpen) setInvoiceOpen(false)
        else setDetailOrder(null)
      }
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [detailOrder, invoiceOpen])

  useEffect(() => {
    if (view !== 'orders') return
    setStatusFilter(searchParams.get('status') || '')
  }, [view, searchParams])

  useEffect(() => {
    setOrderPage(1)
  }, [statusFilter, debouncedQuery, period])

  useEffect(() => {
    if (!message) return undefined
    const t = setTimeout(() => setMessage(''), 2800)
    return () => clearTimeout(t)
  }, [message])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = { period }
      if (statusFilter) params.status = statusFilter
      if (debouncedQuery) params.q = debouncedQuery

      const [list, st, analytics] = await Promise.all([
        fetchOrders(params),
        fetchOrderStats({ period }),
        fetchOrders({ period }),
      ])
      setOrders(list)
      setAllOrders(analytics)
      setStats(st)
      setDetailOrder((prev) => {
        if (!prev) return null
        return (
          analytics.find((o) => o.id === prev.id) ||
          list.find((o) => o.id === prev.id) ||
          null
        )
      })

      if (isAdmin) {
        try {
          setInventory(await fetchInventory())
        } catch {
          setInventory([])
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load operations data')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, debouncedQuery, isAdmin, period])

  useEffect(() => {
    load()
  }, [load])

  const statusOptions = useMemo(() => {
    if (isAdmin) {
      return [
        '',
        'pending',
        'confirmed',
        'processing',
        'shipped',
        'out_for_delivery',
        'delivered',
        'cancelled',
      ]
    }
    return [
      '',
      'pending',
      'confirmed',
      'processing',
      'shipped',
      'out_for_delivery',
      'delivered',
    ]
  }, [isAdmin])

  const chipOptions = useMemo(() => {
    const s = stats || {}
    return statusOptions.map((key) => ({
      key,
      label: key ? STATUS_LABELS[key] || key : 'All',
      count: !key ? s.total || 0 : s[key] || 0,
    }))
  }, [statusOptions, stats])

  const daily = useMemo(
    () => buildPeriodSeries(allOrders, period),
    [allOrders, period]
  )
  const rangeHint = periodRangeHint(period)
  const chartTitle = periodChartTitle(period)
  const revenueTitle = periodRevenueTitle(period)

  const donutSegments = useMemo(() => {
    const s = stats || {}
    const rows = isAdmin
      ? [
          { key: 'pending', label: 'Pending', value: s.pending || 0, color: STATUS_COLORS.pending },
          { key: 'confirmed', label: 'Confirmed', value: s.confirmed || 0, color: STATUS_COLORS.confirmed },
          { key: 'processing', label: 'Packed', value: s.processing || 0, color: STATUS_COLORS.processing },
          { key: 'shipped', label: 'Shipped', value: s.shipped || 0, color: STATUS_COLORS.shipped },
          {
            key: 'out_for_delivery',
            label: 'Out for delivery',
            value: s.out_for_delivery || 0,
            color: STATUS_COLORS.out_for_delivery,
          },
          { key: 'delivered', label: 'Delivered', value: s.delivered || 0, color: STATUS_COLORS.delivered },
          { key: 'cancelled', label: 'Cancelled', value: s.cancelled || 0, color: STATUS_COLORS.cancelled },
        ]
      : [
          { key: 'confirmed', label: 'Confirmed', value: s.confirmed || 0, color: STATUS_COLORS.confirmed },
          { key: 'processing', label: 'Packed', value: s.processing || 0, color: STATUS_COLORS.processing },
          { key: 'shipped', label: 'Shipped', value: s.shipped || 0, color: STATUS_COLORS.shipped },
          {
            key: 'out_for_delivery',
            label: 'Out for delivery',
            value: s.out_for_delivery || 0,
            color: STATUS_COLORS.out_for_delivery,
          },
          { key: 'delivered', label: 'Delivered', value: s.delivered || 0, color: STATUS_COLORS.delivered },
        ]
    return rows
  }, [stats, isAdmin])

  const invStats = useMemo(() => {
    let low = 0
    let out = 0
    for (const item of inventory) {
      if (item.stockBySize) {
        const vals = Object.values(item.stockBySize).map((n) => Number(n) || 0)
        if (vals.length && vals.every((n) => n <= 0)) out += 1
        else if (vals.some((n) => n <= 5)) low += 1
      } else {
        const n = Number(item.stock) || 0
        if (n <= 0) out += 1
        else if (n <= 5) low += 1
      }
    }
    return { total: inventory.length, low, out }
  }, [inventory])

  const lowStock = useMemo(() => {
    const rows = []
    for (const item of inventory) {
      if (item.stockBySize) {
        for (const [size, qty] of Object.entries(item.stockBySize)) {
          if (Number(qty) <= 5) {
            rows.push({
              key: `${item.productId}-${size}`,
              label: `${productTitle(item.productId)} · ${size}`,
              value: Number(qty),
              color: Number(qty) <= 0 ? '#c0394f' : '#b86a12',
            })
          }
        }
      } else if (typeof item.stock === 'number' && item.stock <= 5) {
        rows.push({
          key: item.productId,
          label: productTitle(item.productId),
          value: item.stock,
          color: item.stock <= 0 ? '#c0394f' : '#b86a12',
        })
      }
    }
    return rows.sort((a, b) => a.value - b.value).slice(0, 8)
  }, [inventory])

  const paymentSeries = useMemo(() => {
    const colors = {
      razorpay: '#2f6fa8',
      cod: '#b86a12',
      upi: '#127048',
      other: '#6b8075',
    }
    return buildPaymentSeries(allOrders).map((row) => ({
      ...row,
      color: colors[row.key] || colors.other,
    }))
  }, [allOrders])

  const categorySeries = useMemo(
    () =>
      buildCategorySeries(allOrders, productCategory).map((row, i) => ({
        ...row,
        color: ['#0a4f33', '#127048', '#2f6fa8', '#b86a12', '#5b6fd4', '#c45c3a'][
          i % 6
        ],
      })),
    [allOrders]
  )

  const topProducts = useMemo(
    () =>
      buildTopProductSeries(allOrders, productTitle, 6).map((row, i) => ({
        ...row,
        color: ['#0a4f33', '#127048', '#2f6fa8', '#b86a12', '#5b6fd4', '#c45c3a'][
          i % 6
        ],
      })),
    [allOrders]
  )

  const stockOk = Math.max(0, invStats.total - invStats.low - invStats.out)
  const applyUpdate = async (orderId, payload) => {
    if (DANGER_STATUSES.has(payload.status)) {
      const ok = window.confirm('Cancel this order? This cannot be undone.')
      if (!ok) return
    }
    setBusyId(orderId)
    setMessage('')
    try {
      await updateOrder(orderId, payload)
      setMessage('Order updated')
      await load()
    } catch (err) {
      setMessage(err.message || 'Update failed')
    } finally {
      setBusyId('')
    }
  }

  const copyOrderNumber = async (orderNumber) => {
    try {
      await navigator.clipboard.writeText(orderNumber)
      setCopiedId(orderNumber)
      setTimeout(() => setCopiedId(''), 1600)
    } catch {
      setMessage('Could not copy order number')
    }
  }

  const setFilter = (value) => {
    const next = value && value !== statusFilter ? value : ''
    if (view === 'dashboard' && isAdmin) {
      navigate(
        next
          ? `${ROUTES.ADMIN_ORDERS}?status=${encodeURIComponent(next)}`
          : ROUTES.ADMIN_ORDERS
      )
      return
    }
    if (view === 'orders' && isAdmin) {
      setStatusFilter(next)
      if (next) setSearchParams({ status: next })
      else setSearchParams({})
      return
    }
    setStatusFilter((prev) => (prev === value ? '' : value))
  }

  const weekOrders = daily.reduce((s, d) => s + d.value, 0)
  const weekRevenue = daily.reduce((s, d) => s + d.revenue, 0)
  const needsAction = isAdmin
    ? stats?.pending || 0
    : (stats?.pending || 0) + (stats?.confirmed || 0) + (stats?.processing || 0)

  const orderPageCount = Math.max(1, Math.ceil(orders.length / ORDER_PAGE_SIZE))
  const safeOrderPage = Math.min(orderPage, orderPageCount)
  const orderPageStart = (safeOrderPage - 1) * ORDER_PAGE_SIZE
  const pagedOrders = orders.slice(orderPageStart, orderPageStart + ORDER_PAGE_SIZE)

  const desk = (
    <>
      <div className="admin-desk">
      <header className="admin-head">
        <div className="admin-head__copy">
          <h1>{title}</h1>
        </div>
        {view === 'dashboard' && isAdmin ? (
          <div className="admin-head__actions">
            <button
              type="button"
              className="admin-btn"
              onClick={() => navigate(ROUTES.ADMIN_ORDERS)}
            >
              Manage orders
            </button>
          </div>
        ) : null}
      </header>

      {showDashboard && stats && (
        <div className="admin-kpi" aria-label="Key metrics">
          <button
            type="button"
            className={`admin-kpi__card admin-kpi__card--click${
              !statusFilter ? ' admin-kpi__card--active' : ''
            }`}
            onClick={() => setFilter('')}
          >
            <div className="admin-kpi__top">
              <span>Total orders</span>
            </div>
            <strong>{stats.total}</strong>
            <em>
              {weekOrders} in {rangeHint.toLowerCase()}
            </em>
          </button>
          {isAdmin && (
            <article className="admin-kpi__card admin-kpi__card--accent">
              <div className="admin-kpi__top">
                <span>Paid revenue</span>
              </div>
              <strong>{formatPrice(stats.revenue)}</strong>
              <em>
                {formatPrice(weekRevenue)} · {rangeHint.toLowerCase()}
              </em>
            </article>
          )}
          <button
            type="button"
            className={`admin-kpi__card admin-kpi__card--click admin-kpi__card--warn${
              statusFilter === 'pending' ? ' admin-kpi__card--active' : ''
            }`}
            onClick={() => setFilter('pending')}
          >
            <div className="admin-kpi__top">
              <span>Needs action</span>
            </div>
            <strong>{needsAction}</strong>
            <em>
              {isAdmin
                ? 'Pending orders'
                : 'Pending + confirmed + processing'}
            </em>
          </button>
          <button
            type="button"
            className={`admin-kpi__card admin-kpi__card--click admin-kpi__card--ship${
              statusFilter === 'shipped' || statusFilter === 'out_for_delivery'
                ? ' admin-kpi__card--active'
                : ''
            }`}
            onClick={() => setFilter('shipped')}
          >
            <div className="admin-kpi__top">
              <span>In transit</span>
            </div>
            <strong>
              {(stats.shipped || 0) + (stats.out_for_delivery || 0)}
            </strong>
            <em>
              {stats.out_for_delivery || 0} out for delivery ·{' '}
              {stats.delivered || 0} delivered
            </em>
          </button>
        </div>
      )}

      {showDashboard && (
      <div className="admin-dash admin-dash--graphs">
        <section className="admin-panel-card admin-panel-card--wide">
          <header className="admin-panel-card__head admin-panel-card__head--tools">
            <div className="admin-panel-card__copy">
              <h2>{chartTitle}</h2>
              <p>{rangeHint}</p>
            </div>
            <PeriodSwitch period={period} onChange={setPeriod} />
          </header>
          <OrdersBarChart series={daily} period={period} />
        </section>

        <section className="admin-panel-card admin-panel-card--side">
          <header className="admin-panel-card__head admin-panel-card__head--tools">
            <div className="admin-panel-card__copy">
              <h2>Status</h2>
              <p>{rangeHint} · tap to open orders</p>
            </div>
            <PeriodSwitch period={period} onChange={setPeriod} />
          </header>
          <StatusDonut
            segments={donutSegments}
            size={168}
            onSelect={(key) => setFilter(key)}
          />
        </section>

        {isAdmin && (
          <section className="admin-panel-card admin-panel-card--wide">
            <header className="admin-panel-card__head admin-panel-card__head--tools">
              <div className="admin-panel-card__copy">
                <h2>{revenueTitle}</h2>
                <p>
                  {rangeHint} · total{' '}
                  <strong className="admin-panel-card__inline">
                    {formatPrice(weekRevenue)}
                  </strong>
                </p>
              </div>
              <PeriodSwitch period={period} onChange={setPeriod} />
            </header>
            <RevenueSparkline
              period={period}
              series={daily.map((d) => ({ label: d.label, value: d.revenue }))}
            />
          </section>
        )}

        {isAdmin && (
          <section className="admin-panel-card admin-panel-card--side">
            <header className="admin-panel-card__head admin-panel-card__head--tools">
              <div className="admin-panel-card__copy">
                <h2>Payments</h2>
                <p>{rangeHint} · paid by method</p>
              </div>
              <PeriodSwitch period={period} onChange={setPeriod} />
            </header>
            <HorizontalBars
              rows={paymentSeries}
              valueFormat={formatPrice}
              emptyLabel="No paid orders yet"
              maxItems={5}
            />
          </section>
        )}

        {isAdmin && (
          <section className="admin-panel-card admin-panel-card--third">
            <header className="admin-panel-card__head admin-panel-card__head--tools">
              <div className="admin-panel-card__copy">
                <h2>Categories</h2>
                <p>{rangeHint} · units sold</p>
              </div>
              <PeriodSwitch period={period} onChange={setPeriod} />
            </header>
            <HorizontalBars
              rows={categorySeries}
              valueFormat={(n) => `${n}`}
              emptyLabel="No sales yet"
              maxItems={5}
            />
          </section>
        )}

        {isAdmin && (
          <section className="admin-panel-card admin-panel-card--third">
            <header className="admin-panel-card__head admin-panel-card__head--tools">
              <div className="admin-panel-card__copy">
                <h2>Bestsellers</h2>
                <p>{rangeHint} · by units</p>
              </div>
              <PeriodSwitch period={period} onChange={setPeriod} />
            </header>
            <HorizontalBars
              rows={topProducts}
              valueFormat={(n) => `${n}`}
              emptyLabel="No sales yet"
              maxItems={5}
            />
          </section>
        )}

        {isAdmin && (
          <section className="admin-panel-card admin-panel-card--third">
            <header className="admin-panel-card__head">
              <h2>Stock</h2>
              <p>
                {invStats.low} low · {invStats.out} out
              </p>
            </header>
            <StockHealthBar
              ok={stockOk}
              low={invStats.low}
              out={invStats.out}
            />
            {lowStock.length > 0 && (
              <div className="admin-panel-card__stack">
                <HorizontalBars
                  rows={lowStock}
                  valueFormat={(n) => `${n}`}
                  emptyLabel="Stock looks healthy"
                  maxItems={5}
                />
              </div>
            )}
          </section>
        )}
      </div>
      )}

      {showOrders && (
      <section className="admin-orders-section">
        <div className="admin-filters-row">
          <div className="admin-chips" role="tablist" aria-label="Filter by status">
            {chipOptions.map((chip) => (
              <button
                key={chip.key || 'all'}
                type="button"
                role="tab"
                aria-selected={statusFilter === chip.key}
                className={`admin-chip${statusFilter === chip.key ? ' is-active' : ''}`}
                onClick={() => setFilter(chip.key)}
              >
                {chip.label}
                {stats ? <em>{chip.count}</em> : null}
              </button>
            ))}
          </div>
          <PeriodSwitch period={period} onChange={setPeriod} />
        </div>
        <p className="admin-orders-section__range">{rangeHint}</p>

        {error && <p className="admin-alert">{error}</p>}
        {message && (
          <p
            className={`admin-alert${
              /fail|error|could not/i.test(message) ? '' : ' admin-alert--ok'
            }`}
            role="status"
          >
            {message}
          </p>
        )}

        {loading ? (
          <p className="admin-loading">Loading orders…</p>
        ) : orders.length === 0 ? (
          <p className="admin-empty">No orders match this filter.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Items</th>
                  <th scope="col">Payment</th>
                  <th scope="col">Status</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedOrders.map((order) => {
                  const actions = nextMap[order.status] || []
                  const draft = trackDrafts[order.id] || {
                    trackingNumber: order.trackingNumber || '',
                    courier: order.courier || '',
                  }
                  const showTracking =
                    order.status === 'processing' ||
                    order.status === 'shipped' ||
                    order.status === 'out_for_delivery' ||
                    order.status === 'confirmed'
                  const itemSummary = (order.items || []).slice(0, 2)
                  const extraItems = Math.max(0, (order.items || []).length - 2)
                  const shipLine = formatShipLine(order)
                  const showDetail = showTracking || Boolean(shipLine)

                  return (
                    <Fragment key={order.id}>
                      <tr className="admin-table__row">
                        <td>
                          <div className="admin-card__id">
                            <button
                              type="button"
                              className="admin-card__id-btn"
                              onClick={() => setDetailOrder(order)}
                              title="View order details"
                            >
                              <strong>{order.orderNumber}</strong>
                            </button>
                            <button
                              type="button"
                              className={`admin-card__copy${
                                copiedId === order.orderNumber ? ' is-copied' : ''
                              }`}
                              onClick={() => copyOrderNumber(order.orderNumber)}
                              aria-label={
                                copiedId === order.orderNumber
                                  ? 'Order number copied'
                                  : 'Copy order number'
                              }
                              title={
                                copiedId === order.orderNumber
                                  ? 'Copied'
                                  : 'Copy order number'
                              }
                            >
                              {copiedId === order.orderNumber ? (
                                <CheckIcon size={13} />
                              ) : (
                                <CopyIcon size={13} />
                              )}
                            </button>
                          </div>
                          <span className="admin-table__sub">
                            {formatDate(order.createdAt)}
                          </span>
                        </td>
                        <td>
                          <strong className="admin-table__name">
                            {order.customerName}
                          </strong>
                          <span className="admin-table__sub">
                            {order.customerEmail}
                            {order.customerPhone ? ` · ${order.customerPhone}` : ''}
                          </span>
                        </td>
                        <td>
                          <ul className="admin-card__items">
                            {itemSummary.map((item, idx) => (
                              <li key={`${order.id}-i-${idx}`} title={item.name}>
                                <span>
                                  {item.name}
                                  {item.size ? ` · ${item.size}` : ''}
                                </span>
                                <em>×{item.quantity}</em>
                              </li>
                            ))}
                            {extraItems > 0 && (
                              <li>
                                <button
                                  type="button"
                                  className="admin-card__more"
                                  onClick={() => setDetailOrder(order)}
                                >
                                  +{extraItems} more
                                </button>
                              </li>
                            )}
                          </ul>
                        </td>
                        <td>
                          <span className="admin-table__pay">
                            {order.paymentMethod?.toUpperCase() || '—'}
                          </span>
                          <span className="admin-table__sub">
                            {order.paymentStatus}
                          </span>
                        </td>
                        <td>
                          <span className={`admin-badge admin-badge--${order.status}`}>
                            {STATUS_LABELS[order.status] || order.status}
                          </span>
                        </td>
                        <td className="admin-table__amount">
                          {formatPrice(order.totalAmount)}
                        </td>
                        <td>
                          <div className="admin-card__actions">
                            {isAdmin && order.paymentStatus === 'pending' && (
                              <button
                                type="button"
                                className="admin-btn admin-btn--brand"
                                disabled={busyId === order.id}
                                onClick={() =>
                                  applyUpdate(order.id, { paymentStatus: 'paid' })
                                }
                              >
                                Mark paid
                              </button>
                            )}
                            {actions.map((action) => (
                              <button
                                key={action.status}
                                type="button"
                                className={`admin-btn${
                                  action.status === 'cancelled'
                                    ? ' admin-btn--danger'
                                    : ''
                                }`}
                                disabled={busyId === order.id}
                                onClick={() =>
                                  applyUpdate(order.id, {
                                    status: action.status,
                                    courier: draft.courier || order.courier,
                                    trackingNumber:
                                      draft.trackingNumber || order.trackingNumber,
                                  })
                                }
                              >
                                {action.label}
                              </button>
                            ))}
                            {!actions.length &&
                              !(isAdmin && order.paymentStatus === 'pending') && (
                                <span className="admin-table__muted">—</span>
                              )}
                          </div>
                        </td>
                      </tr>
                      {showDetail && (
                        <tr className="admin-table__detail">
                          <td colSpan={7}>
                            {shipLine && (
                              <p className="admin-card__ship">
                                <span className="admin-card__ship-label">Ship to</span>
                                <span className="admin-card__ship-text">{shipLine}</span>
                              </p>
                            )}
                            {showTracking && (
                              <div className="admin-track">
                                <input
                                  type="text"
                                  placeholder="Courier"
                                  value={draft.courier}
                                  onChange={(e) =>
                                    setTrackDrafts((prev) => ({
                                      ...prev,
                                      [order.id]: {
                                        ...draft,
                                        courier: e.target.value,
                                      },
                                    }))
                                  }
                                />
                                <input
                                  type="text"
                                  placeholder="Tracking #"
                                  value={draft.trackingNumber}
                                  onChange={(e) =>
                                    setTrackDrafts((prev) => ({
                                      ...prev,
                                      [order.id]: {
                                        ...draft,
                                        trackingNumber: e.target.value,
                                      },
                                    }))
                                  }
                                />
                                <button
                                  type="button"
                                  className="admin-btn admin-btn--ghost"
                                  disabled={busyId === order.id}
                                  onClick={() =>
                                    applyUpdate(order.id, {
                                      courier: draft.courier,
                                      trackingNumber: draft.trackingNumber,
                                    })
                                  }
                                >
                                  Save tracking
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
            {orders.length > ORDER_PAGE_SIZE && (
              <div className="admin-pager">
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  disabled={safeOrderPage <= 1}
                  onClick={() => setOrderPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span className="admin-pager__label">
                  Page {safeOrderPage} of {orderPageCount}
                </span>
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  disabled={safeOrderPage >= orderPageCount}
                  onClick={() =>
                    setOrderPage((p) => Math.min(orderPageCount, p + 1))
                  }
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </section>
      )}
      </div>

      {detailOrder && (() => {
        const order = detailOrder
        const actions = nextMap[order.status] || []
        const draft = trackDrafts[order.id] || {
          trackingNumber: order.trackingNumber || '',
          courier: order.courier || '',
        }
        const shipLine = formatShipLine(order)
        const activity = buildDeliveryActivity(order)
        const items = order.items || []
        const itemsTotal =
          Number(order.itemsTotal) ||
          items.reduce(
            (sum, item) =>
              sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
            0
          )
        const shippingFee = Number(order.shippingFee) || 0
        const discount = Number(order.discountAmount) || 0
        const total = Number(order.totalAmount) || itemsTotal + shippingFee - discount
        const shipState = order.shippingAddress?.state || ''
        const gstFallback = (() => {
          const taxableBase = Math.max(0, itemsTotal - discount + shippingFee)
          if (order.pricesIncludeGst === false || order.gstAmount != null) {
            const gstAmount =
              order.gstAmount != null
                ? Number(order.gstAmount)
                : Math.round(taxableBase * (Number(order.gstRate) || 0.05))
            const taxableValue =
              order.taxableValue != null
                ? Number(order.taxableValue)
                : taxableBase
            return {
              taxableValue,
              ...allocateGst(gstAmount, { shippingState: shipState }),
            }
          }
          const split = splitInclusiveGst(total, Number(order.gstRate) || 0.05)
          return {
            taxableValue: split.taxableValue,
            ...allocateGst(split.gstAmount, { shippingState: shipState }),
          }
        })()
        const gstRatePct =
          order.gstRate != null
            ? Math.round(Number(order.gstRate) * 1000) / 10
            : GST_RATE_PERCENT
        const gstType = order.gstType || gstFallback.gstType
        const cgstAmount =
          order.cgstAmount != null
            ? Number(order.cgstAmount)
            : gstFallback.cgstAmount
        const sgstAmount =
          order.sgstAmount != null
            ? Number(order.sgstAmount)
            : gstFallback.sgstAmount
        const igstAmount =
          order.igstAmount != null
            ? Number(order.igstAmount)
            : gstFallback.igstAmount

        return (
          <div
            className="admin-order-popup"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-order-popup-title"
          >
            <button
              type="button"
              className="admin-order-popup__backdrop"
              aria-label="Close order details"
              onClick={() => setDetailOrder(null)}
            />
            <div className="admin-order-popup__panel">
              <header className="admin-order-popup__head">
                <div className="admin-order-popup__head-main">
                  <p className="admin-order-popup__kicker">Order details</p>
                  <div className="admin-order-popup__title-row">
                    <h2 id="admin-order-popup-title">{order.orderNumber}</h2>
                    <button
                      type="button"
                      className={`admin-card__copy${
                        copiedId === order.orderNumber ? ' is-copied' : ''
                      }`}
                      onClick={() => copyOrderNumber(order.orderNumber)}
                      aria-label="Copy order number"
                      title="Copy order number"
                    >
                      {copiedId === order.orderNumber ? (
                        <CheckIcon size={13} />
                      ) : (
                        <CopyIcon size={13} />
                      )}
                    </button>
                  </div>
                  <p className="admin-order-popup__meta">
                    {formatDate(order.createdAt)}
                    <span aria-hidden="true"> · </span>
                    <span className={`admin-badge admin-badge--${order.status}`}>
                      {STATUS_LABELS[order.status] || order.status}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  onClick={() => setDetailOrder(null)}
                >
                  Close
                </button>
              </header>

              <div className="admin-order-popup__grid">
                <section className="admin-order-popup__card">
                  <h3>Customer</h3>
                  <p className="admin-order-popup__name">{order.customerName}</p>
                  <p>{order.customerEmail || '—'}</p>
                  {order.customerPhone ? <p>{order.customerPhone}</p> : null}
                </section>

                <section className="admin-order-popup__card">
                  <h3>Payment</h3>
                  <p className="admin-order-popup__name">
                    {paymentMethodLabel(order.paymentMethod)}
                  </p>
                  <p>{paymentStatusLabel(order)}</p>
                  {order.couponCode ? <p>Coupon {order.couponCode}</p> : null}
                </section>

                <section className="admin-order-popup__card admin-order-popup__card--wide">
                  <h3>Ship to</h3>
                  <p>{shipLine || 'No shipping address'}</p>
                  {(order.courier || order.trackingNumber) && (
                    <p className="admin-order-popup__track">
                      {order.courier ? <strong>{order.courier}</strong> : null}
                      {order.courier && order.trackingNumber ? ' · ' : null}
                      {order.trackingNumber || null}
                    </p>
                  )}
                  {order.notes ? <p className="admin-order-popup__notes">{order.notes}</p> : null}
                </section>
              </div>

              <section className="admin-order-popup__section">
                <h3>Items ({items.length})</h3>
                <ul className="admin-order-popup__items">
                  {items.map((item, idx) => {
                    const qty = Number(item.quantity) || 1
                    const price = Number(item.price) || 0
                    const image =
                      productImage(item.productId) ||
                      getProductById(item.productId)?.image ||
                      ''
                    return (
                      <li key={`${order.id}-detail-${idx}`}>
                        <div className="admin-order-popup__thumb" aria-hidden="true">
                          {image ? (
                            <img src={image} alt="" loading="lazy" />
                          ) : (
                            <span>{(item.name || '?').slice(0, 1)}</span>
                          )}
                        </div>
                        <div className="admin-order-popup__item-main">
                          <strong title={item.name}>{item.name}</strong>
                          <span>
                            {item.size ? `Size ${item.size}` : 'Standard'}
                            {' · '}
                            Qty {qty}
                          </span>
                        </div>
                        <div className="admin-order-popup__item-price">
                          {price > 0 ? (
                            <>
                              <em>
                                {formatPrice(price)} × {qty}
                              </em>
                              <strong>{formatPrice(price * qty)}</strong>
                            </>
                          ) : (
                            <strong>×{qty}</strong>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>

              <div className="admin-order-popup__bottom">
                <section className="admin-order-popup__section">
                  {order.status === 'cancelled' ? (
                    <div className="admin-orders-track__banner is-cancelled">
                      <p className="admin-orders-track__brand">
                        PahadLink delivery
                      </p>
                      <strong className="admin-orders-track__headline">
                        Order cancelled
                      </strong>
                      {activity[0]?.at ? (
                        <time dateTime={activity[0].at}>
                          {formatTrackStamp(activity[0].at)}
                        </time>
                      ) : null}
                      {activity[0]?.note ? (
                        <p className="admin-orders-track__subtext">
                          {activity[0].note}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="admin-orders-track">
                      <header className="admin-orders-track__head">
                        <CheckIcon size={13} aria-hidden="true" />
                        <span>Track package</span>
                      </header>
                      {activity.length ? (
                        <ol
                          className="admin-orders-track__timeline"
                          aria-label="Order updates"
                        >
                          {activity.map((ev, idx) => {
                            const title =
                              ev.label ||
                              STATUS_LABELS[ev.status] ||
                              ev.status
                            const hint = String(ev.hint || '').trim()
                            const note = String(ev.note || '').trim()
                            const subtext =
                              ev.isCurrent &&
                              note &&
                              note.toLowerCase() !== title.toLowerCase() &&
                              note.toLowerCase() !== hint.toLowerCase()
                                ? note
                                : hint
                            const stamp = formatTrackStamp(ev.at)
                            const stateClass = ev.isUpcoming
                              ? 'is-upcoming'
                              : ev.isCurrent
                                ? 'is-current is-latest'
                                : 'is-past'
                            const connectorFilled =
                              !ev.isUpcoming && idx < activity.length - 1
                            return (
                              <li
                                key={`${order.id}-tl-${ev.status}-${idx}`}
                                className={`${stateClass}${
                                  connectorFilled ? ' is-filled' : ''
                                }`}
                              >
                                <span
                                  className="admin-orders-track__dot"
                                  aria-hidden="true"
                                >
                                  {ev.isUpcoming ? null : (
                                    <CheckIcon size={9} />
                                  )}
                                </span>
                                <div className="admin-orders-track__copy">
                                  <div className="admin-orders-track__row">
                                    <strong>{title}</strong>
                                    {stamp ? (
                                      <time dateTime={ev.at}>{stamp}</time>
                                    ) : null}
                                  </div>
                                  {subtext ? (
                                    <p className="admin-orders-track__subtext">
                                      {subtext}
                                    </p>
                                  ) : null}
                                </div>
                              </li>
                            )
                          })}
                        </ol>
                      ) : (
                        <p className="admin-order-popup__empty">
                          No timeline yet.
                        </p>
                      )}
                    </div>
                  )}
                </section>

                <section className="admin-order-popup__section">
                  <h3>Price details</h3>
                  <dl className="admin-order-popup__totals">
                    <div>
                      <dt>Items</dt>
                      <dd>{formatPrice(itemsTotal)}</dd>
                    </div>
                    {discount > 0 && (
                      <div>
                        <dt>Discount</dt>
                        <dd>−{formatPrice(discount)}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Delivery</dt>
                      <dd>{shippingFee === 0 ? 'FREE' : formatPrice(shippingFee)}</dd>
                    </div>
                    {gstType === 'igst' ? (
                      <div>
                        <dt>IGST ({gstRatePct}%)</dt>
                        <dd>{formatPrice(igstAmount)}</dd>
                      </div>
                    ) : (
                      <>
                        <div>
                          <dt>CGST ({gstRatePct / 2}%)</dt>
                          <dd>{formatPrice(cgstAmount)}</dd>
                        </div>
                        <div>
                          <dt>SGST ({gstRatePct / 2}%)</dt>
                          <dd>{formatPrice(sgstAmount)}</dd>
                        </div>
                      </>
                    )}
                    <div className="admin-order-popup__payable">
                      <dt>Total (incl. GST)</dt>
                      <dd>{formatPrice(total)}</dd>
                    </div>
                  </dl>

                  <div className="admin-order-popup__actions">
                    <button
                      type="button"
                      className="admin-btn"
                      onClick={() => setInvoiceOpen(true)}
                    >
                      <PrintIcon size={14} />
                      View invoice
                    </button>
                    <button
                      type="button"
                      className="admin-btn"
                      disabled={invoiceDownloading}
                      onClick={async () => {
                        setInvoiceDownloading(true)
                        try {
                          await downloadOrderInvoice(order)
                        } finally {
                          setInvoiceDownloading(false)
                        }
                      }}
                    >
                      <DownloadIcon size={14} />
                      {invoiceDownloading ? '…' : 'PDF'}
                    </button>
                    {isAdmin && order.paymentStatus === 'pending' && (
                      <button
                        type="button"
                        className="admin-btn admin-btn--brand"
                        disabled={busyId === order.id}
                        onClick={() =>
                          applyUpdate(order.id, { paymentStatus: 'paid' })
                        }
                      >
                        Mark paid
                      </button>
                    )}
                    {actions.map((action) => (
                      <button
                        key={action.status}
                        type="button"
                        className={`admin-btn${
                          action.status === 'cancelled' ? ' admin-btn--danger' : ''
                        }`}
                        disabled={busyId === order.id}
                        onClick={() =>
                          applyUpdate(order.id, {
                            status: action.status,
                            courier: draft.courier || order.courier,
                            trackingNumber:
                              draft.trackingNumber || order.trackingNumber,
                          })
                        }
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </div>
        )
      })()}

      <OrderInvoice
        order={detailOrder}
        open={Boolean(detailOrder && invoiceOpen)}
        onClose={() => setInvoiceOpen(false)}
      />
    </>
  )

  if (bare) return desk
  return <AdminLayout mode={mode}>{desk}</AdminLayout>
}
