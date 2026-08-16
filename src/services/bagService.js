import api from './api'

/** Load cart + wishlist for the signed-in account */
export async function fetchBag() {
  const { data } = await api.get('/auth/bag')
  return {
    cart: Array.isArray(data?.cart) ? data.cart : [],
    wishlist: Array.isArray(data?.wishlist) ? data.wishlist : [],
  }
}

/** Persist cart + wishlist to the signed-in account */
export async function saveBag({ cart = [], wishlist = [] } = {}) {
  const { data } = await api.put('/auth/bag', { cart, wishlist })
  return {
    cart: Array.isArray(data?.cart) ? data.cart : cart,
    wishlist: Array.isArray(data?.wishlist) ? data.wishlist : wishlist,
  }
}

/** Merge guest + account cart lines (same variant → higher qty wins). */
export function mergeCarts(local = [], remote = []) {
  const map = new Map()
  for (const item of [...remote, ...local]) {
    if (!item?.id) continue
    const key = String(item.key || `${item.id}::${item.size || ''}`)
    const prev = map.get(key)
    if (!prev) {
      map.set(key, {
        key,
        id: item.id,
        name: item.name || '',
        image: item.image || '',
        price: Number(item.price) || 0,
        size: item.size || '',
        qty: Math.max(1, Number(item.qty) || 1),
      })
      continue
    }
    map.set(key, {
      ...prev,
      name: item.name || prev.name,
      image: item.image || prev.image,
      price: Number(item.price) || prev.price,
      qty: Math.max(prev.qty || 1, Number(item.qty) || 1),
    })
  }
  return [...map.values()]
}

/** Union wishlist by product id (prefer fresher local name/price/image). */
export function mergeWishlists(local = [], remote = []) {
  const map = new Map()
  for (const item of [...remote, ...local]) {
    if (!item?.id) continue
    const prev = map.get(item.id)
    map.set(item.id, {
      id: item.id,
      name: item.name || prev?.name || '',
      image: item.image || prev?.image || '',
      price: Number(item.price) || prev?.price || 0,
    })
  }
  return [...map.values()]
}
