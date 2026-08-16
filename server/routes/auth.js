import { Router } from 'express'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { ROLES } from '../models/User.js'
import { users, getAuthStoreMode } from '../services/users.js'
import { protect, authorize, signToken } from '../middleware/auth.js'
import { isFileDbMode, connectDB } from '../config/db.js'
import { PASSWORD_MIN_LENGTH } from '../config/constants.js'
import { verifyFirebaseIdToken } from '../services/verifyFirebaseIdToken.js'
import { sendMail } from '../services/mail.js'

const router = Router()

function authResponse(user) {
  return {
    token: signToken(user),
    user: user.toSafeJSON(),
    store: getAuthStoreMode(),
  }
}

/** Ensure Mongo (preferred) or file-store is ready before auth writes. */
async function ensureAuthStore(res) {
  let mode = getAuthStoreMode()
  if (mode === 'mongo' || mode === 'file') return mode

  try {
    await connectDB()
  } catch {
    // connectDB already logs; fall through
  }

  mode = getAuthStoreMode()
  if (mode === 'mongo' || mode === 'file') return mode

  res.status(503).json({
    message:
      'Database is unavailable. Keep MongoDB running and restart the API (npm run server).',
    store: 'unavailable',
    mongoState: mongoose.connection.readyState,
  })
  return null
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/** POST /api/auth/register — create customer in MongoDB (or file fallback) */
router.post('/register', async (req, res) => {
  try {
    const store = await ensureAuthStore(res)
    if (!store) return undefined

    const name = String(req.body.name || '').trim()
    const email = String(req.body.email || '').trim().toLowerCase()
    let username = String(req.body.username || '').trim().toLowerCase()
    const password = String(req.body.password || '')

    if (!username && email.includes('@')) {
      username = email
        .split('@')[0]
        .replace(/[^a-z0-9._-]/g, '')
        .slice(0, 24)
    }

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' })
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Enter a valid email address' })
    }

    if (!username || username.length < 3) {
      username = `user${Date.now().toString(36).slice(-6)}`
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      return res.status(400).json({
        message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
      })
    }

    const emailTaken = await users.findOne({ email }, { select: '+password' })
    if (emailTaken) {
      if (emailTaken.googleId && !emailTaken.password) {
        return res.status(409).json({
          message:
            'This email is already registered with Google. Please sign in with Google.',
        })
      }
      return res.status(409).json({
        message: 'Email already registered. Please sign in.',
      })
    }

    let uniqueUsername = username.slice(0, 30)
    let attempt = 0
    while (await users.findOne({ username: uniqueUsername })) {
      attempt += 1
      const suffix = String(Math.floor(100 + Math.random() * 900))
      uniqueUsername = `${username.slice(0, 26)}${suffix}`
      if (attempt > 8) {
        return res
          .status(409)
          .json({ message: 'Could not create a unique username. Try again.' })
      }
    }

    await users.create({
      name,
      email,
      username: uniqueUsername,
      password,
      role: 'customer',
    })

    // Confirm the account actually landed in the active store
    // Re-fetch with password selected so login immediately after signup works
    const saved = await users.findOne({ email })
    if (!saved) {
      return res.status(500).json({
        message: 'Account was not saved to the database. Please try again.',
        store,
      })
    }

    console.log(`[auth] register ok email=${saved.email} store=${store} id=${saved.id || saved._id}`)
    return res.status(201).json(authResponse(saved))
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Email or username already registered' })
    }
    if (error.name === 'ValidationError') {
      const first = Object.values(error.errors || {})[0]
      return res.status(400).json({
        message: first?.message || 'Invalid registration details',
      })
    }
    return res.status(500).json({ message: error.message || 'Registration failed' })
  }
})

/** POST /api/auth/login */
router.post('/login', async (req, res) => {
  try {
    const store = await ensureAuthStore(res)
    if (!store) return undefined

    const username = String(req.body.username || '').trim().toLowerCase()
    const password = String(req.body.password || '')

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' })
    }

    const user = await users.findOne(
      { $or: [{ username }, { email: username }] },
      { select: '+password' }
    )

    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' })
    }

    if (!user.password && user.googleId) {
      return res.status(400).json({
        message:
          'This account uses Google sign-in. Please continue with Google.',
      })
    }

    if (!(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid username or password' })
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated' })
    }

    return res.json(authResponse(user))
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Login failed' })
  }
})

/** POST /api/auth/forgot-password */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) {
      return res.status(400).json({ message: 'Email is required' })
    }

    const user = await users.findOne({ email: email.toLowerCase().trim() })
    const okMessage = {
      message: 'If an account exists with that email, reset instructions have been sent.',
    }

    if (!user) {
      return res.json(okMessage)
    }

    const resetToken = crypto.randomBytes(32).toString('hex')
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex')
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000)
    await user.save({ validateBeforeSave: false })

    const front =
      (process.env.FRONTEND_URL || '')
        .split(',')
        .map((s) => s.trim())
        .find(Boolean) || 'http://localhost:5173'
    let base = front.replace(/\/$/, '')
    // GitHub Pages project site: https://1mukeshr.github.io/pahadlink-harvest/
    try {
      const u = new URL(base)
      if (
        /\.github\.io$/i.test(u.hostname) &&
        (u.pathname === '/' || u.pathname === '')
      ) {
        base = `${u.origin}/pahadlink-harvest`
      }
    } catch {
      // keep base as-is
    }
    const resetUrl = `${base}/reset-password?token=${encodeURIComponent(resetToken)}`

    await sendMail({
      to: user.email,
      subject: 'Reset your PahadLink password',
      html: `
        <p>Hi ${user.name || 'there'},</p>
        <p>We received a request to reset your password. Use this link within 1 hour:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>If you did not request this, you can ignore this email.</p>
      `,
    })

    const payload = { ...okMessage }
    if (process.env.NODE_ENV !== 'production') {
      payload.devResetToken = resetToken
      payload.devHint = 'Use POST /api/auth/reset-password with this token (dev only)'
    }

    return res.json(payload)
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Request failed' })
  }
})

/** POST /api/auth/reset-password */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body
    if (!token || !password) {
      return res.status(400).json({ message: 'Token and new password are required' })
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      return res.status(400).json({
        message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
      })
    }

    const hashed = crypto.createHash('sha256').update(token).digest('hex')
    const user = await users.findOne(
      {
        resetPasswordToken: hashed,
        resetPasswordExpires: { $gt: new Date() },
      },
      { select: '+resetPasswordToken +resetPasswordExpires' }
    )

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' })
    }

    if (isFileDbMode()) {
      user.password = await bcrypt.hash(password, 10)
    } else {
      user.password = password
    }
    user.resetPasswordToken = undefined
    user.resetPasswordExpires = undefined
    await user.save()

    return res.json({ message: 'Password updated successfully. You can sign in now.' })
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Reset failed' })
  }
})

/** POST /api/auth/google — Firebase Google ID token → app JWT session (Mongo) */
router.post('/google', async (req, res) => {
  try {
    const store = await ensureAuthStore(res)
    if (!store) return undefined

    const idToken = String(req.body.idToken || req.body.credential || '').trim()
    if (!idToken) {
      return res.status(400).json({ message: 'Google sign-in token is required' })
    }

    const decoded = await verifyFirebaseIdToken(idToken)
    const googleId = String(decoded.sub || '').trim()
    const email = String(decoded.email || '')
      .trim()
      .toLowerCase()
    const name = String(
      decoded.name || decoded.email?.split?.('@')?.[0] || 'Google user'
    ).trim()

    if (!googleId || !email) {
      return res.status(400).json({
        message: 'Google account is missing email. Use an account with email access.',
      })
    }

    // Find by Google UID, else link existing email account, else create customer
    let user = await users.findOne({ googleId })
    let created = false

    if (!user) {
      user = await users.findOne({ email })
      if (user) {
        user.googleId = googleId
        if (name && (!user.name || user.name === 'Google user')) {
          user.name = name
        }
        await user.save()
      }
    }

    if (!user) {
      let base =
        email
          .split('@')[0]
          .replace(/[^a-z0-9._-]/g, '')
          .slice(0, 24) || 'user'
      if (base.length < 3) base = `user${base}`

      let uniqueUsername = base.slice(0, 30)
      let attempt = 0
      while (await users.findOne({ username: uniqueUsername })) {
        attempt += 1
        const suffix = String(Math.floor(100 + Math.random() * 900))
        uniqueUsername = `${base.slice(0, 26)}${suffix}`
        if (attempt > 8) {
          return res.status(409).json({ message: 'Could not create account. Try again.' })
        }
      }

      user = await users.create({
        name: name || email.split('@')[0],
        email,
        username: uniqueUsername,
        googleId,
        role: 'customer',
      })
      created = true
    }

    // Confirm row exists in the active store (Mongo preferred)
    const saved =
      (await users.findOne({ googleId })) || (await users.findOne({ email }))
    if (!saved) {
      return res.status(500).json({
        message: 'Google account was not saved to the database. Please try again.',
        store,
      })
    }

    if (!saved.isActive) {
      return res.status(403).json({ message: 'Account is deactivated' })
    }

    const payload = authResponse(saved)
    payload.created = created
    return res.json(payload)
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'This Google account or email is already registered. Try signing in.',
      })
    }
    if (error.name === 'ValidationError') {
      const first = Object.values(error.errors || {})[0]
      return res.status(400).json({
        message: first?.message || 'Could not create Google account',
      })
    }
    const status = error.status || 500
    return res.status(status).json({
      message: error.message || 'Google login failed',
    })
  }
})

router.get('/me', protect, (req, res) => {
  res.json({ user: req.user.toSafeJSON() })
})

const MAX_CART_LINES = 40
const MAX_WISHLIST = 60

function sanitizeCart(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  const seen = new Set()
  for (const row of raw.slice(0, MAX_CART_LINES * 2)) {
    const id = String(row?.id || '').trim()
    const size = String(row?.size || '').trim()
    const key = String(row?.key || `${id}::${size}`).trim()
    if (!id || !key || seen.has(key)) continue
    const qty = Math.min(99, Math.max(1, Number(row?.qty) || 1))
    const price = Math.max(0, Number(row?.price) || 0)
    seen.add(key)
    out.push({
      key,
      id,
      name: String(row?.name || '').trim().slice(0, 120),
      image: String(row?.image || '').trim().slice(0, 500),
      price,
      size,
      qty,
    })
    if (out.length >= MAX_CART_LINES) break
  }
  return out
}

function sanitizeWishlist(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  const seen = new Set()
  for (const row of raw.slice(0, MAX_WISHLIST * 2)) {
    const id = String(row?.id || '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push({
      id,
      name: String(row?.name || '').trim().slice(0, 120),
      image: String(row?.image || '').trim().slice(0, 500),
      price: Math.max(0, Number(row?.price) || 0),
    })
    if (out.length >= MAX_WISHLIST) break
  }
  return out
}

/** GET /api/auth/bag — cart + wishlist for the signed-in account */
router.get('/bag', protect, async (req, res) => {
  try {
    const user = await users.findById(req.user._id || req.user.id)
    if (!user) return res.status(404).json({ message: 'User not found' })
    return res.json({
      cart: sanitizeCart(user.cart),
      wishlist: sanitizeWishlist(user.wishlist),
    })
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to load bag' })
  }
})

/** PUT /api/auth/bag — replace account cart + wishlist (cross-device sync) */
router.put('/bag', protect, async (req, res) => {
  try {
    const cart = sanitizeCart(req.body?.cart)
    const wishlist = sanitizeWishlist(req.body?.wishlist)
    const user = await users.findByIdAndUpdate(req.user._id || req.user.id, {
      cart,
      wishlist,
    })
    if (!user) return res.status(404).json({ message: 'User not found' })
    return res.json({
      cart: sanitizeCart(user.cart),
      wishlist: sanitizeWishlist(user.wishlist),
    })
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to save bag' })
  }
})

router.patch('/users/:id/role', protect, authorize('admin'), async (req, res) => {
  try {
    const { role } = req.body
    if (!ROLES.includes(role)) {
      return res.status(400).json({
        message: `Invalid role. Allowed: ${ROLES.join(', ')}`,
      })
    }

    const user = await users.findByIdAndUpdate(req.params.id, { role })
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    return res.json({
      message: `Role updated to ${role}`,
      user: user.toSafeJSON(),
    })
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Role update failed' })
  }
})

router.get('/users', protect, authorize('admin'), async (_req, res) => {
  const list = await users.findAllSorted()
  res.json({ users: list.map((u) => u.toSafeJSON()) })
})

export default router
