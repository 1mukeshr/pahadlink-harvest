import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { STORAGE, MAX_QTY_PER_ITEM_PER_CUSTOMER } from '../config'
import {
  getProductById,
  getProductMinPrice,
  getVariantBySize,
  getVariantStock,
  setLiveStockOverlay,
} from '../data/siteData'
import { capitalizeWords } from '../utils/text'
import { fetchStockLevels } from '../services/orderService'
import {
  fetchBag,
  mergeCarts,
  mergeWishlists,
  saveBag,
} from '../services/bagService'
import { useAuth } from './AuthContext'

const ShopContext = createContext(null)

const readStore = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

const withCapitalizedNames = (items) =>
  items.map((item) =>
    item?.name ? { ...item, name: capitalizeWords(item.name) } : item
  )

function stripCartForSync(items = []) {
  return items.map((item) => ({
    key: item.key || `${item.id}::${item.size || ''}`,
    id: item.id,
    name: item.name || '',
    image: item.image || '',
    price: Number(item.price) || 0,
    size: item.size || '',
    qty: Math.max(1, Number(item.qty) || 1),
  }))
}

function stripWishlistForSync(items = []) {
  return items.map((item) => ({
    id: item.id,
    name: item.name || '',
    image: item.image || '',
    price: Number(item.price) || 0,
  }))
}

export function ShopProvider({ children }) {
  const { user, isAuthenticated, loading: authLoading } = useAuth()
  const userId = user?.id || null

  const [cart, setCart] = useState(() =>
    withCapitalizedNames(readStore(STORAGE.CART, []))
  )
  const [wishlist, setWishlist] = useState(() =>
    withCapitalizedNames(readStore(STORAGE.WISHLIST, []))
  )
  const [cartOpen, setCartOpen] = useState(false)
  const [wishlistOpen, setWishlistOpen] = useState(false)
  const [stockTick, setStockTick] = useState(0)

  /** After login merge finishes (or guest mode), remote saves are allowed */
  const hadSessionToken =
    typeof window !== 'undefined' &&
    Boolean(
      localStorage.getItem(STORAGE.TOKEN) ||
        sessionStorage.getItem(STORAGE.TOKEN)
    )
  const syncReadyRef = useRef(!hadSessionToken)
  const skipNextRemoteSaveRef = useRef(false)
  const prevUserIdRef = useRef(userId)
  const cartRef = useRef(cart)
  const wishlistRef = useRef(wishlist)
  cartRef.current = cart
  wishlistRef.current = wishlist

  useEffect(() => {
    let cancelled = false
    fetchStockLevels()
      .then((items) => {
        if (cancelled) return
        setLiveStockOverlay(items)
        setStockTick((n) => n + 1)
      })
      .catch(() => {
        // keep static stock defaults if API unreachable
      })
    return () => {
      cancelled = true
    }
  }, [])

  // After live stock loads, clamp cart qty / drop OOS lines
  useEffect(() => {
    if (!stockTick) return
    setCart((prev) => {
      let changed = false
      const next = []
      for (const item of prev) {
        const product = getProductById(item.id)
        if (!product) {
          changed = true
          continue
        }
        const stock = getVariantStock(product, item.size)
        if (stock <= 0) {
          changed = true
          continue
        }
        const maxAllowed = Math.min(stock, MAX_QTY_PER_ITEM_PER_CUSTOMER)
        const qty = Math.min(item.qty || 1, maxAllowed)
        if (qty !== item.qty || item.maxStock !== maxAllowed) {
          changed = true
          next.push({ ...item, qty, maxStock: maxAllowed })
        } else {
          next.push(item)
        }
      }
      return changed ? next : prev
    })
  }, [stockTick])

  // Login → pull account bag, merge guest local, push merged.
  // Logout → clear local bag (account copy stays on server for next login).
  useEffect(() => {
    if (authLoading) return undefined

    const prevId = prevUserIdRef.current
    prevUserIdRef.current = userId

    if (!isAuthenticated || !userId) {
      syncReadyRef.current = true
      if (prevId) {
        skipNextRemoteSaveRef.current = true
        setCart([])
        setWishlist([])
        localStorage.setItem(STORAGE.CART, '[]')
        localStorage.setItem(STORAGE.WISHLIST, '[]')
      }
      return undefined
    }

    let cancelled = false
    syncReadyRef.current = false
    ;(async () => {
      try {
        const remote = await fetchBag()
        if (cancelled) return
        const localCart = cartRef.current.length
          ? cartRef.current
          : readStore(STORAGE.CART, [])
        const localWish = wishlistRef.current.length
          ? wishlistRef.current
          : readStore(STORAGE.WISHLIST, [])
        const mergedCart = withCapitalizedNames(
          mergeCarts(localCart, remote.cart || [])
        )
        const mergedWish = withCapitalizedNames(
          mergeWishlists(localWish, remote.wishlist || [])
        )
        skipNextRemoteSaveRef.current = true
        setCart(mergedCart)
        setWishlist(mergedWish)
        localStorage.setItem(STORAGE.CART, JSON.stringify(mergedCart))
        localStorage.setItem(STORAGE.WISHLIST, JSON.stringify(mergedWish))
        await saveBag({
          cart: stripCartForSync(mergedCart),
          wishlist: stripWishlistForSync(mergedWish),
        })
      } catch {
        // Keep local bag if sync is temporarily unavailable
      } finally {
        if (!cancelled) {
          // Explicit save already pushed merge; allow the next user edit to sync.
          skipNextRemoteSaveRef.current = false
          syncReadyRef.current = true
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [userId, isAuthenticated, authLoading])

  // Always mirror to localStorage; when signed in, debounce save to account.
  useEffect(() => {
    localStorage.setItem(STORAGE.CART, JSON.stringify(cart))
    localStorage.setItem(STORAGE.WISHLIST, JSON.stringify(wishlist))

    if (!isAuthenticated || !userId || !syncReadyRef.current) return undefined
    if (skipNextRemoteSaveRef.current) {
      skipNextRemoteSaveRef.current = false
      return undefined
    }

    const timer = window.setTimeout(() => {
      saveBag({
        cart: stripCartForSync(cart),
        wishlist: stripWishlistForSync(wishlist),
      }).catch(() => {
        // offline / API asleep — local cache still holds the bag
      })
    }, 450)

    return () => window.clearTimeout(timer)
  }, [cart, wishlist, isAuthenticated, userId])

  useEffect(() => {
    if (!cartOpen && !wishlistOpen) return undefined

    const body = document.body
    const prevOverflow = body.style.overflow

    // Keep page width stable - html already uses scrollbar-gutter: stable
    body.style.overflow = 'hidden'

    const onKey = (e) => {
      if (e.key === 'Escape') {
        setCartOpen(false)
        setWishlistOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)

    return () => {
      body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [cartOpen, wishlistOpen])

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + (item.qty || 1), 0),
    [cart]
  )

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * (item.qty || 1), 0),
    [cart]
  )

  const wishlistCount = wishlist.length

  const openCart = useCallback(() => {
    setWishlistOpen(false)
    setCartOpen(true)
  }, [])
  const closeCart = useCallback(() => setCartOpen(false), [])
  const toggleCart = useCallback(() => setCartOpen((o) => !o), [])
  const openWishlist = useCallback(() => {
    setCartOpen(false)
    setWishlistOpen(true)
  }, [])
  const closeWishlist = useCallback(() => setWishlistOpen(false), [])

  const addToCart = useCallback(
    (product, { size, qty = 1, open = true, price } = {}) => {
      const variant = getVariantBySize(product, size)
      const unitSize = variant.size
      const unitPrice = price ?? variant.price
      const stock = getVariantStock(product, unitSize)

      if (stock <= 0) return false

      let added = false

      setCart((prev) => {
        const key = `${product.id}::${unitSize}`
        const existing = prev.find((item) => item.key === key)
        const alreadyVariant = existing?.qty || 0
        const alreadyProduct = prev
          .filter((item) => item.id === product.id)
          .reduce((sum, item) => sum + (item.qty || 0), 0)
        const customerRoom = Math.max(
          0,
          MAX_QTY_PER_ITEM_PER_CUSTOMER - alreadyProduct
        )
        const stockRoom = Math.max(0, stock - alreadyVariant)
        const room = Math.min(customerRoom, stockRoom)
        if (room <= 0) {
          added = false
          return prev
        }

        const addQty = Math.min(Math.max(1, qty), room)
        added = addQty > 0
        const maxAllowed = Math.min(stock, MAX_QTY_PER_ITEM_PER_CUSTOMER)

        if (existing) {
          return prev.map((item) =>
            item.key === key
              ? {
                  ...item,
                  qty: alreadyVariant + addQty,
                  price: unitPrice,
                  maxStock: maxAllowed,
                }
              : item
          )
        }

        return [
          ...prev,
          {
            key,
            id: product.id,
            name: capitalizeWords(product.name),
            image: product.image,
            price: unitPrice,
            size: unitSize,
            qty: addQty,
            maxStock: maxAllowed,
          },
        ]
      })

      if (added && open) setCartOpen(true)
      return added
    },
    []
  )

  const updateCartQty = useCallback((key, qty) => {
    setCart((prev) => {
      if (qty <= 0) return prev.filter((item) => item.key !== key)

      return prev
        .map((item) => {
          if (item.key !== key) return item

          const product = getProductById(item.id)
          const stock = product
            ? getVariantStock(product, item.size)
            : Math.max(0, Number(item.maxStock) || 0)
          const others = prev
            .filter((row) => row.id === item.id && row.key !== key)
            .reduce((sum, row) => sum + (row.qty || 0), 0)
          const customerCap = Math.max(
            0,
            MAX_QTY_PER_ITEM_PER_CUSTOMER - others
          )
          const nextQty = Math.min(qty, stock, customerCap)

          if (nextQty <= 0) return null

          return {
            ...item,
            qty: nextQty,
            maxStock: Math.min(stock, MAX_QTY_PER_ITEM_PER_CUSTOMER),
          }
        })
        .filter(Boolean)
    })
  }, [])

  const getCartQtyForVariant = useCallback(
    (productId, size) => {
      const key = `${productId}::${size}`
      return cart.find((item) => item.key === key)?.qty || 0
    },
    [cart]
  )

  const getCartQtyForProduct = useCallback(
    (productId) =>
      cart
        .filter((item) => item.id === productId)
        .reduce((sum, item) => sum + (item.qty || 0), 0),
    [cart]
  )

  const removeFromCart = useCallback((key) => {
    setCart((prev) => prev.filter((item) => item.key !== key))
  }, [])

  const clearCart = useCallback(() => {
    setCart([])
  }, [])

  const toggleWishlist = useCallback((product) => {
    setWishlist((prev) => {
      const exists = prev.some((item) => item.id === product.id)
      if (exists) return prev.filter((item) => item.id !== product.id)
      return [
        ...prev,
        {
          id: product.id,
          name: capitalizeWords(product.name),
          image: product.image,
          price: getProductMinPrice(product),
        },
      ]
    })
  }, [])

  const isInWishlist = useCallback(
    (productId) => wishlist.some((item) => item.id === productId),
    [wishlist]
  )

  const value = useMemo(
    () => ({
      cart,
      wishlist,
      cartCount,
      cartTotal,
      wishlistCount,
      cartOpen,
      wishlistOpen,
      openCart,
      closeCart,
      toggleCart,
      openWishlist,
      closeWishlist,
      addToCart,
      updateCartQty,
      getCartQtyForVariant,
      getCartQtyForProduct,
      removeFromCart,
      clearCart,
      toggleWishlist,
      isInWishlist,
      stockTick,
    }),
    [
      cart,
      wishlist,
      cartCount,
      cartTotal,
      wishlistCount,
      cartOpen,
      wishlistOpen,
      openCart,
      closeCart,
      toggleCart,
      openWishlist,
      closeWishlist,
      addToCart,
      updateCartQty,
      getCartQtyForVariant,
      getCartQtyForProduct,
      removeFromCart,
      clearCart,
      toggleWishlist,
      isInWishlist,
      stockTick,
    ]
  )

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>
}

export function useShop() {
  const ctx = useContext(ShopContext)
  if (!ctx) throw new Error('useShop must be used within ShopProvider')
  return ctx
}
