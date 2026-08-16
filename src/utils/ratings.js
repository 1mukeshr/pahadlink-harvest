import { STORAGE } from '../config'
import { products, testimonials } from '../data/siteData'
import { buildRatingSummary } from '@pahadlink/shared/ratings'

export { buildRatingSummary }

const SEED_NAMES = [
  { name: 'Ananya Joshi', location: 'Dehradun' },
  { name: 'Rohit Negi', location: 'Nainital' },
  { name: 'Priya Bisht', location: 'Delhi' },
  { name: 'Vikram Rawat', location: 'Haridwar' },
  { name: 'Meera Shah', location: 'Mumbai' },
  { name: 'Kabir Singh', location: 'Chandigarh' },
]

const SEED_COMMENTS = [
  'Fresh and authentic — tastes just like the hills.',
  'Packaging was neat and delivery was quick. Will reorder.',
  'Great quality for the price. Family loved it.',
  'Pure pahadi flavour. Exactly what I was looking for.',
  'Good product overall. Slightly delayed shipping but worth it.',
  'Perfect gift from Uttarakhand. Highly recommend.',
]

function hashString(value = '') {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function readLocalStore() {
  try {
    const raw = localStorage.getItem(STORAGE.REVIEWS)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function getLocalReviews(productId) {
  const store = readLocalStore()
  const list = store[productId]
  return Array.isArray(list) ? list : []
}

/** Deterministic seed reviews so every product has ratings out of 5 */
function getSeedReviewsForProduct(product) {
  if (!product?.id) return []
  const base = Number(product.rating) || 4.5
  const seedCount = 3 + (hashString(product.id) % 3)
  const list = []

  for (let i = 0; i < seedCount; i += 1) {
    const pick = hashString(`${product.id}-${i}`)
    const person = SEED_NAMES[pick % SEED_NAMES.length]
    const delta = [0, 0, -1, 1, 0][pick % 5]
    const rating = Math.min(5, Math.max(1, Math.round(base + delta)))
    list.push({
      id: `seed-${product.id}-${i}`,
      productId: product.id,
      productName: product.name,
      userName: person.name,
      userLocation: person.location,
      rating,
      comment: SEED_COMMENTS[(pick + i) % SEED_COMMENTS.length],
      verified: true,
      createdAt: new Date(Date.now() - (i + 1) * 86400000 * 3).toISOString(),
      isSeed: true,
    })
  }

  return list
}

export function mergeProductReviews(product, remoteReviews = [], { includeSeeds = true } = {}) {
  const local = getLocalReviews(product?.id)
  const seeds = includeSeeds ? getSeedReviewsForProduct(product) : []
  const byId = new Map()

  // Prefer real reviews over seeds when ids collide
  for (const review of [...seeds, ...remoteReviews, ...local]) {
    if (!review?.id) continue
    byId.set(String(review.id), review)
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  )
}

export function getHomeReviewFeed(remote = []) {
  if (remote.length) return remote

  const fromProducts = products.slice(0, 6).flatMap((product, index) => {
    const seed = getSeedReviewsForProduct(product)[0]
    if (!seed) return []
    return [
      {
        ...seed,
        id: `home-${product.id}`,
        productName: product.name.split('|')[0].trim(),
        createdAt: new Date(Date.now() - (index + 2) * 86400000).toISOString(),
      },
    ]
  })

  const fromTestimonials = testimonials.map((item, index) => ({
    id: `testimonial-${index}`,
    productId: '',
    productName: item.product || '',
    userName: item.name,
    userLocation: item.location,
    rating: item.rating,
    comment: item.text,
    verified: true,
    createdAt: new Date(Date.now() - (index + 1) * 86400000).toISOString(),
  }))

  return [...fromTestimonials, ...fromProducts].slice(0, 9)
}
