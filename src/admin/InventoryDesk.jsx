import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CopyIcon, CheckIcon } from '../components/icons'
import { fetchInventory, updateInventoryStock } from '../services/orderService'
import { getProductById } from '../data/siteData'
import { ROUTES } from '../config'
import AdminLayout from './AdminLayout'
import { useAdminHeaderSearch } from './adminChrome'
import { StockHealthBar, HorizontalBars } from './AdminCharts'

const stockLevel = (qty) => {
  const n = Number(qty) || 0
  if (n <= 0) return 'out'
  if (n <= 5) return 'low'
  return 'ok'
}

const productTitle = (productId) => {
  const p = getProductById(productId)
  if (!p?.name) return productId
  return p.name.split('|')[0].trim()
}

const productImage = (productId) => getProductById(productId)?.image || ''

const productCategory = (productId) =>
  getProductById(productId)?.categoryName || 'Product'

const productPrice = (productId) => {
  const p = getProductById(productId)
  return Number(p?.price) || 0
}

const formatPrice = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

const LEVEL_LABEL = {
  ok: 'In stock',
  low: 'Low',
  out: 'Out',
}

function normalizeRows(inventory) {
  return inventory.map((item) => {
    const sizes = item.stockBySize
      ? Object.entries(item.stockBySize).map(([size, qty]) => ({
          size,
          qty: Number(qty) || 0,
          level: stockLevel(qty),
        }))
      : null
    const total = sizes
      ? sizes.reduce((s, r) => s + r.qty, 0)
      : Number(item.stock) || 0
    const level = sizes
      ? sizes.every((r) => r.level === 'out')
        ? 'out'
        : sizes.some((r) => r.level === 'out') || sizes.some((r) => r.level === 'low')
          ? 'low'
          : 'ok'
      : stockLevel(total)

    return {
      ...item,
      name: productTitle(item.productId),
      image: productImage(item.productId),
      category: productCategory(item.productId),
      price: productPrice(item.productId),
      sizes,
      total,
      level,
    }
  })
}

export default function InventoryDesk({ bare = false }) {
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [category, setCategory] = useState('all')
  const [detail, setDetail] = useState(null)
  const [copiedId, setCopiedId] = useState('')
  const [stockDraft, setStockDraft] = useState(null)
  const [savingStock, setSavingStock] = useState(false)
  const [stockMessage, setStockMessage] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 280)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (!detail) {
      setStockDraft(null)
      setStockMessage('')
      return
    }
    if (detail.sizes?.length) {
      const next = {}
      for (const s of detail.sizes) next[s.size] = String(s.qty)
      setStockDraft(next)
    } else {
      setStockDraft({ _: String(detail.total) })
    }
    setStockMessage('')
  }, [detail])

  useEffect(() => {
    if (!stockMessage) return undefined
    const t = setTimeout(() => setStockMessage(''), 2600)
    return () => clearTimeout(t)
  }, [stockMessage])

  useAdminHeaderSearch({
    placeholder: 'Search products…',
    value: query,
    onChange: (e) => setQuery(e.target.value),
    onClear: () => setQuery(''),
    'aria-label': 'Search inventory',
  })

  useEffect(() => {
    if (!detail) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setDetail(null)
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [detail])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const items = await fetchInventory()
      setInventory(items || [])
      setDetail((prev) => {
        if (!prev) return null
        const nextRows = normalizeRows(items || [])
        return nextRows.find((r) => r.productId === prev.productId) || null
      })
    } catch (err) {
      setError(err.message || 'Failed to load inventory')
      setInventory([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const rows = useMemo(() => normalizeRows(inventory), [inventory])

  const stats = useMemo(() => {
    let ok = 0
    let low = 0
    let out = 0
    let units = 0
    let value = 0
    for (const row of rows) {
      units += row.total
      value += row.price * row.total
      if (row.level === 'out') out += 1
      else if (row.level === 'low') low += 1
      else ok += 1
    }
    return { total: rows.length, ok, low, out, units, value }
  }, [rows])

  const categories = useMemo(() => {
    const map = new Map()
    for (const row of rows) {
      const key = row.category || 'Product'
      map.set(key, (map.get(key) || 0) + 1)
    }
    return [...map.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  }, [rows])

  const filtered = useMemo(() => {
    const q = debouncedQuery.toLowerCase()
    let list = rows.filter((row) => {
      if (filter !== 'all' && row.level !== filter) return false
      if (category !== 'all' && row.category !== category) return false
      if (!q) return true
      return (
        row.productId.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q) ||
        row.category.toLowerCase().includes(q)
      )
    })

    const riskRank = { out: 0, low: 1, ok: 2 }
    list = [...list].sort(
      (a, b) =>
        (riskRank[a.level] ?? 9) - (riskRank[b.level] ?? 9) ||
        a.total - b.total ||
        a.name.localeCompare(b.name)
    )
    return list
  }, [rows, debouncedQuery, filter, category])

  const categoryBars = useMemo(() => {
    const map = new Map()
    for (const row of rows) {
      const key = row.category || 'Product'
      const cur = map.get(key) || { key, label: key, value: 0, out: 0 }
      cur.value += 1
      if (row.level === 'out') cur.out += 1
      map.set(key, cur)
    }
    return [...map.values()]
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
      .map((row, i) => ({
        ...row,
        color: ['#0a4f33', '#127048', '#2f6fa8', '#b86a12', '#5b6fd4', '#c45c3a'][
          i % 6
        ],
      }))
  }, [rows])

  const healthyPct = stats.total
    ? Math.round((stats.ok / stats.total) * 100)
    : 0

  const copyId = async (productId) => {
    try {
      await navigator.clipboard.writeText(productId)
      setCopiedId(productId)
      setTimeout(() => setCopiedId(''), 1400)
    } catch {
      /* ignore */
    }
  }

  const saveStock = async (size) => {
    if (!detail || !stockDraft) return
    const raw = size ? stockDraft[size] : stockDraft._
    const stock = Math.max(0, Math.floor(Number(raw)))
    if (!Number.isFinite(stock)) {
      setStockMessage('Enter a valid stock number')
      return
    }
    setSavingStock(true)
    setStockMessage('')
    try {
      const data = await updateInventoryStock(detail.productId, {
        stock,
        ...(size ? { size } : null),
      })
      if (data?.items) {
        setInventory(data.items)
        const next = normalizeRows(data.items).find(
          (r) => r.productId === detail.productId
        )
        if (next) setDetail(next)
      } else await load()
      setStockMessage('Stock saved')
    } catch (err) {
      setStockMessage(err.message || 'Could not save stock')
    } finally {
      setSavingStock(false)
    }
  }

  const desk = (
    <>
      <div className="admin-desk admin-inventory-page">
        <header className="admin-head admin-inv-page-head">
          <div className="admin-head__copy">
            <h1>Inventory</h1>
          </div>
        </header>

        {error && (
          <p className="admin-banner admin-banner--error" role="alert">
            {error}
          </p>
        )}

        <section className="admin-inv-kpis" aria-label="Inventory summary">
          <button
            type="button"
            className={`admin-inv-kpi${filter === 'all' ? ' is-active' : ''}`}
            onClick={() => setFilter('all')}
          >
            <div className="admin-inv-kpi__top">
              <em>Catalog</em>
              <span className="admin-inv-kpi__tag">{healthyPct}% healthy</span>
            </div>
            <strong>{stats.total}</strong>
            <span>
              {stats.units.toLocaleString('en-IN')} units
              {stats.value > 0 ? ` · ${formatPrice(stats.value)}` : ''}
            </span>
          </button>
          <button
            type="button"
            className={`admin-inv-kpi admin-inv-kpi--ok${filter === 'ok' ? ' is-active' : ''}`}
            onClick={() => setFilter('ok')}
          >
            <em>In stock</em>
            <strong>{stats.ok}</strong>
            <span>Ready to sell</span>
          </button>
          <button
            type="button"
            className={`admin-inv-kpi admin-inv-kpi--low${filter === 'low' ? ' is-active' : ''}`}
            onClick={() => setFilter('low')}
          >
            <em>Low stock</em>
            <strong>{stats.low}</strong>
            <span>≤ 5 units left</span>
          </button>
          <button
            type="button"
            className={`admin-inv-kpi admin-inv-kpi--out${filter === 'out' ? ' is-active' : ''}`}
            onClick={() => setFilter('out')}
          >
            <em>Out of stock</em>
            <strong>{stats.out}</strong>
            <span>Restock soon</span>
          </button>
        </section>

        <div className="admin-inv-split">
          <aside className="admin-inv-side" aria-label="Inventory insights">
            <article className="admin-panel admin-panel--inv-chart">
              <header className="admin-panel__head">
                <h2>Stock health</h2>
              </header>
              <StockHealthBar ok={stats.ok} low={stats.low} out={stats.out} />
            </article>
            <article className="admin-panel admin-panel--inv-chart">
              <header className="admin-panel__head">
                <h2>By category</h2>
              </header>
              <HorizontalBars
                rows={categoryBars}
                valueFormat={(n) => `${n}`}
                emptyLabel="No categories"
                onSelect={(key) =>
                  setCategory((prev) => (prev === key ? 'all' : key))
                }
              />
            </article>
          </aside>

          <section
            className="admin-inventory admin-inventory--page"
            aria-labelledby="inv-list-title"
          >
            <header className="admin-inventory__head admin-inventory__head--page">
              <div className="admin-inventory__head-copy">
                <h2 id="inv-list-title">Product stock</h2>
                <p>
                  Showing <strong>{filtered.length}</strong> of {stats.total}
                  {category !== 'all' ? ` in ${category}` : ''}
                </p>
              </div>
            </header>

            {categories.length > 1 && (
              <div className="admin-inv-cats" role="group" aria-label="Categories">
                <button
                  type="button"
                  className={`admin-inv-cat${category === 'all' ? ' is-active' : ''}`}
                  onClick={() => setCategory('all')}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.label}
                    type="button"
                    className={`admin-inv-cat${
                      category === cat.label ? ' is-active' : ''
                    }`}
                    onClick={() =>
                      setCategory((prev) =>
                        prev === cat.label ? 'all' : cat.label
                      )
                    }
                  >
                    {cat.label}
                    <em>{cat.count}</em>
                  </button>
                ))}
              </div>
            )}

            {loading && !rows.length ? (
              <p className="admin-loading">Loading inventory…</p>
            ) : filtered.length === 0 ? (
              <p className="admin-empty">No products match this filter.</p>
            ) : (
              <ul className="admin-inv-cards">
                {filtered.map((row) => {
                  return (
                    <li key={row.productId}>
                      <button
                        type="button"
                        className={`admin-inv-card admin-inv-card--${row.level}`}
                        onClick={() => setDetail(row)}
                      >
                        <div className="admin-inv-card__media" aria-hidden="true">
                          {row.image ? (
                            <img src={row.image} alt="" loading="lazy" />
                          ) : (
                            <span>{row.name.slice(0, 1)}</span>
                          )}
                        </div>

                        <div className="admin-inv-card__body">
                          <div className="admin-inv-card__title">
                            <strong title={row.name}>{row.name}</strong>
                            <span className={`admin-badge admin-badge--inv-${row.level}`}>
                              {LEVEL_LABEL[row.level]}
                            </span>
                          </div>
                          <p className="admin-inv-card__meta">
                            {row.category}
                            <code>{row.productId}</code>
                          </p>

                          {row.sizes?.length ? (
                            <div className="admin-inv-sizes">
                              {row.sizes.slice(0, 5).map((s) => (
                                <span
                                  key={s.size}
                                  className={`admin-inv-size admin-inv-size--${s.level}`}
                                  title={`${s.size}: ${s.qty}`}
                                >
                                  <em>{s.size}</em>
                                  <strong>{s.qty}</strong>
                                </span>
                              ))}
                              {row.sizes.length > 5 ? (
                                <span className="admin-inv-size admin-inv-size--more">
                                  +{row.sizes.length - 5}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        <div className="admin-inv-card__stats">
                          <div>
                            <em>Units</em>
                            <strong>{row.total}</strong>
                          </div>
                          <div>
                            <em>Value</em>
                            <strong>
                              {row.price > 0
                                ? formatPrice(row.price * row.total)
                                : '—'}
                            </strong>
                          </div>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      {detail && (
        <div
          className="admin-inv-popup"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-inv-popup-title"
        >
          <button
            type="button"
            className="admin-inv-popup__backdrop"
            aria-label="Close product stock"
            onClick={() => setDetail(null)}
          />
          <div className="admin-inv-popup__panel">
            <header className="admin-inv-popup__head">
              <div className="admin-inv-popup__product">
                <div className="admin-inv-popup__thumb" aria-hidden="true">
                  {detail.image ? (
                    <img src={detail.image} alt="" />
                  ) : (
                    <span>{detail.name.slice(0, 1)}</span>
                  )}
                </div>
                <div>
                  <p className="admin-inv-popup__kicker">{detail.category}</p>
                  <h2 id="admin-inv-popup-title">{detail.name}</h2>
                  <div className="admin-inv-popup__id">
                    <code>{detail.productId}</code>
                    <button
                      type="button"
                      className={`admin-card__copy${
                        copiedId === detail.productId ? ' is-copied' : ''
                      }`}
                      onClick={() => copyId(detail.productId)}
                      aria-label="Copy product id"
                      title="Copy product id"
                    >
                      {copiedId === detail.productId ? (
                        <CheckIcon size={13} />
                      ) : (
                        <CopyIcon size={13} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => setDetail(null)}
              >
                Close
              </button>
            </header>

            <div className="admin-inv-popup__stats">
              <div>
                <em>Status</em>
                <strong className={`is-${detail.level}`}>
                  {LEVEL_LABEL[detail.level]}
                </strong>
              </div>
              <div>
                <em>Total units</em>
                <strong>{detail.total}</strong>
              </div>
              <div>
                <em>Unit price</em>
                <strong>
                  {detail.price > 0 ? formatPrice(detail.price) : '—'}
                </strong>
              </div>
              <div>
                <em>Stock value</em>
                <strong>
                  {detail.price > 0
                    ? formatPrice(detail.price * detail.total)
                    : '—'}
                </strong>
              </div>
            </div>

            {detail.sizes?.length ? (
              <section className="admin-inv-popup__section">
                <h3>Stock by size</h3>
                <ul className="admin-inv-popup__sizes admin-inv-popup__sizes--edit">
                  {detail.sizes.map((s) => (
                    <li key={s.size} className={`is-${s.level}`}>
                      <span>{s.size}</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="admin-inv-popup__qty"
                        value={stockDraft?.[s.size] ?? String(s.qty)}
                        disabled={savingStock}
                        onChange={(e) =>
                          setStockDraft((prev) => ({
                            ...(prev || {}),
                            [s.size]: e.target.value,
                          }))
                        }
                        aria-label={`${s.size} stock`}
                      />
                      <button
                        type="button"
                        className="admin-btn admin-btn--ghost"
                        disabled={savingStock}
                        onClick={() => saveStock(s.size)}
                      >
                        Save
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <section className="admin-inv-popup__section">
                <h3>Stock</h3>
                <div className="admin-inv-popup__edit-row">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="admin-inv-popup__qty"
                    value={stockDraft?._ ?? String(detail.total)}
                    disabled={savingStock}
                    onChange={(e) =>
                      setStockDraft({ _: e.target.value })
                    }
                    aria-label="Stock units"
                  />
                  <button
                    type="button"
                    className="admin-btn"
                    disabled={savingStock}
                    onClick={() => saveStock()}
                  >
                    {savingStock ? 'Saving…' : 'Save stock'}
                  </button>
                </div>
              </section>
            )}

            {stockMessage ? (
              <p
                className={`admin-alert${
                  /could not|valid|fail/i.test(stockMessage)
                    ? ''
                    : ' admin-alert--ok'
                }`}
                role="status"
              >
                {stockMessage}
              </p>
            ) : null}

            <div className="admin-inv-popup__actions">
              <button
                type="button"
                className="admin-btn admin-btn--brand"
                onClick={() => setDetail(null)}
              >
                Close
              </button>
              <Link to={ROUTES.ADMIN_ORDERS} className="admin-btn">
                Open orders
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )

  if (bare) return desk
  return <AdminLayout mode="admin">{desk}</AdminLayout>
}
