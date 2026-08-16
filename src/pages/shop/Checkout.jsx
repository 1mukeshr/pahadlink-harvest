import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Breadcrumb from '../../components/layout/Breadcrumb'
import Footer from '../../components/layout/Footer'
import {
  CheckCircleIcon,
  CloseIcon,
  GiftIcon,
  ShieldIcon,
  TruckIcon,
  CartIcon,
  ChevronDownIcon,
} from '../../components/icons'
import googlePayIcon from '../../assets/images/payments/google-pay.svg'
import phonePeIcon from '../../assets/images/payments/phonepe.svg'
import paytmIcon from '../../assets/images/payments/paytm.svg'
import { ROUTES, STORAGE, productPath, MAX_QTY_PER_ITEM_PER_CUSTOMER } from '../../config'
import { useAuth } from '../../context/AuthContext'
import { useShop } from '../../context/ShopContext'
import { saveOrder } from '../../utils/ordersStorage'
import {
  createOrder,
  validateCoupon,
  mapApiOrderToUi,
  fetchMyOrders,
  fetchFirstOrderStatus,
} from '../../services/orderService'
import {
  ADDRESSES_EVENT,
  INDIA_STATES,
  LOCATION_EVENT,
  clearResumeCheckout,
  getPreferredDeliveryAddress,
  hasCompleteShippingAddress,
  listAddresses,
  locationToCheckoutFields,
  matchState,
  readLocation,
  requestOpenAddressPicker,
  selectAddress,
  upsertAddress,
} from '../../utils/locationStorage'
import {
  digitsPhone,
  firstCheckoutErrorField,
  mobileValidationMessage,
  validateCheckoutForm,
} from '../../utils/checkoutValidation'
import {
  FREE_SHIP_AT,
  FIRST_ORDER_DISCOUNT,
  SHIPPING_FEE,
  applyCoupon,
  calcShipping,
  normalizeCouponCode,
  welcomeDiscount,
} from '../../data/coupons'
import {
  GST_RATE_PERCENT,
  buildGstBreakdown,
} from '../../data/gst'

const ORDER_POPUP_MS = 20000
const COLLAPSED_BAG_ITEM_COUNT = 2

const STATES = INDIA_STATES

const PAYMENTS = [
  {
    id: 'upi',
    title: 'UPI',
    short: 'Pay by any UPI app',
    desc: '',
    brands: [
      { id: 'gpay', label: 'Google Pay', src: googlePayIcon },
      { id: 'phonepe', label: 'PhonePe', src: phonePeIcon },
      { id: 'paytm', label: 'Paytm', src: paytmIcon },
    ],
  },
  {
    id: 'cod',
    title: 'Cash on Delivery',
    short: 'Pay when your order arrives',
    desc: 'Available for most pincodes.',
  },
]

const formatPrice = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

const makeOrderId = () => `PAHADLINK-TEMP-${Date.now().toString().slice(-6)}`

const readJson = (key) => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const parseLocation = (location) => locationToCheckoutFields(location)

const buildInitialForm = (user) => {
  const saved = readJson(STORAGE.CHECKOUT_ADDRESS) || {}
  const preferred = getPreferredDeliveryAddress()
  const fromLoc = parseLocation(preferred)
  const state =
    fromLoc.state && STATES.includes(fromLoc.state)
      ? fromLoc.state
      : saved.state && STATES.includes(saved.state)
        ? saved.state
        : 'Uttarakhand'

  return {
    name: user?.name || fromLoc.name || saved.name || '',
    email: user?.email || saved.email || '',
    phone: user?.phone || fromLoc.phone || saved.phone || '',
    address: fromLoc.address || saved.address || '',
    landmark: fromLoc.landmark || saved.landmark || '',
    city: fromLoc.city || saved.city || '',
    state,
    pincode: fromLoc.pincode || saved.pincode || '',
    notes: '',
    addressId: fromLoc.addressId || '',
    tag: fromLoc.tag || 'Home',
  }
}

/** Merge location/user into checkout form — fill blanks; keep typed values */
const mergeAddressIntoForm = (prev, fields, user) => ({
  ...prev,
  name: prev.name || user?.name || fields.name || '',
  email: prev.email || user?.email || '',
  phone: prev.phone || fields.phone || user?.phone || '',
  address: prev.address || fields.address || '',
  landmark: prev.landmark || fields.landmark || '',
  city: prev.city || fields.city || '',
  state: prev.state || matchState(fields.state) || 'Uttarakhand',
  pincode: prev.pincode || fields.pincode || '',
  addressId: prev.addressId || fields.addressId || '',
  tag: prev.tag || fields.tag || 'Home',
})

const applyAddressToForm = (prev, fields, user, { force = false } = {}) => {
  if (!force) return mergeAddressIntoForm(prev, fields, user)
  return {
    ...prev,
    name: fields.name || user?.name || prev.name,
    email: user?.email || prev.email,
    phone: fields.phone || user?.phone || prev.phone,
    address: fields.address || '',
    landmark: fields.landmark || '',
    city: fields.city || '',
    state: matchState(fields.state) || prev.state || 'Uttarakhand',
    pincode: fields.pincode || '',
    addressId: fields.addressId || '',
    tag: fields.tag || 'Home',
  }
}

const persistAddress = (form) => {
  try {
    localStorage.setItem(
      STORAGE.CHECKOUT_ADDRESS,
      JSON.stringify({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        landmark: form.landmark.trim(),
        city: form.city.trim(),
        state: form.state,
        pincode: form.pincode.trim(),
      })
    )
    // Upsert into saved delivery addresses + set as active
    upsertAddress(
      {
        id: form.addressId || null,
        tag: form.tag || 'Home',
        name: form.name.trim(),
        phone: form.phone.trim(),
        line1: form.address.trim(),
        landmark: form.landmark.trim(),
        city: form.city.trim(),
        state: form.state,
        pin: form.pincode.trim(),
        source: 'checkout',
      },
      { select: true }
    )
  } catch {
    /* ignore quota */
  }
}

const Checkout = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    cart,
    cartCount,
    cartTotal,
    updateCartQty,
    removeFromCart,
    clearCart,
    closeCart,
    openCart,
    getCartQtyForProduct,
  } = useShop()

  const [form, setForm] = useState(() => buildInitialForm(user))
  const [savedAddresses, setSavedAddresses] = useState(() => listAddresses())
  const [payment, setPayment] = useState('')
  const [errors, setErrors] = useState({})
  const [placing, setPlacing] = useState(false)
  const [order, setOrder] = useState(null)
  const [showNote, setShowNote] = useState(false)
  const [placeError, setPlaceError] = useState('')
  const [couponInput, setCouponInput] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [couponError, setCouponError] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)
  const [showAllBagItems, setShowAllBagItems] = useState(false)
  const [isFirstOrder, setIsFirstOrder] = useState(true)

  const hiddenBagItemCount = Math.max(0, cart.length - COLLAPSED_BAG_ITEM_COUNT)
  const visibleBagItems = showAllBagItems
    ? cart
    : cart.slice(0, COLLAPSED_BAG_ITEM_COUNT)

  const refreshSavedAddresses = useCallback(() => {
    setSavedAddresses(listAddresses())
  }, [])

  // After login → checkout: fill name/email + preferred delivery address
  useEffect(() => {
    if (!user) return
    const preferred = getPreferredDeliveryAddress()
    const fields = locationToCheckoutFields(preferred)
    setForm((prev) => {
      const needsAddress = !prev.address || !prev.city || !prev.pincode
      return applyAddressToForm(prev, fields, user, {
        force: needsAddress && Boolean(fields.address || fields.city || fields.pincode),
      })
    })
    refreshSavedAddresses()
  }, [user?.id, user?.email, user?.name, user?.phone, refreshSavedAddresses])

  // Returning customer: fill gaps from last delivered/shipped order address
  useEffect(() => {
    if (!user) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const orders = await fetchMyOrders()
        if (cancelled || !orders?.length) return
        const last = orders.find(
          (o) => o.address || o.city || o.pincode
        )
        if (!last) return
        setForm((prev) => {
          if (prev.address && prev.city && prev.pincode) return prev
          return {
            ...prev,
            name: prev.name || last.name || user.name || '',
            phone: prev.phone || last.phone || user.phone || '',
            email: prev.email || last.email || user.email || '',
            address: prev.address || last.address || '',
            city: prev.city || last.city || '',
            state: matchState(prev.state || last.state) || prev.state,
            pincode: prev.pincode || last.pincode || '',
          }
        })
      } catch {
        /* offline — keep local address book */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  // Live-sync header location / address book → checkout fields
  useEffect(() => {
    const applyLocation = (detail, { force = false } = {}) => {
      const fields = locationToCheckoutFields(
        detail || getPreferredDeliveryAddress()
      )
      if (!fields.address && !fields.city && !fields.pincode) return
      setForm((prev) => applyAddressToForm(prev, fields, user, { force }))
      refreshSavedAddresses()
    }

    const onCustom = (e) => applyLocation(e.detail, { force: true })
    const onAddresses = () => {
      refreshSavedAddresses()
      applyLocation(readLocation(), { force: false })
    }
    const onStorage = (e) => {
      if (e.key === STORAGE.LOCATION || e.key === STORAGE.ADDRESSES) {
        try {
          applyLocation(
            e.key === STORAGE.LOCATION && e.newValue
              ? JSON.parse(e.newValue)
              : readLocation(),
            { force: e.key === STORAGE.LOCATION }
          )
        } catch {
          /* ignore */
        }
      }
    }

    window.addEventListener(LOCATION_EVENT, onCustom)
    window.addEventListener(ADDRESSES_EVENT, onAddresses)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(LOCATION_EVENT, onCustom)
      window.removeEventListener(ADDRESSES_EVENT, onAddresses)
      window.removeEventListener('storage', onStorage)
    }
  }, [user, refreshSavedAddresses])

  const pickSavedAddress = (addr) => {
    const selected = selectAddress(addr)
    const fields = locationToCheckoutFields(selected || addr)
    setForm((prev) => applyAddressToForm(prev, fields, user, { force: true }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next.address
      delete next.city
      delete next.pincode
      delete next.phone
      return next
    })
    refreshSavedAddresses()
  }

  const dismissOrderPopup = useCallback(() => {
    setOrder(null)
    navigate(ROUTES.SHOP, { replace: true })
  }, [navigate])

  useEffect(() => {
    if (!order) return undefined
    const timer = window.setTimeout(dismissOrderPopup, ORDER_POPUP_MS)
    return () => window.clearTimeout(timer)
  }, [order, dismissOrderPopup])

  useEffect(() => {
    if (!order) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') dismissOrderPopup()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [order, dismissOrderPopup])

  // Location + address required before checkout — phone is collected here
  useEffect(() => {
    if (order) return
    if (hasCompleteShippingAddress()) {
      clearResumeCheckout()
      return
    }
    navigate(ROUTES.HOME, { replace: true })
    requestOpenAddressPicker({
      message:
        'Add your current location and delivery address to continue checkout. Mobile number is required before placing the order.',
      resumeCheckout: true,
    })
  }, [navigate, order])

  // First order for every customer: free delivery (+ ₹75 welcome on server)
  useEffect(() => {
    const email = (form.email || user?.email || '').trim().toLowerCase()
    let cancelled = false
    ;(async () => {
      try {
        const first = await fetchFirstOrderStatus(email)
        if (!cancelled) setIsFirstOrder(first)
      } catch {
        // Fail open: new customers must get free delivery
        if (!cancelled) setIsFirstOrder(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [form.email, user?.email])

  const shipping = calcShipping(cartTotal, { isFirstOrder })
  const autoWelcome = welcomeDiscount(cartTotal, { isFirstOrder })
  const discount = Math.max(appliedCoupon?.discount || 0, autoWelcome)
  const taxableValue = Math.max(0, cartTotal - discount + shipping)
  const gst = useMemo(
    () =>
      buildGstBreakdown(taxableValue, {
        shippingState: form.state || '',
      }),
    [taxableValue, form.state]
  )
  const payable = gst.taxableValue + gst.gstAmount
  const shipLeft = Math.max(0, FREE_SHIP_AT - cartTotal)
  const shipProgress = Math.min(100, Math.round((cartTotal / FREE_SHIP_AT) * 100))

  /** Allow click so missing phone / fields show validation (not only disabled state) */
  const canAttemptOrder = Boolean(cart.length) && Boolean(payment) && !placing

  useEffect(() => {
    if (!appliedCoupon?.code) return
    const code = appliedCoupon.code
    const refreshed = applyCoupon(cartTotal, code, { isFirstOrder })
    if (!refreshed.ok) {
      setAppliedCoupon(null)
      setCouponError(refreshed.message)
      return
    }
    setAppliedCoupon((prev) =>
      prev && prev.discount === refreshed.discount && prev.code === refreshed.code
        ? prev
        : refreshed
    )
  }, [cartTotal, isFirstOrder]) // eslint-disable-line react-hooks/exhaustive-deps

  const onApplyCoupon = async (e) => {
    e?.preventDefault?.()
    const code = normalizeCouponCode(couponInput)
    setCouponError('')
    if (!code) {
      setCouponError('Enter a coupon code')
      return
    }
    if (!cartTotal) {
      setCouponError('Add items to bag before applying a coupon')
      return
    }

    setCouponLoading(true)
    try {
      const result = await validateCoupon({
        code,
        subtotal: cartTotal,
        email: form.email.trim(),
      })
      setAppliedCoupon(result)
      setCouponInput(result.code || code)
      setCouponError('')
    } catch (err) {
      // Offline: only preview non–first-order coupons (server owns first-order checks)
      const local = applyCoupon(cartTotal, code, { isFirstOrder: false })
      if (
        local.ok &&
        /API|server|reach/i.test(err.message || '')
      ) {
        setAppliedCoupon(local)
        setCouponInput(local.code)
        setCouponError('')
      } else {
        setAppliedCoupon(null)
        setCouponError(
          err.message ||
            local.message ||
            'Could not validate coupon — check connection and try again'
        )
      }
    } finally {
      setCouponLoading(false)
    }
  }

  const onRemoveCoupon = () => {
    setAppliedCoupon(null)
    setCouponInput('')
    setCouponError('')
  }

  const onChange = (e) => {
    const { name, value } = e.target
    const nextValue =
      name === 'phone' ? digitsPhone(value) : value
    setForm((prev) => ({ ...prev, [name]: nextValue }))
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  const focusCheckoutField = (name) => {
    const el = document.querySelector(
      `#checkout-form [name="${name}"], .checkout-page [name="${name}"]`
    )
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (typeof el.focus === 'function') {
      window.setTimeout(() => el.focus({ preventScroll: true }), 280)
    }
  }

  const validate = () => {
    const next = validateCheckoutForm(
      form,
      payment,
      PAYMENTS.map((p) => p.id)
    )
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const placeOrder = async (e) => {
    e?.preventDefault?.()
    if (!cart.length || placing) return

    if (!payment) {
      setErrors((prev) => ({ ...prev, payment: 'Select a payment method' }))
      setPlaceError('Select a payment method before placing the order')
      return
    }

    const phoneMsg = mobileValidationMessage(form.phone)
    if (phoneMsg) {
      setPlaceError('')
      validate()
      focusCheckoutField('phone')
      return
    }

    const fieldErrors = validateCheckoutForm(
      form,
      payment,
      PAYMENTS.map((p) => p.id)
    )
    if (Object.keys(fieldErrors).length) {
      setErrors(fieldErrors)
      setPlaceError('')
      focusCheckoutField(firstCheckoutErrorField(fieldErrors))
      return
    }

    setPlacing(true)
    setPlaceError('')

    const phone = digitsPhone(form.phone)
    const localId = makeOrderId()
    const placed = {
      id: localId,
      payment,
      total: payable,
      shipping,
      discount,
      couponCode: appliedCoupon?.code || '',
      itemCount: cart.reduce((sum, item) => sum + (item.qty || 1), 0),
      items: cart.map((item) => ({
        id: item.id,
        name: item.name,
        qty: item.qty || 1,
        price: item.price,
        size: item.size,
        image: item.image,
      })),
      email: form.email.trim().toLowerCase(),
      userEmail: (user?.email || form.email).trim().toLowerCase(),
      userId: user?.id || user?._id || null,
      name: form.name.trim(),
      phone,
      city: form.city.trim(),
      state: form.state,
      pincode: String(form.pincode || '')
        .replace(/\D/g, '')
        .slice(0, 6),
      address: form.address.trim(),
      landmark: form.landmark.trim(),
      notes: form.notes.trim(),
      createdAt: new Date().toISOString(),
      status: 'pending',
    }

    try {
      const apiOrder = await createOrder({
        customerName: placed.name,
        customerEmail: placed.email,
        customerPhone: placed.phone,
        paymentMethod: payment,
        couponCode: appliedCoupon?.code || '',
        notes: [placed.notes, placed.landmark ? `Landmark: ${placed.landmark}` : '']
          .filter(Boolean)
          .join('\n'),
        shippingAddress: {
          line1: placed.address,
          city: placed.city,
          state: placed.state,
          pincode: placed.pincode,
        },
        items: placed.items.map((item) => ({
          productId: item.id,
          name: item.name,
          size: item.size || '',
          quantity: item.qty || 1,
          price: item.price,
        })),
      })

      let saved = placed
      if (apiOrder?.orderNumber || apiOrder?.id) {
        saved = {
          ...mapApiOrderToUi(apiOrder),
          // Keep cart images when API has no image URLs
          items: (mapApiOrderToUi(apiOrder).items || []).map((item, i) => ({
            ...item,
            image: item.image || placed.items[i]?.image || '',
          })),
        }
      }

      persistAddress(form)
      saveOrder(saved)
      setOrder({
        id: saved.id,
        payment: saved.payment,
        total: saved.total,
        shipping: saved.shipping,
        items: saved.itemCount,
        email: saved.email,
        paymentStatus: saved.paymentStatus,
        status: saved.status,
      })
      clearCart()
      closeCart()
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    } catch (err) {
      setPlaceError(err.message || 'Could not place order. Is the API running?')
    } finally {
      setPlacing(false)
    }
  }

  const breadcrumbItems = useMemo(
    () => [{ label: 'Shop', to: ROUTES.SHOP }, { label: 'Checkout' }],
    []
  )

  if (order) {
    const paymentLabel =
      PAYMENTS.find((p) => p.id === order.payment)?.title || 'Checkout'

    return (
      <>
        <main className="checkout-page checkout-page--done">
          <div className="breadcrumb-bar">
            <div className="container">
              <Breadcrumb items={breadcrumbItems} />
            </div>
          </div>
          <section className="checkout-done">
            <div className="container checkout-done__inner">
              <h1>Order placed</h1>
              <p>You can keep shopping while we prepare your order.</p>
              <Link to={ROUTES.SHOP} className="btn-hero-primary">
                Continue shopping
              </Link>
            </div>
          </section>
        </main>
        <Footer />

        <div
          className="order-popup"
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-popup-title"
        >
          <button
            type="button"
            className="order-popup__backdrop"
            aria-label="Close order confirmation"
            onClick={dismissOrderPopup}
          />
          <div className="order-popup__panel">
            <div
              className="order-popup__timer"
              style={{ animationDuration: `${ORDER_POPUP_MS}ms` }}
              aria-hidden="true"
            />
            <button
              type="button"
              className="order-popup__close"
              aria-label="Close"
              onClick={dismissOrderPopup}
            >
              <CloseIcon size={14} />
            </button>

            <p className="order-popup__brand">PahadLink</p>

            <span className="order-popup__icon" aria-hidden="true">
              <CheckCircleIcon size={28} />
            </span>

            <p className="order-popup__kicker">Order confirmed</p>
            <h2 id="order-popup-title">Thank you</h2>
            <p className="order-popup__lead">
              {order.email ? (
                <>
                  Receipt sent to <strong>{order.email}</strong>
                </>
              ) : (
                <>Your pahadi order is confirmed and being packed.</>
              )}
            </p>

            <p className="order-popup__id">
              <span>Order</span>
              <strong>{order.id}</strong>
            </p>

            <dl className="order-popup__meta">
              <div>
                <dt>Payment</dt>
                <dd>{paymentLabel}</dd>
              </div>
              <div>
                <dt>Items</dt>
                <dd>{order.items}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>{formatPrice(order.total)}</dd>
              </div>
            </dl>

            <div className="order-popup__actions">
              <Link to={ROUTES.ORDERS} className="btn-hero-primary">
                View my orders
              </Link>
              <button
                type="button"
                className="order-popup__ghost"
                onClick={dismissOrderPopup}
              >
                Continue shopping
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  if (!cart.length) {
    return (
      <>
        <main className="checkout-page">
          <div className="breadcrumb-bar">
            <div className="container">
              <Breadcrumb items={breadcrumbItems} />
            </div>
          </div>
          <section className="checkout-empty">
            <div className="container checkout-empty__inner">
              <span className="checkout-empty__icon" aria-hidden="true">
                <CartIcon size={30} />
              </span>
              <h1>Your bag is empty</h1>
              <p>Add pahadi favourites, then come back to checkout.</p>
              <Link to={ROUTES.SHOP} className="btn-hero-primary">
                Browse shop
              </Link>
            </div>
          </section>
        </main>
        <Footer />
      </>
    )
  }

  return (
    <>
      <main className="checkout-page checkout-page--bag">
        <div className="breadcrumb-bar">
          <div className="container">
            <Breadcrumb items={breadcrumbItems} />
          </div>
        </div>

        <section className="checkout-shell" aria-label="Checkout">
          <div className="container checkout-shell__inner">
            <header className="checkout-top">
              <div>
                <h1>
                  Checkout
                  <em>
                    · {cartCount} item{cartCount === 1 ? '' : 's'}
                  </em>
                </h1>
              </div>
              <nav className="checkout-steps" aria-label="Checkout steps">
                <span className="is-active">Bag</span>
                <i aria-hidden="true" />
                <span className="is-active">Address</span>
                <i aria-hidden="true" />
                <span className="is-active">Payment</span>
              </nav>
            </header>

            <div className="checkout-shell__grid">
              <div className="checkout-main">
                {isFirstOrder || shipping === 0 ? (
                  <div className="checkout-offer checkout-offer--free">
                    <TruckIcon size={15} />
                    <p>
                      {isFirstOrder ? (
                        <>
                          <strong>First order:</strong> free delivery + ₹
                          {FIRST_ORDER_DISCOUNT} off
                        </>
                      ) : (
                        <>
                          <strong>Free delivery</strong> on this order
                        </>
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="checkout-offer checkout-offer--ship">
                    <TruckIcon size={16} />
                    <p>
                      Delivery <strong>{formatPrice(SHIPPING_FEE)}</strong>
                      {shipLeft > 0 ? (
                        <>
                          {' '}
                          · add <strong>{formatPrice(shipLeft)}</strong> more for
                          free
                        </>
                      ) : null}
                    </p>
                    {shipLeft > 0 ? (
                      <div className="checkout-offer__bar" aria-hidden="true">
                        <span style={{ width: `${shipProgress}%` }} />
                      </div>
                    ) : null}
                  </div>
                )}

                <section className="checkout-card" aria-label="Bag items">
                  <div className="checkout-card__head">
                    <h2>Your bag</h2>
                    <button
                      type="button"
                      className="checkout-card__link"
                      onClick={openCart}
                    >
                      Edit
                    </button>
                  </div>

                  <ul className="checkout-bag">
                    {visibleBagItems.map((item) => (
                      <li key={item.key} className="checkout-bag__item">
                        <Link
                          to={productPath(item.id)}
                          className="checkout-bag__thumb"
                        >
                          <img
                            src={item.image}
                            alt=""
                            loading="lazy"
                            decoding="async"
                          />
                        </Link>
                        <div className="checkout-bag__body">
                          <div className="checkout-bag__row">
                            <div className="checkout-bag__info">
                              <strong>{item.name}</strong>
                              <span>{item.size || 'Standard'}</span>
                            </div>
                            <b>{formatPrice(item.price * item.qty)}</b>
                          </div>
                          <div className="checkout-bag__actions">
                            <div className="checkout-bag__qty">
                              <button
                                type="button"
                                aria-label="Decrease quantity"
                                onClick={() =>
                                  updateCartQty(item.key, item.qty - 1)
                                }
                              >
                                −
                              </button>
                              <em>{item.qty}</em>
                              <button
                                type="button"
                                aria-label="Increase quantity"
                                disabled={
                                  (getCartQtyForProduct?.(item.id) || 0) >=
                                    MAX_QTY_PER_ITEM_PER_CUSTOMER ||
                                  (typeof item.maxStock === 'number' &&
                                    item.qty >= item.maxStock)
                                }
                                onClick={() =>
                                  updateCartQty(item.key, item.qty + 1)
                                }
                              >
                                +
                              </button>
                            </div>
                            <button
                              type="button"
                              className="checkout-bag__remove"
                              onClick={() => removeFromCart(item.key)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>

                  {hiddenBagItemCount > 0 && (
                    <button
                      type="button"
                      className={`checkout-bag__more${
                        showAllBagItems ? ' checkout-bag__more--open' : ''
                      }`}
                      aria-expanded={showAllBagItems}
                      onClick={() => setShowAllBagItems((show) => !show)}
                    >
                      <span>
                        {showAllBagItems
                          ? 'Show less'
                          : `Show ${hiddenBagItemCount} more item${
                              hiddenBagItemCount === 1 ? '' : 's'
                            }`}
                      </span>
                      <ChevronDownIcon size={15} />
                    </button>
                  )}
                </section>

                <form
                  id="checkout-form"
                  className="checkout-form"
                  onSubmit={placeOrder}
                  noValidate
                >
                  <section className="checkout-card">
                    <div className="checkout-card__head">
                      <h2>Delivery address</h2>
                    </div>

                    {savedAddresses.length > 0 && (
                      <div
                        className="checkout-saved"
                        role="listbox"
                        aria-label="Saved delivery addresses"
                      >
                        <p className="checkout-saved__label">
                          Use a saved address
                        </p>
                        <ul className="checkout-saved__list">
                          {savedAddresses.map((addr) => {
                            const active = form.addressId === addr.id
                            return (
                              <li key={addr.id}>
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={active}
                                  className={`checkout-saved__card${
                                    active ? ' is-active' : ''
                                  }`}
                                  onClick={() => pickSavedAddress(addr)}
                                >
                                  <em className="checkout-saved__tag">
                                    {addr.tag || 'Home'}
                                  </em>
                                  <strong>
                                    {addr.line1 || addr.fullAddress || 'Address'}
                                  </strong>
                                  <span>
                                    {[addr.city, addr.state, addr.pin]
                                      .filter(Boolean)
                                      .join(', ')}
                                  </span>
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )}

                    <div className="checkout-fields checkout-fields--2">
                      <label className="checkout-field">
                        <span>Full name</span>
                        <input
                          name="name"
                          value={form.name}
                          onChange={onChange}
                          autoComplete="name"
                          placeholder="Your name"
                        />
                        {errors.name && (
                          <em className="checkout-error">{errors.name}</em>
                        )}
                      </label>
                      <label className="checkout-field">
                        <span>
                          Mobile <em aria-hidden="true">*</em>
                        </span>
                        <input
                          name="phone"
                          value={form.phone}
                          onChange={onChange}
                          autoComplete="tel"
                          inputMode="numeric"
                          placeholder="10-digit mobile"
                          required
                          maxLength={10}
                          aria-required="true"
                        />
                        {errors.phone && (
                          <em className="checkout-error">{errors.phone}</em>
                        )}
                      </label>
                    </div>

                    <label className="checkout-field">
                      <span>Email</span>
                      <input
                        name="email"
                        type="email"
                        value={form.email}
                        onChange={onChange}
                        autoComplete="email"
                        placeholder="you@example.com"
                      />
                      {errors.email && (
                        <em className="checkout-error">{errors.email}</em>
                      )}
                    </label>

                    <label className="checkout-field">
                      <span>Address</span>
                      <textarea
                        name="address"
                        value={form.address}
                        onChange={onChange}
                        rows={2}
                        placeholder="House no., street, area"
                      />
                      {errors.address && (
                        <em className="checkout-error">{errors.address}</em>
                      )}
                    </label>

                    <label className="checkout-field">
                      <span>Landmark (optional)</span>
                      <input
                        name="landmark"
                        value={form.landmark}
                        onChange={onChange}
                        placeholder="Near temple, market…"
                      />
                    </label>

                    <div className="checkout-fields checkout-fields--3">
                      <label className="checkout-field">
                        <span>City</span>
                        <input
                          name="city"
                          value={form.city}
                          onChange={onChange}
                          autoComplete="address-level2"
                          placeholder="City"
                        />
                        {errors.city && (
                          <em className="checkout-error">{errors.city}</em>
                        )}
                      </label>
                      <label className="checkout-field">
                        <span>State</span>
                        <select
                          name="state"
                          value={form.state}
                          onChange={onChange}
                        >
                          {STATES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        {errors.state && (
                          <em className="checkout-error">{errors.state}</em>
                        )}
                      </label>
                      <label className="checkout-field">
                        <span>Pincode</span>
                        <input
                          name="pincode"
                          value={form.pincode}
                          onChange={onChange}
                          inputMode="numeric"
                          autoComplete="postal-code"
                          placeholder="6 digits"
                        />
                        {errors.pincode && (
                          <em className="checkout-error">{errors.pincode}</em>
                        )}
                      </label>
                    </div>

                    {!showNote ? (
                      <button
                        type="button"
                        className="checkout-note-toggle"
                        onClick={() => setShowNote(true)}
                      >
                        + Add delivery note
                      </button>
                    ) : (
                      <label className="checkout-field">
                        <span>Order note (optional)</span>
                        <input
                          name="notes"
                          value={form.notes}
                          onChange={onChange}
                          placeholder="Gift message or delivery note"
                          autoFocus
                        />
                      </label>
                    )}
                  </section>
                </form>
              </div>

              <aside className="checkout-summary" aria-label="Price details">
                <div className="checkout-summary__panel">
                  <section className="checkout-summary__offers">
                    <h2>Offers</h2>
                    {appliedCoupon?.ok || appliedCoupon?.code ? (
                      <div className="checkout-summary__coupon-applied">
                        <span
                          className="checkout-summary__coupon-applied-icon"
                          aria-hidden="true"
                        >
                          <CheckCircleIcon size={18} />
                        </span>
                        <div>
                          <strong>{appliedCoupon.code}</strong>
                          <span>
                            {appliedCoupon.label || appliedCoupon.message}
                          </span>
                        </div>
                        <button type="button" onClick={onRemoveCoupon}>
                          Remove
                        </button>
                      </div>
                    ) : (
                      <form
                        className="checkout-summary__coupon-row"
                        onSubmit={onApplyCoupon}
                      >
                        <span
                          className="checkout-summary__coupon-icon"
                          aria-hidden="true"
                        >
                          <GiftIcon size={16} />
                        </span>
                        <input
                          id="checkout-coupon"
                          type="text"
                          value={couponInput}
                          onChange={(e) => {
                            setCouponInput(e.target.value)
                            if (couponError) setCouponError('')
                          }}
                          placeholder="Enter coupon code"
                          autoComplete="off"
                          spellCheck={false}
                          aria-label="Coupon code"
                        />
                        <button
                          type="submit"
                          disabled={couponLoading || !cart.length}
                        >
                          {couponLoading ? '…' : 'Apply'}
                        </button>
                      </form>
                    )}
                    {couponError && (
                      <p className="checkout-error" role="alert">
                        {couponError}
                      </p>
                    )}
                    {!appliedCoupon?.code && (
                      <div className="checkout-summary__coupon-hint">
                        <span>Try</span>
                        <button
                          type="button"
                          onClick={() => setCouponInput('PAHAD15')}
                        >
                          PAHAD15
                        </button>
                        <button
                          type="button"
                          onClick={() => setCouponInput('HILL50')}
                        >
                          HILL50
                        </button>
                      </div>
                    )}
                  </section>

                  <section className="checkout-summary__pay">
                    <h2>Payment Options</h2>
                    <div
                      className="checkout-pay-mode"
                      role="radiogroup"
                      aria-label="Payment method"
                      aria-required="true"
                    >
                      {PAYMENTS.map((option) => {
                        const active = payment === option.id
                        return (
                          <div
                            key={option.id}
                            className={`checkout-pay-mode__item${
                              active ? ' is-open' : ''
                            }`}
                          >
                            <label className="checkout-pay-mode__opt">
                              <input
                                type="radio"
                                name="payment"
                                value={option.id}
                                checked={active}
                                onChange={() => {
                                  setPayment(option.id)
                                  setErrors((prev) => {
                                    if (!prev.payment) return prev
                                    const next = { ...prev }
                                    delete next.payment
                                    return next
                                  })
                                }}
                              />
                              <span
                                className="checkout-pay-mode__radio"
                                aria-hidden="true"
                              />
                              <span className="checkout-pay-mode__text">
                                <strong>{option.title}</strong>
                                <em>{option.short}</em>
                              </span>
                              <ChevronDownIcon
                                size={16}
                                className="checkout-pay-mode__chevron"
                              />
                            </label>

                            <div
                              className="checkout-pay-mode__panel"
                              id={`pay-panel-${option.id}`}
                              role="region"
                              aria-hidden={!active}
                            >
                              <div className="checkout-pay-mode__panel-inner">
                                {option.brands?.length ? (
                                  <div
                                    className="checkout-pay-mode__brands"
                                    aria-label="Supported UPI apps"
                                  >
                                    {option.brands.map((brand) => (
                                      <span
                                        key={brand.id}
                                        className="checkout-pay-mode__brand"
                                        title={brand.label}
                                        aria-label={brand.label}
                                      >
                                        <img
                                          src={brand.src}
                                          alt=""
                                          width={28}
                                          height={28}
                                          decoding="async"
                                        />
                                      </span>
                                    ))}
                                  </div>
                                ) : option.desc ? (
                                  <span className="checkout-pay-mode__hint">
                                    {option.desc}
                                  </span>
                                ) : null}
                                {option.id === 'cod' ? (
                                  <span className="checkout-pay-mode__badge">
                                    No online payment needed
                                  </span>
                                ) : (
                                  <span className="checkout-pay-mode__badge checkout-pay-mode__badge--secure">
                                    <ShieldIcon size={12} />
                                    Secure payment
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {errors.payment ? (
                      <p className="checkout-error" role="alert">
                        {errors.payment}
                      </p>
                    ) : null}
                  </section>

                  <section className="checkout-summary__price">
                    <h2>Price details</h2>
                    <div className="checkout-summary__totals">
                      <div>
                        <span>Items total</span>
                        <span>{formatPrice(cartTotal)}</span>
                      </div>
                      {discount > 0 && (
                        <div className="checkout-summary__discount">
                          <span>
                            {appliedCoupon?.discount >= autoWelcome
                              ? 'Coupon discount'
                              : 'First-order discount'}
                          </span>
                          <span>−{formatPrice(discount)}</span>
                        </div>
                      )}
                      <div>
                        <span>Delivery</span>
                        <span className={shipping === 0 ? 'is-free' : undefined}>
                          {shipping === 0 ? 'FREE' : formatPrice(shipping)}
                        </span>
                      </div>
                      {gst.gstType === 'igst' ? (
                        <div>
                          <span>IGST ({GST_RATE_PERCENT}%)</span>
                          <span>{formatPrice(gst.igstAmount)}</span>
                        </div>
                      ) : (
                        <>
                          <div>
                            <span>CGST ({GST_RATE_PERCENT / 2}%)</span>
                            <span>{formatPrice(gst.cgstAmount)}</span>
                          </div>
                          <div>
                            <span>SGST ({GST_RATE_PERCENT / 2}%)</span>
                            <span>{formatPrice(gst.sgstAmount)}</span>
                          </div>
                        </>
                      )}
                      <div className="checkout-summary__payable">
                        <span>Total</span>
                        <strong>{formatPrice(payable)}</strong>
                      </div>
                      <p className="checkout-summary__gst-note">
                        Including GST ({GST_RATE_PERCENT}%)
                      </p>
                    </div>
                  </section>

                  {placeError && (
                    <p
                      className="checkout-error checkout-error--block"
                      role="alert"
                    >
                      {placeError}
                    </p>
                  )}

                  <button
                    type="submit"
                    form="checkout-form"
                    className="checkout-summary__cta"
                    disabled={!canAttemptOrder}
                  >
                    {placing
                      ? 'Placing order…'
                      : `Place order · ${formatPrice(payable)}`}
                  </button>
                  <p className="checkout-summary__secure">
                    <ShieldIcon size={13} />
                    PahadLink secure checkout
                    {payment
                      ? ` · ${PAYMENTS.find((p) => p.id === payment)?.title || 'Pay'}`
                      : ' · Select payment to continue'}
                  </p>
                </div>
              </aside>
            </div>
          </div>
        </section>

        <div className="checkout-mobile-bar">
          <div className="checkout-mobile-bar__total">
            <span>Total (incl. GST)</span>
            <strong>{formatPrice(payable)}</strong>
          </div>
          <button type="button" disabled={!canAttemptOrder} onClick={placeOrder}>
            {placing ? 'Placing…' : 'Place order'}
          </button>
        </div>
      </main>
      <Footer />
    </>
  )
}

export default Checkout
