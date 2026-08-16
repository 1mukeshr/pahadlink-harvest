/**
 * Rating summary math — shared by storefront and Review model.
 */

export function buildRatingSummary(reviews = []) {
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  let total = 0
  let count = 0

  for (const review of reviews) {
    const raw = Number(review?.rating)
    // Skip missing / invalid before clamping (0 must not become 1)
    if (!Number.isFinite(raw) || raw <= 0) continue
    const rating = Math.min(5, Math.max(1, Math.round(raw)))
    distribution[rating] += 1
    total += rating
    count += 1
  }

  return {
    average: count ? Math.round((total / count) * 10) / 10 : 0,
    count,
    distribution,
  }
}
