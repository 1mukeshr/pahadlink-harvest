import { createElement, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Breadcrumb from '../../components/layout/Breadcrumb'
import Footer from '../../components/layout/Footer'
import {
  ArrowRightIcon,
  CheckIcon,
  CloseIcon,
  CodIcon,
  LogOutIcon,
  MailIcon,
  PackageIcon,
  TruckIcon,
  UpiIcon,
  UserIcon,
  DownloadIcon,
} from '../../components/icons'
import { downloadOrderInvoice } from '../../components/orders/OrderInvoice'
import { ROUTES } from '../../config'
import { useAuth } from '../../context/AuthContext'
import { resolveProductImage } from '../../data/siteData'
import { getOrdersForUser, syncOrdersForUser } from '../../utils/ordersStorage'
import {
  fetchMyOrders,
  STATUS_LABELS,
  paymentStatusLabel,
  buildDeliveryActivity,
} from '../../services/orderService'
import { GST_RATE_PERCENT, buildGstBreakdown } from '../../data/gst'

const statusClass = (status) => {
  const key = String(status || 'pending').toLowerCase()
  if (key.includes('deliver') && !key.includes('out')) return 'is-delivered'
  if (key.includes('out_for') || key === 'out_for_delivery') return 'is-ofd'
  if (key.includes('ship')) return 'is-shipped'
  if (key.includes('cancel')) return 'is-cancelled'
  if (key.includes('return')) return 'is-return'
  if (key.includes('process') || key === 'processing') return 'is-packed'
  if (key.includes('confirm')) return 'is-confirmed'
  return 'is-placed'
}

const statusText = (order) =>
  order?.statusLabel || STATUS_LABELS[order?.status] || order?.status || 'Order Placed'

const formatPrice = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

const formatDateTime = (iso) => {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return '-'
  }
}

/** Compact timeline stamp: Wed, 22 Jul · 2:30 pm */
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

const paymentLabel = (id) => {
  if (id === 'upi') return 'UPI'
  if (id === 'cod') return 'Cash on delivery'
  return 'Cash on delivery'
}

const paymentIcon = (id) => {
  if (id === 'upi') return UpiIcon
  return CodIcon
}

const paymentTone = (order) => {
  const pay = String(order?.paymentStatus || '').toLowerCase()
  if (pay.includes('fail')) return 'is-failed'
  if (
    pay.includes('paid') ||
    (order?.payment === 'cod' && order?.status === 'delivered')
  ) {
    return 'is-paid'
  }
  return 'is-pending'
}

const resolveItemImage = (item) => resolveProductImage(item)

const itemsSubtotal = (items) =>
  (items || []).reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.qty || 1),
    0
  )


export const AccountPage = () => {
  const { user, logout } = useAuth()

  return (
    <>
      <main className="account-page">
        <div className="breadcrumb-bar">
          <div className="container">
            <Breadcrumb items={[{ label: 'My account' }]} />
          </div>
        </div>

        <section className="account-shell">
          <div className="container account-shell__inner">
            <div className="account-card">
              <div className="account-card__hero">               
               
                <h1>{user?.name || 'My account'}</h1>
               
              </div>

              <ul className="account-card__list">
                <li>
                  <span className="account-card__label">
                    <UserIcon size={14} />
                    Name
                  </span>
                  <strong>{user?.name || '-'}</strong>
                </li>
                <li>
                  <span className="account-card__label">
                    <MailIcon size={14} />
                    Email
                  </span>
                  <strong>{user?.email || '-'}</strong>
                </li>
                <li>
                  <span className="account-card__label">
                    <UserIcon size={14} />
                    Username
                  </span>
                  <strong>{user?.username || '-'}</strong>
                </li>
              </ul>

              <div className="account-card__quick">
                <Link to={ROUTES.ORDERS} className="account-card__quick-link">
                  <span className="account-card__quick-icon" aria-hidden="true">
                    <PackageIcon size={16} />
                  </span>
                  <span className="account-card__quick-copy">
                    <strong>My orders</strong>
                    <em>Track deliveries</em>
                  </span>
                  <ArrowRightIcon size={14} className="account-card__quick-chevron" />
                </Link>
                <Link to={ROUTES.SHOP} className="account-card__quick-link">
                  <span className="account-card__quick-icon" aria-hidden="true">
                    <TruckIcon size={16} />
                  </span>
                  <span className="account-card__quick-copy">
                    <strong>Shop</strong>
                    <em>Browse products</em>
                  </span>
                  <ArrowRightIcon size={14} className="account-card__quick-chevron" />
                </Link>
              </div>

              <div className="account-card__actions">
                <Link to={ROUTES.ORDERS} className="btn-hero-primary">
                  View my orders
                </Link>
                <button
                  type="button"
                  className="account-card__logout"
                  onClick={logout}
                >
                  <LogOutIcon size={15} />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

export const OrdersPage = () => {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeOrderId, setActiveOrderId] = useState(null)
  const [showAllItems, setShowAllItems] = useState(false)
  const [invoiceDownloading, setInvoiceDownloading] = useState(false)

  const loadOrders = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    setError('')
    try {
      const apiOrders = await fetchMyOrders()
      setOrders(apiOrders)
      syncOrdersForUser(user, apiOrders)
    } catch (err) {
      const cached = getOrdersForUser(user)
      if (cached.length) {
        setOrders(cached)
        setError(
          `${err.message || 'Could not sync'} · showing last saved on this device`
        )
      } else {
        setOrders([])
        setError(err.message || 'Could not load orders from server')
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  // Keep fulfilment live while My orders is open
  useEffect(() => {
    const onFocus = () => loadOrders({ silent: true })
    const onVis = () => {
      if (document.visibilityState === 'visible') loadOrders({ silent: true })
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)
    const poll = window.setInterval(() => loadOrders({ silent: true }), 20000)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
      window.clearInterval(poll)
    }
  }, [loadOrders])

  const activeOrder = useMemo(
    () =>
      orders.find(
        (order) => order.id === activeOrderId || order.apiId === activeOrderId
      ) || null,
    [orders, activeOrderId]
  )

  const activity = useMemo(
    () => (activeOrder ? buildDeliveryActivity(activeOrder) : []),
    [activeOrder]
  )

  useEffect(() => {
    if (!activeOrder) return undefined

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e) => {
      if (e.key === 'Escape') setActiveOrderId(null)
    }
    document.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [activeOrder])

  const activeItems = activeOrder?.items || []
  const activeItemCount = activeItems.reduce(
    (sum, item) => sum + (item.qty || 1),
    0
  )
  const visibleItems = showAllItems ? activeItems : activeItems.slice(0, 2)
  const hiddenItemCount = Math.max(0, activeItems.length - 2)
  const activePayTone = paymentTone(activeOrder)

  const openOrderPopup = (orderId) => {
    setShowAllItems(false)
    setActiveOrderId(orderId)
  }

  const closeOrderPopup = () => {
    setActiveOrderId(null)
    setShowAllItems(false)
  }

  return (
    <>
      <main className="account-page orders-page">
        <div className="breadcrumb-bar">
          <div className="container">
            <Breadcrumb
              items={[
                { label: 'My account', to: ROUTES.ACCOUNT },
                { label: 'My orders' },
              ]}
            />
          </div>
        </div>

        <section className="orders-shell" aria-labelledby="orders-title">
          <div className="container orders-shell__inner">
            <header className="orders-head">
              <div className="orders-head__copy">
                <h1 id="orders-title">My orders</h1>
              </div>
              <div className="orders-head__actions">
                <Link to={ROUTES.SHOP} className="orders-head__shop">
                  Continue shopping
                  <ArrowRightIcon size={15} />
                </Link>
              </div>
            </header>

            {error && (
              <p className="orders-sync-note" role="status">
                {error}
              </p>
            )}

            {!loading && orders.length === 0 ? (
              <div className="orders-empty">
                <span className="orders-empty__icon" aria-hidden="true">
                  <PackageIcon size={26} />
                </span>
                <h2>No orders yet</h2>
                <p>
                  When you place an order, it will show up here with status,
                  items, and delivery details.
                </p>
                <div className="orders-empty__actions">
                  <Link to={ROUTES.SHOP} className="btn-hero-primary">
                    Start shopping
                  </Link>
                  <Link to={ROUTES.ACCOUNT} className="orders-empty__ghost">
                    Back to account
                  </Link>
                </div>
              </div>
            ) : (
              <ul className="orders-list">
                {orders.map((order) => {
                  const items = order.items || []
                  const preview = items.slice(0, 2)
                  const extra = Math.max(0, items.length - preview.length)
                  const itemCount = items.reduce(
                    (sum, item) => sum + (item.qty || 1),
                    0
                  )

                  return (
                    <li key={order.apiId || order.id} className="order-card">
                      <div className="order-card__main">
                        <button
                          type="button"
                          className="order-card__thumbs"
                          aria-label={`Open order ${order.id}`}
                          onClick={() => openOrderPopup(order.id)}
                        >
                          {preview.map((item, idx) => {
                            const thumb = resolveItemImage(item)
                            return thumb ? (
                              <img
                                key={`${order.id}-thumb-${item.id || idx}`}
                                src={thumb}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                style={{ zIndex: preview.length - idx }}
                              />
                            ) : (
                              <span
                                key={`${order.id}-thumb-${idx}`}
                                className="order-card__thumb-fallback"
                                style={{ zIndex: preview.length - idx }}
                              >
                                <PackageIcon size={14} />
                              </span>
                            )
                          })}
                          {extra > 0 && (
                            <span className="order-card__thumb-more">
                              +{extra}
                            </span>
                          )}
                        </button>

                        <div className="order-card__info">
                          <button
                            type="button"
                            className="order-card__top"
                            onClick={() => openOrderPopup(order.id)}
                          >
                            <div>
                              <span className="order-card__id">{order.id}</span>
                              <p className="order-card__date">
                                {formatDateTime(order.createdAt)}
                                {order.city
                                  ? ` · ${order.city}${
                                      order.state ? `, ${order.state}` : ''
                                    }`
                                  : ''}
                              </p>
                            </div>
                            <span
                              className={`order-card__status ${statusClass(
                                order.status
                              )}`}
                            >
                              {statusText(order)}
                            </span>
                          </button>

                          <ul className="order-card__names">
                            {preview.map((item, idx) => (
                              <li key={`${order.id}-name-${item.id || idx}`}>
                                <button
                                  type="button"
                                  className="order-card__name-btn"
                                  onClick={() => openOrderPopup(order.id)}
                                >
                                  {item.name}
                                  {item.size ? ` · ${item.size}` : ''}
                                  {(item.qty || 1) > 1
                                    ? ` ×${item.qty}`
                                    : ''}
                                </button>
                              </li>
                            ))}
                            {extra > 0 && (
                              <li>
                                <button
                                  type="button"
                                  className="order-card__names-more"
                                  onClick={() => openOrderPopup(order.id)}
                                >
                                  +{extra} more
                                </button>
                              </li>
                            )}
                          </ul>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="order-card__foot"
                        onClick={() => openOrderPopup(order.id)}
                      >
                        <span>
                          {itemCount} item{itemCount === 1 ? '' : 's'}
                        </span>
                        <span>{paymentLabel(order.payment)}</span>
                        <strong>{formatPrice(order.total)}</strong>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>
      </main>

      {activeOrder && (
        <div
          className="orders-detail-popup"
          role="dialog"
          aria-modal="true"
          aria-labelledby="orders-detail-title"
        >
          <button
            type="button"
            className="orders-detail-popup__backdrop"
            aria-label="Close order details"
            onClick={closeOrderPopup}
          />
          <div className="orders-detail-popup__panel">
            <header className="orders-detail-popup__head">
              <div className="orders-detail-popup__head-main">
                <div className="orders-detail-popup__title-row">
                  <p className="orders-detail-popup__eyebrow">Order details</p>
                  <span
                    className={`order-card__status ${statusClass(
                      activeOrder.status
                    )}`}
                  >
                    {statusText(activeOrder)}
                  </span>
                </div>
                <h2 id="orders-detail-title">{activeOrder.id}</h2>
                <p className="orders-detail-popup__date">
                  Placed {formatDateTime(activeOrder.createdAt)}
                </p>
              </div>
              <button
                type="button"
                className="orders-detail-popup__close"
                aria-label="Close"
                onClick={closeOrderPopup}
              >
                <CloseIcon size={24} />
              </button>
            </header>

            <div className="orders-detail-popup__content">
              <div className="orders-detail-popup__tracking-column">
                <p className="orders-detail-popup__section-label">Items</p>
                <ul className="orders-detail-popup__items">
                  {visibleItems.map((item, idx) => {
                    const img = resolveItemImage(item)
                    return (
                      <li key={`${activeOrder.id}-popup-${item.id || idx}`}>
                        {img ? (
                          <img
                            src={img}
                            alt=""
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <span className="orders-detail-popup__fallback">
                            <PackageIcon size={16} />
                          </span>
                        )}
                        <div className="orders-detail-popup__item-copy">
                          <div className="orders-detail-popup__item-row">
                            <strong>{item.name}</strong>
                            <span>
                              {item.size ? `${item.size} · ` : ''}
                              Qty {item.qty || 1}
                            </span>
                          </div>
                          <em className="orders-detail-popup__item-price">
                            {formatPrice(item.price * (item.qty || 1))}
                          </em>
                        </div>
                      </li>
                    )
                  })}
                  {hiddenItemCount > 0 && (
                    <li className="orders-detail-popup__more-row">
                      <button
                        type="button"
                        className="orders-detail-popup__more"
                        onClick={() => setShowAllItems((open) => !open)}
                      >
                        {showAllItems
                          ? 'Show less'
                          : `+${hiddenItemCount} more`}
                      </button>
                    </li>
                  )}
                </ul>

                {activeOrder.status !== 'cancelled' && (
                  <section
                    className="orders-track"
                    aria-label="PahadLink delivery tracking"
                  >
                    <header className="orders-track__head">
                      <TruckIcon size={14} aria-hidden="true" />
                      <span>Track package</span>
                    </header>
                    <ol
                      className="orders-track__timeline"
                      aria-label="Order updates"
                    >
                      {activity.map((ev, idx) => {
                        const title =
                          ev.label ||
                          STATUS_LABELS[ev.status] ||
                          'Update'
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
                            key={`${ev.status}-${ev.at || idx}`}
                            className={`${stateClass}${
                              connectorFilled ? ' is-filled' : ''
                            }`}
                          >
                            <span
                              className="orders-track__timeline-dot"
                              aria-hidden="true"
                            >
                              {ev.isUpcoming ? null : (
                                <CheckIcon size={9} />
                              )}
                            </span>
                            <div className="orders-track__timeline-copy">
                              <div className="orders-track__timeline-row">
                                <strong>{title}</strong>
                                {stamp ? (
                                  <time dateTime={ev.at}>{stamp}</time>
                                ) : null}
                              </div>
                              {subtext ? (
                                <p className="orders-track__subtext">
                                  {subtext}
                                </p>
                              ) : null}
                            </div>
                          </li>
                        )
                      })}
                    </ol>
                  </section>
                )}

                {activeOrder.status === 'cancelled' && (
                  <div className="orders-track__banner is-cancelled">
                    <p className="orders-track__brand">PahadLink delivery</p>
                    <strong className="orders-track__headline">
                      Order cancelled
                    </strong>
                  </div>
                )}

                {(activeOrder.trackingNumber || activeOrder.courier) && (
                  <div className="orders-detail-popup__track-card">
                    <TruckIcon size={16} />
                    <div>
                      <span>Shipment · PahadLink</span>
                      <strong>
                        {activeOrder.courier || 'Courier'}
                        {activeOrder.trackingNumber
                          ? ` · ${activeOrder.trackingNumber}`
                          : ''}
                      </strong>
                    </div>
                  </div>
                )}
              </div>

              <div className="orders-detail-popup__body">
                <div className="orders-detail-popup__info-card orders-detail-popup__info-card--address">
                  <span>Deliver to</span>
                  <strong>
                    {activeOrder.city || '—'}
                    {activeOrder.state ? `, ${activeOrder.state}` : ''}
                  </strong>
                  <em>
                    {[activeOrder.address, activeOrder.pincode]
                      .filter(Boolean)
                      .join(' · ') ||
                      `${activeItemCount} item${activeItemCount === 1 ? '' : 's'}`}
                  </em>
                </div>

                <div
                  className={`orders-detail-popup__pay-card ${activePayTone}`}
                >
                  <span
                    className="orders-detail-popup__pay-icon"
                    aria-hidden="true"
                  >
                    {createElement(paymentIcon(activeOrder?.payment), { size: 22 })}
                  </span>
                  <div className="orders-detail-popup__pay-copy">
                    <span>Payment</span>
                    <strong>{paymentLabel(activeOrder.payment)}</strong>
                  </div>
                  <em className={activePayTone}>
                    {paymentStatusLabel(activeOrder)}
                  </em>
                </div>

                <p className="orders-detail-popup__section-label">
                  Price details
                </p>
                <div className="orders-detail-popup__totals">
                  <div>
                    <span>Subtotal</span>
                    <strong>
                      {formatPrice(
                        itemsSubtotal(activeItems) ||
                          Number(activeOrder.total || 0) -
                            Number(activeOrder.shipping || 0) +
                            Number(activeOrder.discount || 0)
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Shipping</span>
                    <strong>
                      {Number(activeOrder.shipping || 0) === 0
                        ? 'Free'
                        : formatPrice(activeOrder.shipping)}
                    </strong>
                  </div>
                  {Number(activeOrder.discount || 0) > 0 && (
                    <div className="is-discount">
                      <span>
                        Discount
                        {activeOrder.couponCode
                          ? ` (${activeOrder.couponCode})`
                          : ''}
                      </span>
                      <strong>-{formatPrice(activeOrder.discount)}</strong>
                    </div>
                  )}
                  {(() => {
                    const subtotal =
                      itemsSubtotal(activeItems) ||
                      Number(activeOrder.total || 0) -
                        Number(activeOrder.shipping || 0) +
                        Number(activeOrder.discount || 0)
                    const shipping = Number(activeOrder.shipping || 0)
                    const discount = Number(activeOrder.discount || 0)
                    const taxableBase = Math.max(0, subtotal - discount + shipping)
                    const fallback = buildGstBreakdown(taxableBase, {
                      shippingState: activeOrder.state || '',
                    })
                    const gstType = activeOrder.gstType || fallback.gstType
                    const cgst =
                      activeOrder.cgstAmount != null
                        ? Number(activeOrder.cgstAmount)
                        : fallback.cgstAmount
                    const sgst =
                      activeOrder.sgstAmount != null
                        ? Number(activeOrder.sgstAmount)
                        : fallback.sgstAmount
                    const igst =
                      activeOrder.igstAmount != null
                        ? Number(activeOrder.igstAmount)
                        : fallback.igstAmount
                    const ratePct =
                      activeOrder.gstRate != null
                        ? Math.round(Number(activeOrder.gstRate) * 1000) / 10
                        : GST_RATE_PERCENT
                    return gstType === 'igst' ? (
                      <div>
                        <span>IGST ({ratePct}%)</span>
                        <strong>{formatPrice(igst)}</strong>
                      </div>
                    ) : (
                      <>
                        <div>
                          <span>CGST ({ratePct / 2}%)</span>
                          <strong>{formatPrice(cgst)}</strong>
                        </div>
                        <div>
                          <span>SGST ({ratePct / 2}%)</span>
                          <strong>{formatPrice(sgst)}</strong>
                        </div>
                      </>
                    )
                  })()}
                  <div className="orders-detail-popup__total">
                    <span>
                      {activeOrder.paymentStatus === 'paid' ||
                      activeOrder.status === 'delivered'
                        ? 'Total amount'
                        : 'Order total'}{' '}
                      (incl. GST)
                    </span>
                    <strong>{formatPrice(activeOrder.total)}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  className="orders-detail-popup__invoice-link"
                  disabled={invoiceDownloading}
                  onClick={async () => {
                    if (!activeOrder) return
                    setInvoiceDownloading(true)
                    try {
                      await downloadOrderInvoice(activeOrder)
                    } finally {
                      setInvoiceDownloading(false)
                    }
                  }}
                >
                  <DownloadIcon size={14} />
                  {invoiceDownloading ? 'Preparing PDF…' : 'Download PDF invoice'}
                </button>

                {activeOrder.review?.rating && (
                  <p className="orders-detail-popup__review">
                    Your review: <strong>{activeOrder.review.rating}/5</strong>
                    {activeOrder.review.comment
                      ? ` — ${activeOrder.review.comment}`
                      : ''}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  )
}
