import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { fileURLToPath } from 'url'
import { ROLES, DEFAULT_ROLE } from '../config/constants.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.resolve(__dirname, '../../.data')
const usersFile = path.join(dataDir, 'users.json')

function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(usersFile, JSON.stringify({ users: [] }, null, 2))
  }
}

function readUsers() {
  ensureStore()
  try {
    const raw = JSON.parse(fs.readFileSync(usersFile, 'utf8'))
    return Array.isArray(raw.users) ? raw.users : []
  } catch {
    return []
  }
}

function writeUsers(users) {
  ensureStore()
  fs.writeFileSync(usersFile, JSON.stringify({ users }, null, 2))
}

function toSafeJSON(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    role: user.role,
    phone: user.phone || null,
    isPhoneVerified: Boolean(user.isPhoneVerified),
    hasGoogle: Boolean(user.googleId),
    createdAt: user.createdAt,
  }
}

function wrap(user) {
  return {
    ...user,
    _id: user.id,
    comparePassword(candidate) {
      if (!user.password) return Promise.resolve(false)
      return bcrypt.compare(candidate, user.password)
    },
    toSafeJSON() {
      return toSafeJSON(user)
    },
    async save() {
      // Persist fields assigned onto this wrap (e.g. cart/wishlist updates)
      const {
        comparePassword: _c,
        toSafeJSON: _t,
        save: _s,
        _id: _i,
        ...fields
      } = this
      Object.assign(user, fields)
      const users = readUsers()
      const idx = users.findIndex((u) => u.id === user.id)
      if (idx >= 0) users[idx] = user
      else users.push(user)
      writeUsers(users)
      return wrap(user)
    },
  }
}

export const fileUserStore = {
  enabled: false,

  enable() {
    this.enabled = true
    ensureStore()
    console.log(`File user store ready → ${usersFile}`)
  },

  async findOne(query = {}) {
    const users = readUsers()
    const found = users.find((u) => {
      if (query.googleId && u.googleId === String(query.googleId)) return true
      if (query.email && u.email === String(query.email).toLowerCase()) return true
      if (query.username && u.username === String(query.username).toLowerCase()) return true
      if (query.id && u.id === query.id) return true
      if (query._id && u.id === String(query._id)) return true
      if (query.$or) {
        return query.$or.some((clause) => {
          if (clause.googleId && u.googleId === String(clause.googleId)) return true
          if (clause.email && u.email === String(clause.email).toLowerCase()) return true
          if (clause.username && u.username === String(clause.username).toLowerCase()) return true
          return false
        })
      }
      if (query.resetPasswordToken && u.resetPasswordToken === query.resetPasswordToken) {
        if (query.resetPasswordExpires?.$gt) {
          return new Date(u.resetPasswordExpires) > new Date(query.resetPasswordExpires.$gt)
        }
        return true
      }
      return false
    })
    return found ? wrap(found) : null
  },

  async findById(id) {
    return this.findOne({ id: String(id) })
  },

  async create(payload) {
    const users = readUsers()
    const password = payload.password
      ? await bcrypt.hash(payload.password, 10)
      : undefined
    const user = {
      id: crypto.randomBytes(12).toString('hex'),
      name: payload.name,
      email: String(payload.email).toLowerCase(),
      username: String(payload.username).toLowerCase(),
      password,
      role: payload.role || DEFAULT_ROLE,
      googleId: payload.googleId || null,
      phone: payload.phone || null,
      isPhoneVerified: false,
      isActive: true,
      cart: Array.isArray(payload.cart) ? payload.cart : [],
      wishlist: Array.isArray(payload.wishlist) ? payload.wishlist : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    users.push(user)
    writeUsers(users)
    return wrap(user)
  },

  async find() {
    return readUsers().map(wrap)
  },
}

export { ROLES, toSafeJSON }
