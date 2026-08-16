/** Home hero banners — dedicated 1000x500 art (`home-banner/`) */
import homeBannerHoney from '../assets/images/home-banner/honey-forest.webp'
import homeBannerOrganic from '../assets/images/home-banner/organic-harvest.webp'
import homeBannerSweets from '../assets/images/home-banner/festive-sweets.webp'
/** Offer banners — `banners/` (new webp only) */
import offerMixProducts from '../assets/images/banners/offer-mix-products.webp'
import offerFreeShip from '../assets/images/banners/offer-free-ship.webp'
import offerHoneyBuransh from '../assets/images/banners/offer-honey-buransh.webp'
/** Category hero images — `categories/` (new webp only) */
import categoryBannerOrganic from '../assets/images/categories/category-organic-food.webp'
import categoryBannerHoney from '../assets/images/categories/category-honey-natural.webp'
import categoryBannerClothing from '../assets/images/categories/category-clothing.webp'
import categoryBannerHandicrafts from '../assets/images/categories/category-handicrafts.webp'
import categoryBannerSweets from '../assets/images/categories/category-snacks-sweets.webp'
import categoryBannerGifts from '../assets/images/categories/category-gift-hampers.webp'
/** Category page banners — composed 16:3 strips (`scripts/build-category-banners.mjs`) */
import bannerOrganic from '../assets/images/categories/banners/organic-food.webp'
import bannerHoney from '../assets/images/categories/banners/honey-natural.webp'
import bannerClothing from '../assets/images/categories/banners/clothing.webp'
import bannerHandicrafts from '../assets/images/categories/banners/handicrafts.webp'
import bannerSweets from '../assets/images/categories/banners/snacks-sweets.webp'
import bannerGifts from '../assets/images/categories/banners/gift-hampers.webp'
/** Product pack images — `products/` (new webp only) */
import packPahadiRajma from '../assets/images/products/pack-pahadi-rajma.webp'
import packRawHoney from '../assets/images/products/pack-raw-honey.webp'
import packManduaFlour from '../assets/images/products/pack-mandua-flour.webp'
import packGahatDal from '../assets/images/products/pack-gahat-dal.webp'
import packRedRice from '../assets/images/products/pack-red-rice.webp'
import packBalMithai from '../assets/images/products/pack-bal-mithai.webp'
import packSingori from '../assets/images/products/pack-singori.webp'
import packBuranshSquash from '../assets/images/products/pack-buransh-squash.webp'
import packPahadiTopi from '../assets/images/products/pack-pahadi-topi.webp'
import packPahadiPichodi from '../assets/images/products/pack-pahadi-pichodi.webp'
import packRingaalBasket from '../assets/images/products/pack-ringaal-basket.webp'
import packAipanArt from '../assets/images/products/pack-aipan-art.webp'
import packJhangora from '../assets/images/products/pack-jhangora.webp'
import packFestivalHamper from '../assets/images/products/pack-festival-hamper.webp'
import packOrganicGiftBox from '../assets/images/products/pack-organic-gift-box.webp'
import { capitalizeWords } from '../utils/text'
import {
  PRODUCT_PRICING,
  sizeWeight,
  nicePrice,
} from '@pahadlink/shared/catalog'
import { STOCK_DEFAULTS } from '@pahadlink/shared/inventoryDefaults'

/** Home hero slides — 2:1 art with the subject right, copy space left */
export const productBanners = [
  {
    id: 'raw-honey',
    alt: 'Raw forest honey from the Himalayas',
    title: 'Raw forest honey',
    text: 'Pure, unprocessed honey from Himalayan apiaries.',
    image: homeBannerHoney,
  },
  {
    id: 'pahadi-rajma',
    alt: 'Pahadi rajma - kidney beans from the hills',
    title: 'Pahadi rajma',
    text: 'Hill-grown kidney beans with deep, earthy flavour.',
    image: homeBannerOrganic,
  },
  {
    id: 'bal-mithai',
    alt: 'Almora bal mithai and traditional pahadi sweets',
    title: 'Almora bal mithai',
    text: 'Classic hill sweets made the traditional way.',
    image: homeBannerSweets,
  },
]

/** Home page offer banners — first item is featured */
export const homeOffers = [
  {
    id: 'first-order',
    eyebrow: 'First order only',
    title: 'Flat ₹75 off + free delivery',
    text: 'Welcome offer for new customers. Later orders: delivery from ₹39.',
    code: 'PAHAD15',
    cta: 'Shop the offer',
    href: '/shop?tag=bestseller',
    image: offerMixProducts,
    featured: true,
  },
  {
    id: 'free-ship',
    eyebrow: 'Delivery',
    title: 'Free shipping above ₹499',
    text: 'Repeat orders: ₹39 delivery below ₹499. First order always free.',
    cta: 'Browse shop',
    href: '/shop',
    image: offerFreeShip,
  },
  {
    id: 'honey-buransh',
    eyebrow: 'Kitchen picks',
    title: 'Honey & buransh favourites',
    text: 'Pure forest honey and rhododendron squash.',
    cta: 'Explore now',
    href: '/shop?tag=trending',
    image: offerHoneyBuransh,
  },
]

/**
 * Category landing copy — edit `eyebrow` / `name` / `headline` / `blurb` here.
 * Banner images stay product-only; text is HTML overlay on the category page.
 */
export const categoryGroups = [
  {
    id: 'organic-food',
    name: 'Organic Foods',
    eyebrow: 'Pahadlink · Organic',
    headline: 'Hill staples for everyday cooking',
    blurb: 'Rajma, dals, millets, and rice from Himalayan farms — clean, honest, and packed for your kitchen.',
    banner: bannerOrganic,
    cover: categoryBannerOrganic,
    items: [
      { name: 'Mandua' },
      { name: 'Jhangora' },
      { name: 'Pahadi Rajma' },
      { name: 'Gahat Dal' },
      { name: 'Bhatt Dal' },
      { name: 'Red Rice' },
    ],
  },
  {
    id: 'honey-natural',
    name: 'Natural Products',
    eyebrow: 'Pahadlink · Natural',
    headline: 'From forest to your table',
    blurb: 'Raw honey, buransh squash, and natural pantry picks gathered with care from the hills.',
    banner: bannerHoney,
    cover: categoryBannerHoney,
    items: [
      { name: 'Raw Honey' },
      { name: 'Buransh Squash' },
      { name: 'Jams' },
      { name: 'Pickles' },
      { name: 'Spices' },
    ],
  },
  {
    id: 'clothing',
    name: 'Pahadi Clothing',
    eyebrow: 'Pahadlink · Clothing',
    headline: 'Wear the craft of the hills',
    blurb: 'Pahadi topi, pichodi, handwoven fabrics, and warm pieces made with traditional skill.',
    banner: bannerClothing,
    cover: categoryBannerClothing,
    items: [
      { name: 'Pahadi Topi' },
      { name: 'Pahadi Pichodi' },
      { name: 'Woolen Shawls' },
      { name: 'Traditional Wear' },
      { name: 'Handwoven Fabric' },
    ],
  },
  {
    id: 'handicrafts',
    name: 'Handicrafts & Home Decor',
    eyebrow: 'Pahadlink · Handmade',
    headline: 'Handmade by hill artisans',
    blurb: 'Bamboo, wood, copper craft, and Aipan art that brings pahadi making into your home.',
    banner: bannerHandicrafts,
    cover: categoryBannerHandicrafts,
    items: [
      { name: 'Wooden Crafts' },
      { name: 'Ringaal Bamboo' },
      { name: 'Copper Ware' },
      { name: 'Aipan Art' },
      { name: 'Handmade Gifts' },
    ],
  },
  {
    id: 'snacks-sweets',
    name: 'Traditional Sweets',
    eyebrow: 'Pahadlink · Sweets',
    headline: 'Taste of home, made traditional',
    blurb: 'Bal mithai, singori, and classic hill sweets prepared the way you remember.',
    banner: bannerSweets,
    cover: categoryBannerSweets,
    items: [
      { name: 'Bal Mithai' },
      { name: 'Singori' },
      { name: 'Rus' },
      { name: 'Pahadi Snacks' },
    ],
  },
  {
    id: 'gift-hampers',
    name: 'Gifts & Souvenirs',
    eyebrow: 'Pahadlink · Gifting',
    headline: 'Share pahadi taste with love',
    blurb: 'Festival hampers and organic gift boxes ready to send warmth from the hills.',
    banner: bannerGifts,
    cover: categoryBannerGifts,
    items: [
      { name: 'Festival Hampers' },
      { name: 'Organic Gift Boxes' },
    ],
  },
]

export const features = [
  {
    title: 'Direct from the Hills',
    desc: 'We work with pahadi farmers and artisans - not middlemen - so you get real mountain products at fair prices.',
    points: ['Village-sourced goods', 'Fair pay for makers', 'Authentic hill recipes'],
  },
  {
    title: 'Pure, Not Processed',
    desc: 'No bulk blending, no artificial fillers. What you order is what grows and is made in the mountains.',
    points: ['No preservatives', 'Farm-fresh batches', 'Clean ingredient labels'],
  },
  {
    title: 'Trusted Every Order',
    desc: 'Checked, packed with care, and delivered safely - so quality stays the same from first order to repeat.',
    points: ['Quality checks', 'Secure packaging', 'Reliable delivery'],
  },
]

export const testimonials = [
  {
    name: 'Mukesh Rawat',
    location: 'Dehradun',
    rating: 5,
    product: 'Raw Forest Honey',
    text: 'Fresh, authentic pahadi products every time. Packaging is neat and delivery reached us faster than expected.',
  },
  {
    name: 'Tejas Rawat',
    location: 'Nainital',
    rating: 5,
    product: 'Pahadi Rajma',
    text: 'Real Himalayan taste - honey, rajma, and snacks feel homemade and pure. Already reordered twice.',
  },
  {
    name: 'Babita Rawat',
    location: 'Delhi',
    rating: 5,
    product: 'Bal Mithai',
    text: 'Bal mithai tasted just like home. Gift packing was lovely and my family asked where I ordered from.',
  },
]

/** Home product catalogues — pricing from shared; presentation stays here */
const PRODUCT_PRESENTATION = {
  'pahadi-rajma': {
    image: packPahadiRajma,
    compareAt: 399,
    rating: 4.8,
    tags: ['bestseller', 'trending'],
    categoryId: 'organic-food',
    subcategory: 'Pahadi Rajma',
  },
  'raw-honey': {
    image: packRawHoney,
    compareAt: 499,
    rating: 4.9,
    tags: ['bestseller', 'handpicked'],
    categoryId: 'honey-natural',
    subcategory: 'Raw Honey',
  },
  'mandua-flour': {
    image: packManduaFlour,
    compareAt: 279,
    rating: 4.7,
    tags: ['bestseller', 'trending'],
    categoryId: 'organic-food',
    subcategory: 'Mandua',
  },
  'gahat-dal': {
    image: packGahatDal,
    compareAt: 299,
    rating: 4.6,
    tags: ['bestseller'],
    categoryId: 'organic-food',
    subcategory: 'Gahat Dal',
  },
  'red-rice': {
    image: packRedRice,
    compareAt: 449,
    rating: 4.8,
    tags: ['trending', 'handpicked'],
    categoryId: 'organic-food',
    subcategory: 'Red Rice',
  },
  'bal-mithai': {
    image: packBalMithai,
    compareAt: 549,
    rating: 4.9,
    tags: ['bestseller', 'trending'],
    categoryId: 'snacks-sweets',
    subcategory: 'Bal Mithai',
  },
  singori: {
    image: packSingori,
    compareAt: 469,
    rating: 4.8,
    tags: ['trending', 'handpicked'],
    categoryId: 'snacks-sweets',
    subcategory: 'Singori',
    description:
      'Singori from Almora — soft khoya sweetened with sugar and cardamom, hand-rolled into a cone and wrapped in a fresh malu leaf. The leaf gives it the faint woody aroma that makes this Kumaoni sweet unmistakable.',
    highlights: [
      'Traditional Kumaoni khoya sweet from Almora',
      'Hand-wrapped in fresh malu (maalu) leaf',
      'Cardamom flavoured, no artificial colours',
      'Best enjoyed fresh within a few days',
    ],
    details: [
      { label: 'Category', value: 'Traditional Sweets' },
      { label: 'Type', value: 'Singori / Khoya sweet' },
      { label: 'Flavour', value: 'Khoya with green cardamom' },
      { label: 'Origin', value: 'Almora, Uttarakhand' },
      { label: 'Shelf life', value: 'Best within 4 days' },
    ],
  },
  'buransh-squash': {
    image: packBuranshSquash,
    compareAt: 399,
    rating: 4.8,
    tags: ['trending', 'handpicked'],
    categoryId: 'honey-natural',
    subcategory: 'Jams',
  },
  'pahadi-topi': {
    image: packPahadiTopi,
    compareAt: 699,
    rating: 4.5,
    tags: ['handpicked'],
    categoryId: 'clothing',
    subcategory: 'Pahadi Topi',
  },
  'pahadi-pichodi': {
    image: packPahadiPichodi,
    compareAt: 699,
    rating: 4.8,
    tags: ['bestseller', 'handpicked', 'trending'],
    categoryId: 'clothing',
    subcategory: 'Pahadi Pichodi',
    description:
      'Authentic Rangwali Pahadi Pichodi (Pichoda) from Kumaon — saffron-orange cloth with deep red floral and honeycomb print, traditional ceremonial motifs, and an ornate gold gota border. A ceremonial wrap for weddings and festivals, finished by hill artisans.',
    highlights: [
      'Traditional Kumaoni Rangwali Pichodi',
      'Saffron-orange body with dense red floral block print',
      'Gold sequin and gota border finish',
      'Ideal for weddings, festivals, and gifting',
    ],
    details: [
      { label: 'Category', value: 'Pahadi Clothing' },
      { label: 'Type', value: 'Pahadi Pichodi / Rangwali Pichoda' },
      { label: 'Colour', value: 'Saffron orange with red border' },
      { label: 'Origin', value: 'Kumaon, Uttarakhand' },
      { label: 'Fit', value: 'Free size wrap' },
    ],
  },
  'ringaal-basket': {
    image: packRingaalBasket,
    compareAt: 899,
    rating: 4.6,
    tags: ['handpicked'],
    categoryId: 'handicrafts',
    subcategory: 'Ringaal Bamboo',
  },
  'aipan-art': {
    image: packAipanArt,
    compareAt: 999,
    rating: 4.8,
    tags: ['handpicked', 'trending'],
    categoryId: 'handicrafts',
    subcategory: 'Aipan Art',
    highlights: [
      'Handpainted Kumaoni Aipan folk motifs',
      'Traditional red-and-white geometric patterns',
      'Ready to hang or display as home decor',
      'Crafted by hill artisans of Uttarakhand',
    ],
    details: [
      { label: 'Category', value: 'Handicrafts & Home Decor' },
      { label: 'Type', value: 'Aipan Art Plate' },
      { label: 'Style', value: 'Traditional Kumaoni folk art' },
      { label: 'Origin', value: 'Kumaon, Uttarakhand' },
      { label: 'Finish', value: 'Handpainted wood' },
    ],
  },
  jhangora: {
    image: packJhangora,
    compareAt: 249,
    rating: 4.7,
    tags: ['bestseller', 'trending'],
    categoryId: 'organic-food',
    subcategory: 'Jhangora',
  },
  'festival-hamper': {
    image: packFestivalHamper,
    compareAt: 1799,
    rating: 4.9,
    tags: ['bestseller', 'handpicked'],
    categoryId: 'gift-hampers',
    subcategory: 'Festival Hampers',
  },
  'organic-gift-box': {
    image: packOrganicGiftBox,
    compareAt: 1249,
    rating: 4.8,
    tags: ['trending', 'handpicked'],
    categoryId: 'gift-hampers',
    subcategory: 'Organic Gift Boxes',
  },
}

const productCatalog = PRODUCT_PRICING.map((item) => ({
  ...item,
  ...(PRODUCT_PRESENTATION[item.id] || {}),
}))

/** Static stock defaults (from shared; live stock overlays via API) */
const STOCK_OVERRIDES = STOCK_DEFAULTS


/** Live stock from API (GET /orders/stock) — overlays static defaults */
let liveStockById = null

export function setLiveStockOverlay(items) {
  if (!Array.isArray(items)) {
    liveStockById = null
    return
  }
  const map = Object.create(null)
  for (const row of items) {
    const id = String(row.productId || '').trim()
    if (!id) continue
    map[id] = {
      stock: typeof row.stock === 'number' ? row.stock : null,
      stockBySize: row.stockBySize || null,
    }
  }
  liveStockById = map
}

export const products = productCatalog.map((product) => {
  const override = STOCK_OVERRIDES[product.id] || {}
  return {
    ...product,
    ...override,
    stock:
      typeof override.stock === 'number'
        ? override.stock
        : typeof product.stock === 'number'
          ? product.stock
          : null,
    name: capitalizeWords(product.name),
  }
})

export const getProductsByTag = (tag) =>
  products.filter((p) => p.tags.includes(tag))

/** Units available for a product size (0 = out of stock) */
export const getVariantStock = (product, size) => {
  if (!product) return 0
  if (product.inStock === false) return 0

  const label = size || product.sizes?.[0]
  const live = liveStockById?.[product.id]
  if (live) {
    if (
      live.stockBySize &&
      label != null &&
      Object.prototype.hasOwnProperty.call(live.stockBySize, label)
    ) {
      return Math.max(0, Number(live.stockBySize[label]) || 0)
    }
    if (typeof live.stock === 'number') {
      return Math.max(0, live.stock)
    }
    if (live.stockBySize) return 0
  }

  if (
    product.stockBySize &&
    label != null &&
    Object.prototype.hasOwnProperty.call(product.stockBySize, label)
  ) {
    return Math.max(0, Number(product.stockBySize[label]) || 0)
  }

  if (typeof product.stock === 'number') {
    return Math.max(0, product.stock)
  }

  // No inventing stock — wait for live overlay or use product overrides only
  return 0
}

export const isVariantInStock = (product, size) =>
  getVariantStock(product, size) > 0

export const isProductInStock = (product) => {
  if (!product) return false
  if (product.inStock === false) return false
  const variants = getProductVariants(product)
  if (!variants.length) return getVariantStock(product) > 0
  return variants.some((v) => v.stock > 0)
}

export const getStockStatus = (product, size) => {
  const stock = getVariantStock(product, size)
  if (stock <= 0) {
    return { stock: 0, inStock: false, lowStock: false, label: 'Out of stock' }
  }
  if (stock <= 5) {
    return {
      stock,
      inStock: true,
      lowStock: true,
      label: `Only ${stock} left`,
    }
  }
  return { stock, inStock: true, lowStock: false, label: 'In stock' }
}

/**
 * Size options with price for a product.
 * Base `price` / `compareAt` apply to the first size; larger sizes scale up with a small bulk discount.
 * Optional product.variants overrides auto pricing.
 * Pricing math comes from @pahadlink/shared/catalog.
 */
export const getProductVariants = (product) => {
  if (!product) return []

  if (product.variants?.length) {
    return product.variants.map((v) => ({
      size: v.size,
      price: v.price,
      compareAt: v.compareAt ?? v.price,
      stock:
        typeof v.stock === 'number'
          ? Math.max(0, v.stock)
          : getVariantStock(product, v.size),
    }))
  }

  const sizes = product.sizes?.length ? product.sizes : ['Default']
  const weights = sizes.map(sizeWeight)
  const baseWeight = weights[0] || 1

  return sizes.map((size, index) => {
    const ratio = weights[index] / baseWeight
    const bulk =
      ratio > 1 ? 1 - Math.min(0.12, (Math.sqrt(ratio) - 1) * 0.08) : 1
    return {
      size,
      price: index === 0 ? product.price : nicePrice(product.price * ratio * bulk),
      compareAt:
        index === 0
          ? product.compareAt
          : nicePrice(product.compareAt * ratio * bulk),
      stock: getVariantStock(product, size),
    }
  })
}

export const getVariantBySize = (product, size) => {
  const variants = getProductVariants(product)
  if (!variants.length) {
    return {
      size: size || 'Default',
      price: product?.price || 0,
      compareAt: product?.compareAt || 0,
      stock: getVariantStock(product, size),
    }
  }
  return variants.find((v) => v.size === size) || variants[0]
}

export const getProductMinPrice = (product) => {
  const variants = getProductVariants(product)
  return variants.reduce(
    (min, v) => Math.min(min, v.price),
    variants[0]?.price ?? product.price
  )
}

export const getProductMaxPrice = (product) => {
  const variants = getProductVariants(product)
  return variants.reduce(
    (max, v) => Math.max(max, v.price),
    variants[0]?.price ?? product.price
  )
}

export const productMatchesPrice = (product, min, max, sizeFilter = []) => {
  const variants = getProductVariants(product)
  const pool = sizeFilter.length
    ? variants.filter((v) => sizeFilter.includes(v.size))
    : variants

  if (!pool.length) return false

  return pool.some((v) => {
    if (min != null && !Number.isNaN(min) && v.price < min) return false
    if (max != null && !Number.isNaN(max) && v.price > max) return false
    return true
  })
}

export const getCategoryById = (id) =>
  categoryGroups.find((group) => group.id === id) || null

/** Score how well a product matches a search query (0 = no match). */
export const scoreProductMatch = (product, query) => {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return 0

  const name = String(product.name || '').toLowerCase()
  const sub = String(product.subcategory || '').toLowerCase()
  const category = getCategoryById(product.categoryId)?.name?.toLowerCase() || ''
  const tags = (product.tags || []).join(' ').toLowerCase()
  const haystack = `${name} ${sub} ${category} ${tags}`

  if (name === q || sub === q) return 100
  if (name.startsWith(q) || sub.startsWith(q)) return 90
  if (name.includes(q)) return 75
  if (sub.includes(q)) return 65
  if (category.includes(q)) return 55
  if (tags.includes(q)) return 45
  // multi-word: all tokens must appear somewhere
  const tokens = q.split(/\s+/).filter(Boolean)
  if (tokens.length > 1 && tokens.every((t) => haystack.includes(t))) return 40
  return 0
}

export const getProductsByCategory = (categoryId, { subcategory } = {}) => {
  if (!categoryId) return []

  return products.filter((product) => {
    if (product.categoryId !== categoryId) return false
    if (!subcategory) return true
    const needle = String(subcategory).trim().toLowerCase()
    return String(product.subcategory || '')
      .trim()
      .toLowerCase()
      .includes(needle)
  })
}

const getCategoryProductCount = (categoryId) =>
  getProductsByCategory(categoryId).length

/** Single promo banner for a category landing hero */
export const getCategoryBanner = (categoryId) => {
  const category = getCategoryById(categoryId)
  if (!category) return null

  // Only 16:3 artwork here — square pack shots would be cropped to a sliver.
  const image = category.banner || bannerOrganic

  return {
    id: category.id,
    image,
    alt: `${category.name} from the Himalayas`,
    eyebrow: category.eyebrow || 'Pahadlink',
    title: category.name,
    headline: category.headline || category.name,
    blurb: category.blurb || '',
  }
}

/** Related categories with image + product count for discovery cards */
export const getRelatedCategories = (categoryId, limit = 4) =>
  categoryGroups
    .filter((group) => group.id !== categoryId)
    .slice(0, limit)
    .map((group) => {
      const count = getCategoryProductCount(group.id)
      const cover =
        group.cover || getProductsByCategory(group.id)[0]?.image || null
      return {
        ...group,
        count,
        cover,
      }
    })

export const getProductById = (id) => {
  const product = products.find((p) => p.id === id)
  if (!product) return null

  const category = categoryGroups.find((g) => g.id === product.categoryId)
  const variants = getProductVariants(product)

  return {
    ...product,
    variants,
    categoryName: category?.name || 'Shop',
    images: product.images || [product.image, product.image, product.image],
    description:
      product.description ||
      `${product.name.split('|')[0].trim()} is sourced from Himalayan growers and packed with care for everyday pahadi kitchens. Fresh taste, honest ingredients, and no unnecessary processing.`,
    highlights: product.highlights || [
      'Sourced from Uttarakhand / Himachal makers',
      'Clean packing for pan-India delivery',
      'No artificial preservatives',
      'Best enjoyed fresh after opening',
    ],
    details: product.details || [
      { label: 'Category', value: category?.name || '-' },
      { label: 'Type', value: product.subcategory || '-' },
      { label: 'Origin', value: 'Himalayan hills, India' },
    ],
  }
}

/** Resolve storefront image for cart/order line items (API often has no image URL). */
export function resolveProductImage(item) {
  if (!item) return ''
  if (item.image) return item.image

  const id = String(item.productId || item.id || '').trim()
  if (id) {
    const byId = products.find((p) => p.id === id)
    if (byId?.image) return byId.image
  }

  const name = String(item.name || '')
    .trim()
    .toLowerCase()
  if (!name) return ''

  const exact = products.find((p) => p.name.toLowerCase() === name)
  if (exact?.image) return exact.image

  const left = name.split('|')[0].trim()
  const byPrefix = products.find((p) => {
    const pLeft = p.name.toLowerCase().split('|')[0].trim()
    return pLeft === left || name.includes(pLeft) || pLeft.includes(left)
  })
  return byPrefix?.image || ''
}

export const getRelatedProducts = (product, limit = 10) => {
  if (!product) return []
  const sameCategory = products.filter(
    (p) => p.id !== product.id && p.categoryId === product.categoryId
  )
  if (sameCategory.length >= limit) return sameCategory.slice(0, limit)

  const sameTag = products.filter(
    (p) =>
      p.id !== product.id &&
      !sameCategory.some((s) => s.id === p.id) &&
      p.tags.some((t) => product.tags.includes(t))
  )

  const rest = products.filter(
    (p) =>
      p.id !== product.id &&
      !sameCategory.some((s) => s.id === p.id) &&
      !sameTag.some((s) => s.id === p.id)
  )

  return [...sameCategory, ...sameTag, ...rest].slice(0, limit)
}

export const getAllSizes = () => {
  const set = new Set()
  products.forEach((p) => p.sizes.forEach((s) => set.add(s)))
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

export const getPriceBounds = () => {
  if (!products.length) return { min: 0, max: 0 }
  let min = Infinity
  let max = 0
  products.forEach((p) => {
    getProductVariants(p).forEach((v) => {
      if (v.price < min) min = v.price
      if (v.price > max) max = v.price
    })
  })
  return { min: min === Infinity ? 0 : min, max }
}

export const productTabs = [
  { id: 'bestseller', label: 'Best Sellers' },
  { id: 'trending', label: 'Trending' },
  { id: 'handpicked', label: 'Handpicked' },
]
