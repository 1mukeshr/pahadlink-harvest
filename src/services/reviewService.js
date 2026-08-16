import api from './api'
import {
  buildRatingSummary,
  getHomeReviewFeed,
  mergeProductReviews,
} from '../utils/ratings'
import { STORAGE } from '../config'
import { getProductById } from '../data/siteData'

function saveLocalReview(productId, review) {
  try {
    const raw = localStorage.getItem(STORAGE.REVIEWS)
    const store = raw ? JSON.parse(raw) : {}
    const existing = Array.isArray(store[productId]) ? store[productId] : []
    store[productId] = [review, ...existing.filter((r) => r.id !== review.id)].slice(
      0,
      80
    )
    localStorage.setItem(STORAGE.REVIEWS, JSON.stringify(store))
  } catch {
    // ignore
  }
}

/**
 * Load reviews for a product. Falls back to seeds + localStorage if API is down.
 */
export async function fetchProductReviews(productId) {
  const product = getProductById(productId)

  try {
    const { data } = await api.get(`/reviews/product/${encodeURIComponent(productId)}`)
    const remote = Array.isArray(data.reviews) ? data.reviews : []
    const reviews = mergeProductReviews(product, remote, {
      includeSeeds: remote.length === 0,
    })
    return {
      reviews,
      summary: buildRatingSummary(reviews),
      source: 'api',
    }
  } catch {
    const reviews = mergeProductReviews(product, [])
    return {
      reviews,
      summary: buildRatingSummary(reviews),
      source: 'local',
    }
  }
}

/**
 * Submit a 1–5 star review for a product.
 */
export async function submitProductReview({
  productId,
  productName,
  rating,
  comment,
  userName,
  userLocation,
}) {
  const score = Math.round(Number(rating))
  if (!productId) throw new Error('Product is required')
  if (!score || score < 1 || score > 5) throw new Error('Rating must be 1–5')

  const payload = {
    productId,
    productName: productName || '',
    rating: score,
    comment: String(comment || '').trim(),
    userName: String(userName || '').trim(),
    userLocation: String(userLocation || '').trim(),
  }

  try {
    const { data } = await api.post('/reviews', payload)
    const product = getProductById(productId)
    const remote = Array.isArray(data.reviews) ? data.reviews : []
    if (data.review) saveLocalReview(productId, data.review)
    const reviews = mergeProductReviews(product, remote, {
      includeSeeds: remote.length === 0,
    })
    return {
      review: data.review,
      reviews,
      summary: buildRatingSummary(reviews),
      message: data.message || 'Review saved',
    }
  } catch {
    // Offline / API down — keep review locally so UX still works
    const localReview = {
      id: `local-${productId}-${Date.now()}`,
      productId,
      productName: payload.productName,
      userName: payload.userName || 'Guest shopper',
      userLocation: payload.userLocation,
      rating: score,
      comment: payload.comment,
      verified: false,
      createdAt: new Date().toISOString(),
    }
    saveLocalReview(productId, localReview)
    const product = getProductById(productId)
    const reviews = mergeProductReviews(product, [])
    return {
      review: localReview,
      reviews,
      summary: buildRatingSummary(reviews),
      message: 'Review saved on this device',
      offline: true,
    }
  }
}

export async function fetchRecentReviews(limit = 6) {
  try {
    const { data } = await api.get('/reviews/recent', { params: { limit } })
    const reviews = Array.isArray(data.reviews) ? data.reviews : []
    if (reviews.length) {
      return {
        reviews,
        summary: data.summary || buildRatingSummary(reviews),
        source: 'api',
      }
    }
  } catch {
    // fall through
  }

  const reviews = getHomeReviewFeed([])
  return {
    reviews,
    summary: buildRatingSummary(reviews),
    source: 'local',
  }
}
