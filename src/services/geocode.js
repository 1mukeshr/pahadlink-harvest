/**
 * Address lookup helpers (PahadLink).
 * Search: Photon (India-friendly) → Nominatim → Google (if key).
 * Reverse GPS: Google (if key) → Nominatim, then India Post pin enrich.
 */

const NOMINATIM_HEADERS = {
  Accept: 'application/json',
  'User-Agent':
    'PahadLink/1.0 (delivery-address; https://1mukeshr.github.io/pahadlink-harvest/)',
}

function mapsKey() {
  return (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim()
}

function findComponent(components, ...types) {
  const hit = (components || []).find((c) =>
    types.some((t) => c.types.includes(t))
  )
  return hit?.long_name || ''
}

function uniqueParts(parts) {
  const out = []
  const seen = new Set()
  for (const raw of parts) {
    const s = String(raw || '').trim()
    if (!s) continue
    const key = s.toLowerCase()
    if (seen.has(key)) continue
    // Skip if this fragment is already inside a longer part
    if (out.some((p) => p.toLowerCase().includes(key) && p.length > s.length)) {
      continue
    }
    seen.add(key)
    out.push(s)
  }
  return out
}

function buildFullAddress({ line1, area, city, state, pin, country = 'India' }) {
  return uniqueParts([line1, area, city, state, pin, country]).join(', ')
}

function fromGoogleResult(result) {
  const components = result.address_components || []
  const streetNumber = findComponent(components, 'street_number')
  const road = findComponent(components, 'route', 'street_address')
  const premise = findComponent(components, 'premise', 'subpremise')
  const poi = result.name && result.name !== road ? result.name : ''
  const sub1 = findComponent(components, 'sublocality_level_1', 'sublocality')
  const sub2 = findComponent(components, 'sublocality_level_2', 'neighborhood')
  const sub3 = findComponent(components, 'sublocality_level_3')
  const city = findComponent(
    components,
    'locality',
    'postal_town',
    'administrative_area_level_2'
  )
  const state = findComponent(components, 'administrative_area_level_1')
  const pin = findComponent(components, 'postal_code')
    .replace(/\D/g, '')
    .slice(0, 6)

  // House = building / flat identity only
  const line1 =
    uniqueParts([poi, premise, streetNumber]).join(', ') ||
    uniqueParts([premise, streetNumber]).join(', ') ||
    ''

  // Locality = road + sector / neighbourhood layers
  const area = uniqueParts([road, sub3, sub2, sub1]).join(', ')

  const fullAddress =
    result.formatted_address ||
    buildFullAddress({ line1, area, city, state, pin })
  const label =
    uniqueParts([area || line1 || city, city, state, pin]).join(', ') ||
    fullAddress
  const loc = result.geometry?.location

  return {
    label,
    fullAddress,
    line1,
    area,
    city,
    state,
    pin,
    lat: typeof loc?.lat === 'number' ? loc.lat : undefined,
    lng: typeof loc?.lng === 'number' ? loc.lng : undefined,
    source: 'google',
  }
}

function fromNominatim(data) {
  const a = data.address || {}
  const poi =
    data.name ||
    a.shop ||
    a.amenity ||
    a.office ||
    a.tourism ||
    a.leisure ||
    a.building ||
    ''
  const house = a.house_number || ''
  const road =
    a.road || a.pedestrian || a.residential || a.path || a.footway || ''
  const suburb =
    a.suburb ||
    a.neighbourhood ||
    a.quarter ||
    a.city_district ||
    a.village ||
    a.hamlet ||
    a.locality ||
    ''
  const city =
    a.city ||
    a.town ||
    a.municipality ||
    a.county ||
    a.state_district ||
    a.district ||
    ''
  const state = a.state || ''
  const pin = String(a.postcode || '')
    .replace(/\D/g, '')
    .slice(0, 6)

  // House = POI / flat number — keep road out of house
  let line1 = uniqueParts([poi && poi !== house ? poi : '', house]).join(', ')

  // Locality = road + suburb / sector
  let area = uniqueParts([road, suburb !== city ? suburb : '']).join(', ')

  const fullAddress = String(data.display_name || '').trim()

  // Pull extra locality parts from display_name (roads, sectors) when thin
  if (fullAddress) {
    const bits = fullAddress
      .split(',')
      .map((p) => p.trim())
      .filter(
        (p) =>
          p &&
          !/^india$/i.test(p) &&
          !/^\d{6}$/.test(p) &&
          p.toLowerCase() !== String(city || '').toLowerCase() &&
          p.toLowerCase() !== String(state || '').toLowerCase()
      )

    if (!line1 && bits.length) {
      line1 = bits[0]
    }

    const rest = bits.filter((p) => {
      const low = p.toLowerCase()
      if (line1 && low === line1.toLowerCase()) return false
      if (line1 && line1.toLowerCase().includes(low) && low.length < line1.length) {
        return false
      }
      return true
    })

    if (rest.length) {
      area = uniqueParts([area, ...rest]).join(', ')
    }
  }

  const label =
    uniqueParts([area || line1 || city, city !== area ? city : '', state, pin]).join(
      ', '
    ) || fullAddress

  return {
    label,
    fullAddress: fullAddress || buildFullAddress({ line1, area, city, state, pin }),
    line1: line1 || '',
    area: area || '',
    city,
    state,
    pin,
    lat: data.lat != null ? Number(data.lat) : undefined,
    lng: data.lon != null ? Number(data.lon) : undefined,
    source: 'nominatim',
  }
}

function fromPhoton(feature) {
  const p = feature?.properties || {}
  const coords = feature?.geometry?.coordinates || []
  const lng = coords[0] != null ? Number(coords[0]) : undefined
  const lat = coords[1] != null ? Number(coords[1]) : undefined
  const name = p.name || ''
  const house = p.housenumber || ''
  const road = p.street || ''
  const suburb =
    p.district || p.suburb || p.neighbourhood || p.locality || p.county || ''
  const city = p.city || p.town || p.municipality || ''
  const state = p.state || ''
  const pin = String(p.postcode || '')
    .replace(/\D/g, '')
    .slice(0, 6)
  const line1 = uniqueParts([name, house]).join(', ')
  const area = uniqueParts([road, suburb !== city ? suburb : '']).join(', ')
  const fullAddress = buildFullAddress({ line1, area, city, state, pin })
  const label = uniqueParts([area || name || city, city, state, pin]).join(', ')

  return {
    label,
    fullAddress,
    line1: line1 || '',
    area: area || '',
    city,
    state,
    pin,
    lat,
    lng,
    source: 'photon',
  }
}

/** Fill gaps so GPS / pincode saves always carry a usable checkout address */
export function completeAddressFields(place = {}) {
  const fullAddress = String(place.fullAddress || place.label || '').trim()
  let line1 = String(place.line1 || '').trim()
  let area = String(place.area || '').trim()
  let city = String(place.city || '').trim()
  let state = String(place.state || '').trim()
  let pin = String(place.pin || '')
    .replace(/\D/g, '')
    .slice(0, 6)

  if (fullAddress) {
    const parts = fullAddress
      .split(',')
      .map((p) => p.trim())
      .filter(
        (p) =>
          p &&
          !/^india$/i.test(p) &&
          !/^\d{6}$/.test(p)
      )

    if (!pin) {
      const pinHit = fullAddress.match(/\b(\d{6})\b/)
      if (pinHit) pin = pinHit[1]
    }

    // Heuristic trailing: …, locality…, city, state
    if ((!city || !state) && parts.length >= 2) {
      const withoutCountry = parts.filter(
        (p) => !/^india$/i.test(p) && !/^\d{6}$/.test(p)
      )
      if (!state && withoutCountry.length) {
        state = withoutCountry[withoutCountry.length - 1] || state
      }
      if (!city && withoutCountry.length >= 2) {
        city = withoutCountry[withoutCountry.length - 2] || city
      }
    }

    const useful = parts.filter((p) => {
      const low = p.toLowerCase()
      if (city && low === city.toLowerCase()) return false
      if (state && low === state.toLowerCase()) return false
      if (
        /^(uttarakhand|haryana|delhi|nct of delhi|uttar pradesh|himachal pradesh|rajasthan|punjab|maharashtra|karnataka)$/i.test(
          p
        )
      ) {
        return false
      }
      return true
    })

    if (!line1 || line1 === 'Current location') {
      line1 = useful[0] || ''
    }

    // Everything between house and city → locality (road, sector, society block)
    const houseBits = line1
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const mid = useful.filter(
      (p) => !houseBits.some((h) => h.toLowerCase() === p.toLowerCase())
    )
    if (mid.length) {
      area = uniqueParts([area, ...mid]).join(', ')
    } else if (!area && useful.length >= 2) {
      area = useful.slice(1).join(', ')
    }
  }

  const label =
    String(place.label || '').trim() ||
    uniqueParts([line1 || area, city, pin]).join(', ') ||
    fullAddress ||
    'Current location'

  const resolvedFull =
    fullAddress ||
    buildFullAddress({ line1, area, city, state, pin })

  return {
    ...place,
    label,
    fullAddress: resolvedFull,
    line1: line1 || '',
    area: area || '',
    city,
    state,
    pin,
  }
}

/**
 * Fill missing city / state / area / pin from India Post.
 * Never shrinks an already-complete street line.
 */
export async function enrichFromPincode(place, { signal } = {}) {
  const base = completeAddressFields(place)
  const pin = String(base.pin || '')
    .replace(/\D/g, '')
    .slice(0, 6)
  if (!/^\d{6}$/.test(pin)) return base

  const offices = await lookupPincode(pin, { signal })
  if (!offices.length) return { ...base, pin }

  const best = offices[0]
  const area = base.area || best.area || ''
  const city = base.city || best.city || ''
  const state = base.state || best.state || ''
  const line1 =
    base.line1 && base.line1.length >= 4
      ? base.line1
      : best.line1 || area || city
  const fullAddress =
    base.fullAddress && base.fullAddress.length > line1.length
      ? base.fullAddress
      : buildFullAddress({ line1, area, city, state, pin })

  return completeAddressFields({
    ...base,
    pin,
    area,
    city,
    state,
    line1,
    fullAddress,
    label: uniqueParts([area || line1, city, pin]).join(', '),
  })
}

async function reverseNominatim(latitude, longitude, { signal, zoom = 18 } = {}) {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
    `&lat=${latitude}&lon=${longitude}&addressdetails=1&zoom=${zoom}` +
    `&accept-language=en-IN,en`
  const res = await fetch(url, { headers: NOMINATIM_HEADERS, signal })
  if (!res.ok) return null
  const data = await res.json()
  if (!data?.display_name && !data?.address) return null
  return {
    ...fromNominatim(data),
    lat: latitude,
    lng: longitude,
  }
}

async function reversePhoton(latitude, longitude, { signal } = {}) {
  const url =
    `https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}&lang=en`
  const res = await fetch(url, { signal })
  if (!res.ok) return null
  const data = await res.json()
  const feature = data?.features?.[0]
  if (!feature) return null
  return {
    ...fromPhoton(feature),
    lat: latitude,
    lng: longitude,
    source: 'photon',
  }
}

async function reverseBigDataCloud(latitude, longitude, { signal } = {}) {
  const url =
    `https://api.bigdatacloud.net/data/reverse-geocode-client` +
    `?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
  const res = await fetch(url, { signal })
  if (!res.ok) return null
  const data = await res.json()
  if (!data) return null
  const admin = Array.isArray(data.localityInfo?.administrative)
    ? data.localityInfo.administrative
    : []
  const locality =
    data.locality ||
    admin.find((a) => a.adminLevel === 6 || a.adminLevel === 8)?.name ||
    ''
  const city = data.city || locality || ''
  const state = data.principalSubdivision || ''
  const pin = String(data.postcode || '')
    .replace(/\D/g, '')
    .slice(0, 6)
  const area =
    admin.find((a) => a.adminLevel >= 7 && a.adminLevel <= 10 && a.name !== city)
      ?.name || ''
  const line1 = uniqueParts([area, locality !== city ? locality : '', city]).join(
    ', '
  )
  const fullAddress = buildFullAddress({ line1, area: '', city, state, pin })
  if (!city && !state && !pin) return null
  return {
    label: uniqueParts([city, state, pin]).join(', '),
    fullAddress,
    line1: line1 || city || 'Current location',
    area,
    city,
    state,
    pin,
    lat: latitude,
    lng: longitude,
    source: 'bigdatacloud',
  }
}

function richerText(a = '', b = '') {
  const left = String(a || '').trim()
  const right = String(b || '').trim()
  if (!left) return right
  if (!right) return left
  if (left.toLowerCase() === right.toLowerCase()) return left
  // Prefer the longer / more comma-rich value
  const leftScore = left.split(',').length * 10 + left.length
  const rightScore = right.split(',').length * 10 + right.length
  return rightScore > leftScore ? right : left
}

function mergePlaces(primary, secondary) {
  if (!primary) return secondary
  if (!secondary) return primary

  const line1 = richerText(
    primary.line1 !== 'Current location' ? primary.line1 : '',
    secondary.line1 !== 'Current location' ? secondary.line1 : ''
  )
  const area = uniqueParts([primary.area, secondary.area]).join(', ')
  const fullAddress = richerText(primary.fullAddress, secondary.fullAddress)
  const city = richerText(primary.city, secondary.city)
  const state = richerText(primary.state, secondary.state)
  const pin = primary.pin || secondary.pin || ''

  return completeAddressFields({
    ...secondary,
    ...primary,
    line1,
    area,
    fullAddress,
    city,
    state,
    pin,
    lat: primary.lat ?? secondary.lat,
    lng: primary.lng ?? secondary.lng,
    source: primary.source || secondary.source,
  })
}

/** Reverse geocode GPS → full structured address (+ pincode enrichment) */
export async function reverseGeocode(latitude, longitude, { signal } = {}) {
  let place = null
  const key = mapsKey()

  if (key) {
    try {
      const url =
        `https://maps.googleapis.com/maps/api/geocode/json` +
        `?latlng=${latitude},${longitude}&language=en&region=in&key=${key}`
      const res = await fetch(url, { signal })
      if (res.ok) {
        const data = await res.json()
        if (data.status === 'OK' && data.results?.length) {
          // Merge top results — street vs POI often split across hits
          for (const result of data.results.slice(0, 3)) {
            place = mergePlaces(place, {
              ...fromGoogleResult(result),
              lat: latitude,
              lng: longitude,
              source: 'gps',
            })
          }
        }
      }
    } catch {
      // fall through
    }
  }

  // Always merge Nominatim — often has better road + sector for India
  try {
    for (const zoom of [18, 16, 14]) {
      const rev = await reverseNominatim(latitude, longitude, { signal, zoom })
      if (rev?.fullAddress) {
        place = mergePlaces(place, { ...rev, source: 'gps' })
        if (place.pin && place.city && place.area && place.line1) break
      }
    }
  } catch {
    // continue
  }

  // Photon — locality / landmark names
  try {
    const photon = await reversePhoton(latitude, longitude, { signal })
    place = mergePlaces(place, photon)
  } catch {
    // continue
  }

  // BigDataCloud — city / state / pin fallback
  if (!place || !place.city || !place.state || !place.pin) {
    try {
      const bdc = await reverseBigDataCloud(latitude, longitude, { signal })
      place = mergePlaces(place, bdc)
    } catch {
      // continue
    }
  }

  if (!place) {
    place = {
      label: 'Current location',
      fullAddress: `${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`,
      line1: 'Current location',
      area: '',
      city: '',
      state: '',
      pin: '',
      lat: latitude,
      lng: longitude,
      source: 'gps',
    }
  } else {
    place = {
      ...place,
      lat: latitude,
      lng: longitude,
      source: 'gps',
    }
  }

  return enrichFromPincode(completeAddressFields(place), { signal })
}

/**
 * Upgrade a thin Photon/search hit to a complete address via reverse geocode.
 */
async function completeSearchHit(item, { signal } = {}) {
  const base = completeAddressFields(item)
  const needsMore =
    !base.pin ||
    !base.city ||
    !base.state ||
    !base.fullAddress ||
    base.fullAddress.split(',').length < 3

  if (needsMore && base.lat != null && base.lng != null) {
    try {
      const rich = await reverseGeocode(base.lat, base.lng, { signal })
      // Keep the searched place name when reverse returns a nearby shop
      const keepName =
        base.line1 &&
        rich.line1 &&
        !rich.line1.toLowerCase().includes(base.line1.split(',')[0].toLowerCase())
      return completeAddressFields({
        ...rich,
        line1: keepName
          ? uniqueParts([base.line1, rich.line1]).join(', ')
          : rich.line1 || base.line1,
        fullAddress: keepName
          ? uniqueParts([base.line1, rich.fullAddress]).join(', ')
          : rich.fullAddress || base.fullAddress,
        source: base.source || rich.source,
      })
    } catch {
      // keep base
    }
  }

  if (base.pin) return enrichFromPincode(base, { signal })
  return base
}

async function searchPhoton(q, { signal } = {}) {
  // Bias toward India (Delhi NCR) — Photon is stronger than Nominatim for Indian POIs
  const indiaUrl =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}` +
    `&limit=8&lang=en&lat=28.6&lon=77.2`
  const res = await fetch(indiaUrl, { signal })
  if (!res.ok) return []
  const data = await res.json()
  const features = Array.isArray(data?.features) ? data.features : []
  return features
    .map(fromPhoton)
    .filter(
      (item) =>
        !item.state ||
        /india|haryana|delhi|uttar|himachal|punjab|rajasthan|maharashtra|karnataka|uttarakhand/i.test(
          `${item.state} ${item.city} ${item.fullAddress}`
        ) ||
        item.pin
    )
}

async function searchNominatim(q, { signal } = {}) {
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2` +
    `&q=${encodeURIComponent(q)}` +
    `&countrycodes=in&addressdetails=1&limit=8`
  const res = await fetch(url, { headers: NOMINATIM_HEADERS, signal })
  if (!res.ok) return []
  const data = await res.json()
  if (!Array.isArray(data)) return []
  return data.map((item) => ({
    ...fromNominatim(item),
    source: 'search',
  }))
}

async function searchGoogle(q, { signal } = {}) {
  const key = mapsKey()
  if (!key) return []
  const url =
    `https://maps.googleapis.com/maps/api/geocode/json` +
    `?address=${encodeURIComponent(q)}&components=country:IN` +
    `&language=en&region=in&key=${key}`
  const res = await fetch(url, { signal })
  if (!res.ok) return []
  const data = await res.json()
  if (data.status !== 'OK' || !Array.isArray(data.results)) return []
  return data.results.slice(0, 8).map((r) => ({
    ...fromGoogleResult(r),
    source: 'search',
  }))
}

function dedupePlaces(list) {
  const out = []
  const seen = new Set()
  for (const item of list) {
    const key = [
      String(item.fullAddress || item.line1 || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .slice(0, 80),
      item.pin || '',
      item.lat != null ? item.lat.toFixed(4) : '',
    ].join('|')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

/** Live place / address search (India) — returns complete addresses */
export async function searchPlaces(query, { signal } = {}) {
  const q = String(query || '').trim()
  if (q.length < 2) return []

  if (/^\d{6}$/.test(q)) {
    return lookupPincode(q, { signal })
  }

  try {
    const batches = await Promise.all([
      searchPhoton(q, { signal }).catch(() => []),
      searchNominatim(q, { signal }).catch(() => []),
      searchGoogle(q, { signal }).catch(() => []),
    ])
    const merged = dedupePlaces(batches.flat()).slice(0, 8)
    const completed = await Promise.all(
      merged.map((item) => completeSearchHit(item, { signal }))
    )
    return dedupePlaces(completed).slice(0, 8)
  } catch (err) {
    if (err?.name === 'AbortError') return []
    return []
  }
}

/** Resolve Indian pincode → city / state / area options */
export async function lookupPincode(pin, { signal } = {}) {
  const code = String(pin || '').replace(/\D/g, '').slice(0, 6)
  if (!/^\d{6}$/.test(code)) return []

  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${code}`, {
      signal,
    })
    if (res.ok) {
      const data = await res.json()
      const entry = Array.isArray(data) ? data[0] : null
      if (entry?.Status === 'Success' && Array.isArray(entry.PostOffice)) {
        return entry.PostOffice.slice(0, 10).map((po) => {
          const area = po.Name || ''
          const city = po.District || (po.Block !== 'NA' ? po.Block : '') || ''
          const state = po.State || ''
          const line1 = uniqueParts([
            area,
            po.Block && po.Block !== 'NA' && po.Block !== city ? po.Block : '',
          ]).join(', ')
          const fullAddress = buildFullAddress({
            line1,
            area: '',
            city,
            state,
            pin: code,
          })
          return completeAddressFields({
            label: uniqueParts([area, city, state]).join(', '),
            fullAddress,
            line1: line1 || area || city,
            area,
            city,
            state,
            pin: code,
            source: 'pincode',
          })
        })
      }
    }
  } catch (err) {
    if (err?.name === 'AbortError') return []
  }

  try {
    const url =
      `https://nominatim.openstreetmap.org/search?format=jsonv2` +
      `&postalcode=${code}&country=India&addressdetails=1&limit=5`
    const res = await fetch(url, { headers: NOMINATIM_HEADERS, signal })
    if (!res.ok) return []
    const data = await res.json()
    return (Array.isArray(data) ? data : []).map((item) =>
      completeAddressFields({
        ...fromNominatim(item),
        pin: code,
        source: 'pincode',
      })
    )
  } catch (err) {
    if (err?.name === 'AbortError') return []
    return []
  }
}
