/**
 * Lightweight SVG charts for admin/seller — static, hover values, no motion.
 * All series adapt to Day / Week / Month / Year.
 */
import { useState } from 'react'

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

function formatInr(n) {
  const v = Number(n) || 0
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`
  if (v >= 1000) return `₹${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`
  return `₹${v.toLocaleString('en-IN')}`
}

/** Local YYYY-MM-DD (avoids UTC shift from toISOString) */
function localDateKey(input) {
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function localMonthKey(input) {
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Sparse x-axis labels so month/day charts stay readable */
function shouldShowAxisLabel(index, total, period) {
  if (total <= 8) return true
  if (period === 'day') return index % 2 === 0 || index === total - 1
  if (period === 'month') {
    if (index === 0 || index === total - 1) return true
    return (index + 1) % 5 === 0
  }
  if (period === 'year') return true
  return index % 2 === 0 || index === total - 1
}

function ChartTip({ tip }) {
  if (!tip) return null
  return (
    <div
      className={`admin-chart__tip admin-chart__tip--${tip.place || 'above'}`}
      style={{ left: tip.x, top: tip.y }}
      role="tooltip"
    >
      {tip.text}
    </div>
  )
}

function tipFromEvent(e, text) {
  const box = e.currentTarget.closest('.admin-chart')
  if (!box) return { x: 0, y: 0, text, place: 'above' }
  const rect = box.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const place = y < 36 ? 'below' : 'above'
  const edgePad = 10
  return {
    x: clamp(x, edgePad, Math.max(edgePad, rect.width - edgePad)),
    y: place === 'below' ? y + 12 : y - 8,
    place,
    text,
  }
}

/** Status mix — donut with hover values (period-filtered via stats API) */
export function StatusDonut({ segments, size = 176, onSelect }) {
  const [tip, setTip] = useState(null)
  const totalRaw = segments.reduce((s, x) => s + (x.value || 0), 0)
  const total = totalRaw || 1
  const stroke = 20
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  let offset = 0

  const visible = segments.filter((s) => (s.value || 0) > 0)
  const empty = totalRaw === 0

  return (
    <div className="admin-chart admin-chart--donut" onMouseLeave={() => setTip(null)}>
      <div className="admin-chart__donut-wrap">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Order status mix, ${totalRaw} total`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(10,79,51,0.08)"
            strokeWidth={stroke}
          />
          {!empty &&
            segments.map((seg) => {
              const len = ((seg.value || 0) / total) * c
              if (len <= 0) return null
              const pct = Math.round((seg.value / totalRaw) * 100)
              const label = `${seg.label}: ${seg.value} (${pct}%)`
              const el = (
                <circle
                  key={seg.key}
                  className="admin-chart__arc"
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${len} ${c - len}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  style={{ cursor: onSelect ? 'pointer' : 'default' }}
                  onClick={() => onSelect?.(seg.key)}
                  onMouseMove={(e) => setTip(tipFromEvent(e, label))}
                  onMouseLeave={() => setTip(null)}
                />
              )
              offset += len
              return el
            })}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r - stroke / 2 - 4}
            fill="#fff"
            stroke="rgba(10,79,51,0.06)"
            strokeWidth="1"
          />
          <text
            x="50%"
            y="46%"
            textAnchor="middle"
            className="admin-chart__center-value"
          >
            {totalRaw}
          </text>
          <text
            x="50%"
            y="58%"
            textAnchor="middle"
            className="admin-chart__center-label"
          >
            Orders
          </text>
        </svg>
      </div>

      <ul className="admin-chart__legend">
        {(empty ? segments.slice(0, 5) : visible).map((seg) => {
          const pct = totalRaw ? Math.round((seg.value / totalRaw) * 100) : 0
          const label = `${seg.label}: ${seg.value} (${pct}%)`
          return (
            <li key={seg.key}>
              <button
                type="button"
                className="admin-chart__legend-btn"
                onClick={() => onSelect?.(seg.key)}
                disabled={!onSelect}
                onMouseEnter={(e) => setTip(tipFromEvent(e, label))}
                onMouseMove={(e) => setTip(tipFromEvent(e, label))}
                onMouseLeave={() => setTip(null)}
              >
                <i style={{ background: seg.color }} />
                <span>{seg.label}</span>
                <em>{pct}%</em>
                <strong>{seg.value}</strong>
              </button>
            </li>
          )
        })}
      </ul>
      <ChartTip tip={tip} />
    </div>
  )
}

/** Orders volume — bars that densify for month / thin for year */
export function OrdersBarChart({ series, period = 'week', height }) {
  const [tip, setTip] = useState(null)
  const n = Math.max(1, series.length)
  const chartHgt =
    height ||
    (period === 'month' ? 248 : period === 'year' ? 236 : period === 'day' ? 236 : 236)
  const max = Math.max(1, ...series.map((d) => d.value))
  const padL = 32
  const padR = 12
  const padTop = 16
  const padBottom = 28
  const minSlot = period === 'month' ? 16 : period === 'day' ? 36 : period === 'year' ? 40 : 48
  const barGap = period === 'month' ? 2 : period === 'day' ? 8 : 10
  // Keep SVG wide so it fills the card (avoid letterboxed empty sides).
  const minInner =
    period === 'month' ? 720 : period === 'day' ? 680 : period === 'year' ? 600 : 560
  const innerW = Math.max(minInner, n * minSlot)
  const width = padL + innerW + padR
  const chartH = chartHgt - padTop - padBottom
  const slot = innerW / n
  const barW = Math.max(4, Math.min(period === 'year' ? 32 : 28, slot - barGap))
  const ticks = [0, 0.5, 1]
  const rx = period === 'month' ? 2 : 4

  return (
    <div
      className="admin-chart admin-chart--bars"
      onMouseLeave={() => setTip(null)}
    >
      <svg
        width="100%"
        height={chartHgt}
        viewBox={`0 0 ${width} ${chartHgt}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Orders over ${period}`}
      >
        <defs>
          <linearGradient id="adminBarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#127048" />
            <stop offset="100%" stopColor="#0a4f33" />
          </linearGradient>
        </defs>

        {ticks.map((t) => {
          const y = padTop + chartH * (1 - t)
          const label = Math.round(max * t)
          return (
            <g key={t}>
              <line
                x1={padL}
                x2={width - padR}
                y1={y}
                y2={y}
                stroke="rgba(10,79,51,0.1)"
                strokeWidth="1"
              />
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                className="admin-chart__axis"
              >
                {label}
              </text>
            </g>
          )
        })}

        {series.map((d, i) => {
          const h = (d.value / max) * chartH
          const x = padL + i * slot + (slot - barW) / 2
          const y = padTop + chartH - h
          const tipLabel = `${d.label}: ${d.value} order${d.value === 1 ? '' : 's'}${
            d.revenue ? ` · ${formatInr(d.revenue)} paid` : ''
          }`
          const showLabel = shouldShowAxisLabel(i, n, period)
          return (
            <g key={d.key || d.label} className="admin-chart__bar-group">
              <rect
                x={x}
                y={padTop}
                width={barW}
                height={chartH}
                rx={rx}
                fill="rgba(10,79,51,0.05)"
                onMouseMove={(e) => setTip(tipFromEvent(e, tipLabel))}
                onMouseLeave={() => setTip(null)}
              />
              <rect
                className="admin-chart__bar"
                x={x}
                y={y}
                width={barW}
                height={Math.max(3, h)}
                rx={rx}
                fill="url(#adminBarGrad)"
                onMouseMove={(e) => setTip(tipFromEvent(e, tipLabel))}
                onMouseLeave={() => setTip(null)}
              />
              {showLabel && (
                <text
                  x={x + barW / 2}
                  y={chartHgt - 10}
                  textAnchor="middle"
                  className="admin-chart__axis"
                >
                  {d.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <ChartTip tip={tip} />
    </div>
  )
}

/** Paid revenue — area chart scaled to period buckets */
export function RevenueSparkline({ points, series, period = 'week', height = 220 }) {
  const [tip, setTip] = useState(null)
  const rows =
    series ||
    (points || []).map((p, i) => ({
      label: p.label || `D${i + 1}`,
      value: p.value,
    }))

  if (!rows.length) {
    return <p className="admin-chart__empty">No paid orders yet</p>
  }

  const max = Math.max(1, ...rows.map((p) => p.value))
  const hasRevenue = rows.some((p) => p.value > 0)
  const padL = 20
  const padR = 16
  const padTop = 12
  const padBottom = 28
  const minInner =
    period === 'month' ? 720 : period === 'day' ? 680 : period === 'year' ? 600 : 560
  const width = Math.max(
    minInner + padL + padR,
    rows.length * (period === 'month' ? 24 : period === 'day' ? 36 : 52) + padL + padR
  )
  const chartH = height - padTop - padBottom
  const step = (width - padL - padR) / Math.max(1, rows.length - 1)
  const gradId = `adminRevFill-${period}-${rows.length}`

  const coords = rows.map((p, i) => {
    const x = padL + i * step
    const y = padTop + chartH - (p.value / max) * chartH
    return { x, y, ...p }
  })

  const line = coords.map((p) => `${p.x},${p.y}`).join(' ')
  const area = `${padL},${padTop + chartH} ${line} ${padL + (rows.length - 1) * step},${padTop + chartH}`
  const peak = coords.reduce((best, p) => (p.value > best.value ? p : best), coords[0])

  if (!hasRevenue) {
    return <p className="admin-chart__empty">No paid revenue in this period</p>
  }

  return (
    <div
      className="admin-chart admin-chart--spark"
      onMouseLeave={() => setTip(null)}
    >
      <div className="admin-chart__spark-meta">
        <span>Peak {formatInr(peak.value)}</span>
      </div>
      <div className="admin-chart__spark-frame">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Paid revenue · ${period}`}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(10,79,51,0.28)" />
              <stop offset="100%" stopColor="rgba(10,79,51,0.02)" />
            </linearGradient>
          </defs>

          {[0.25, 0.5, 0.75].map((t) => {
            const y = padTop + chartH * (1 - t)
            return (
              <line
                key={t}
                x1={padL}
                x2={width - padR}
                y1={y}
                y2={y}
                stroke="rgba(10,79,51,0.08)"
              />
            )
          })}

          <polygon points={area} fill={`url(#${gradId})`} />
          <polyline
            points={line}
            fill="none"
            stroke="#0a4f33"
            strokeWidth="2.25"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {coords.map((p, i) => {
            const tipLabel = `${p.label}: ${formatInr(p.value)}`
            const showLabel = shouldShowAxisLabel(i, rows.length, period)
            const anchor =
              i === 0 ? 'start' : i === rows.length - 1 ? 'end' : 'middle'
            return (
              <g key={`${p.label}-${i}`}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={12}
                  fill="transparent"
                  onMouseMove={(e) => setTip(tipFromEvent(e, tipLabel))}
                  onMouseLeave={() => setTip(null)}
                />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={period === 'month' ? 2.75 : 3.5}
                  fill="#fff"
                  stroke="#0a4f33"
                  strokeWidth="2"
                  pointerEvents="none"
                />
                {showLabel && (
                  <text
                    x={p.x}
                    y={height - 8}
                    textAnchor={anchor}
                    className="admin-chart__axis"
                  >
                    {p.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>
      <ChartTip tip={tip} />
    </div>
  )
}

/** Horizontal ranking bars — payments, categories, stock, sources */
/** Horizontal bars — category / ranking rows */
export function HorizontalBars({
  rows = [],
  valueFormat,
  onSelect,
  emptyLabel = 'Nothing to chart yet',
  maxItems = 6,
}) {
  const [tip, setTip] = useState(null)
  const list = rows.slice(0, maxItems)
  const total = list.reduce((s, r) => s + (Number(r.value) || 0), 0)
  const format = valueFormat || ((n) => String(n))

  if (!list.length) {
    return <p className="admin-chart__empty">{emptyLabel}</p>
  }

  return (
    <div
      className="admin-chart admin-chart--hbar"
      onMouseLeave={() => setTip(null)}
    >
      <ul className="admin-hbar">
        {list.map((row, index) => {
          const value = Number(row.value) || 0
          const share = total ? Math.round((value / total) * 100) : 0
          const tipLabel = `${row.label}: ${format(value)}${
            row.out ? ` · ${row.out} out` : ''
          }`
          const interactive = Boolean(onSelect && row.key)
          const Tag = interactive ? 'button' : 'div'
          return (
            <li key={row.key || row.label}>
              <Tag
                type={interactive ? 'button' : undefined}
                className={`admin-hbar__row${interactive ? ' is-click' : ''}`}
                onClick={interactive ? () => onSelect(row.key) : undefined}
                onMouseMove={(e) => setTip(tipFromEvent(e, tipLabel))}
                onMouseLeave={() => setTip(null)}
              >
                <span className="admin-hbar__rank" aria-hidden="true">
                  {index + 1}
                </span>
                <div className="admin-hbar__body">
                  <div className="admin-hbar__top">
                    <span className="admin-hbar__label" title={row.label}>
                      {row.label}
                    </span>
                    <strong className="admin-hbar__value">
                      {format(value)}
                      <em>{share}%</em>
                    </strong>
                  </div>
                  <div className="admin-hbar__track" aria-hidden="true">
                    <span
                      className="admin-hbar__fill"
                      style={{
                        width: `${share}%`,
                        ...(row.color ? { background: row.color } : null),
                      }}
                    />
                  </div>
                </div>
              </Tag>
            </li>
          )
        })}
      </ul>
      <ChartTip tip={tip} />
    </div>
  )
}

/** Stock health — stacked proportion bar + legend */
export function StockHealthBar({ ok = 0, low = 0, out = 0 }) {
  const [tip, setTip] = useState(null)
  const total = ok + low + out
  if (!total) {
    return <p className="admin-chart__empty">No inventory loaded</p>
  }

  const segs = [
    { key: 'ok', label: 'In stock', value: ok, color: '#0a4f33', soft: '#e7f3ec' },
    { key: 'low', label: 'Low', value: low, color: '#b86a12', soft: '#fff4e5' },
    { key: 'out', label: 'Out', value: out, color: '#c0394f', soft: '#fdecef' },
  ]
  const healthyPct = Math.round((ok / total) * 100)

  return (
    <div
      className="admin-chart admin-chart--stock"
      onMouseLeave={() => setTip(null)}
    >
      <div className="admin-stock-hero">
        <div className="admin-stock-hero__main">
          <em>Products tracked</em>
          <strong>{total}</strong>
        </div>
        <div
          className={`admin-stock-hero__health${
            healthyPct >= 70 ? ' is-good' : healthyPct >= 40 ? ' is-warn' : ' is-bad'
          }`}
        >
          <em>Healthy</em>
          <strong>{healthyPct}%</strong>
        </div>
      </div>

      <ul className="admin-stock-bar__legend">
        {segs.map((seg) => {
          const pct = total ? Math.round((seg.value / total) * 100) : 0
          return (
            <li
              key={seg.key}
              className={`admin-stock-bar__legend-item admin-stock-bar__legend-item--${seg.key}`}
              style={{ '--stock-soft': seg.soft, '--stock-tone': seg.color }}
              onMouseMove={(e) =>
                setTip(tipFromEvent(e, `${seg.label}: ${seg.value} (${pct}%)`))
              }
              onMouseLeave={() => setTip(null)}
            >
              <span className="admin-stock-bar__legend-top">
                <i style={{ background: seg.color }} />
                <span>{seg.label}</span>
              </span>
              <strong>{seg.value}</strong>
              <em>{pct}%</em>
            </li>
          )
        })}
      </ul>
      <ChartTip tip={tip} />
    </div>
  )
}

/**
 * Bucket orders for charts by period:
 * day → 2h slots · week → 7 days · month → days · year → months
 */
export function buildPeriodSeries(orders, period = 'week') {
  const now = new Date()
  const map = new Map()
  const key = String(period || 'week').toLowerCase()

  const bump = (bucketKey, order) => {
    const row = map.get(bucketKey)
    if (!row) return
    row.value += 1
    if (order.paymentStatus === 'paid') {
      row.revenue += Number(order.totalAmount || 0)
    }
  }

  if (key === 'day') {
    for (let h = 0; h < 24; h += 2) {
      const label = `${String(h).padStart(2, '0')}:00`
      map.set(String(h), { key: String(h), label, value: 0, revenue: 0 })
    }
    const today = now.toDateString()
    for (const order of orders || []) {
      const d = new Date(order.createdAt)
      if (Number.isNaN(d.getTime()) || d.toDateString() !== today) continue
      const bucket = String(Math.floor(d.getHours() / 2) * 2)
      bump(bucket, order)
    }
    return [...map.values()]
  }

  if (key === 'month') {
    const y = now.getFullYear()
    const m = now.getMonth()
    const lastDay = Math.min(new Date(y, m + 1, 0).getDate(), now.getDate())
    for (let day = 1; day <= lastDay; day += 1) {
      const d = new Date(y, m, day)
      const k = localDateKey(d)
      map.set(k, {
        key: k,
        label: String(day),
        value: 0,
        revenue: 0,
      })
    }
    for (const order of orders || []) {
      const k = localDateKey(order.createdAt)
      if (!map.has(k)) continue
      bump(k, order)
    }
    return [...map.values()]
  }

  if (key === 'year') {
    for (let m = 0; m <= now.getMonth(); m += 1) {
      const d = new Date(now.getFullYear(), m, 1)
      const k = localMonthKey(d)
      map.set(k, {
        key: k,
        label: d.toLocaleDateString('en-IN', { month: 'short' }),
        value: 0,
        revenue: 0,
      })
    }
    for (const order of orders || []) {
      const d = new Date(order.createdAt)
      if (Number.isNaN(d.getTime()) || d.getFullYear() !== now.getFullYear()) continue
      const k = localMonthKey(d)
      if (!map.has(k)) continue
      bump(k, order)
    }
    return [...map.values()]
  }

  // week — last 7 local calendar days
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    const k = localDateKey(d)
    map.set(k, {
      key: k,
      label: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      value: 0,
      revenue: 0,
    })
  }
  for (const order of orders || []) {
    const k = localDateKey(order.createdAt)
    if (!map.has(k)) continue
    bump(k, order)
  }
  return [...map.values()]
}

export const PERIOD_OPTIONS = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
]

export function periodChartTitle(period) {
  switch (period) {
    case 'day':
      return 'Orders · today'
    case 'month':
      return 'Orders · this month'
    case 'year':
      return 'Orders · this year'
    default:
      return 'Orders · 7 days'
  }
}

export function periodRevenueTitle(period) {
  switch (period) {
    case 'day':
      return 'Paid revenue · today'
    case 'month':
      return 'Paid revenue · this month'
    case 'year':
      return 'Paid revenue · this year'
    default:
      return 'Paid revenue · 7 days'
  }
}

export function periodRangeHint(period) {
  switch (period) {
    case 'day':
      return 'Today'
    case 'month':
      return 'This month'
    case 'year':
      return 'This year'
    default:
      return 'Last 7 days'
  }
}

/** Paid revenue by payment method */
export function buildPaymentSeries(orders) {
  const map = new Map()
  for (const order of orders || []) {
    if (order.paymentStatus !== 'paid') continue
    const key = String(order.paymentMethod || 'other').toLowerCase()
    const row = map.get(key) || { key, label: key.toUpperCase(), value: 0, count: 0 }
    row.value += Number(order.totalAmount || 0)
    row.count += 1
    map.set(key, row)
  }
  return [...map.values()].sort((a, b) => b.value - a.value)
}

/** Units sold by category (from order line items) */
export function buildCategorySeries(orders, resolveCategory) {
  const map = new Map()
  for (const order of orders || []) {
    for (const item of order.items || []) {
      const cat =
        (typeof resolveCategory === 'function'
          ? resolveCategory(item.productId)
          : null) ||
        item.categoryName ||
        item.category ||
        'Other'
      const key = String(cat)
      const row = map.get(key) || { key, label: key, value: 0 }
      row.value += Number(item.quantity) || 1
      map.set(key, row)
    }
  }
  return [...map.values()].sort((a, b) => b.value - a.value)
}

/** Top products by units sold */
export function buildTopProductSeries(orders, resolveTitle, limit = 6) {
  const map = new Map()
  for (const order of orders || []) {
    for (const item of order.items || []) {
      const id = item.productId || item.name || 'item'
      const label =
        (typeof resolveTitle === 'function' ? resolveTitle(item.productId) : null) ||
        item.name ||
        id
      const row = map.get(id) || { key: id, label: String(label).slice(0, 42), value: 0 }
      row.value += Number(item.quantity) || 1
      map.set(id, row)
    }
  }
  return [...map.values()].sort((a, b) => b.value - a.value).slice(0, limit)
}
