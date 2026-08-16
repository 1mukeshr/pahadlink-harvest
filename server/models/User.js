import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { ROLES, DEFAULT_ROLE } from '../config/constants.js'

export { ROLES }

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    password: {
      type: String,
      required: function requiredPassword() {
        return !this.googleId
      },
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ROLES,
      default: DEFAULT_ROLE,
    },
    googleId: {
      type: String,
      // Omit when unused — sparse unique must not index many `null` values
      unique: true,
      sparse: true,
    },
    phone: {
      type: String,
      default: null,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    /** Account-synced bag — available on every device after login */
    cart: {
      type: [
        new mongoose.Schema(
          {
            key: { type: String, required: true, trim: true },
            id: { type: String, required: true, trim: true },
            name: { type: String, default: '', trim: true },
            image: { type: String, default: '', trim: true },
            price: { type: Number, default: 0, min: 0 },
            size: { type: String, default: '', trim: true },
            qty: { type: Number, default: 1, min: 1, max: 99 },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    wishlist: {
      type: [
        new mongoose.Schema(
          {
            id: { type: String, required: true, trim: true },
            name: { type: String, default: '', trim: true },
            image: { type: String, default: '', trim: true },
            price: { type: Number, default: 0, min: 0 },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
)

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password') || !this.password) return
  this.password = await bcrypt.hash(this.password, 10)
})

userSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.password) return Promise.resolve(false)
  return bcrypt.compare(candidate, this.password)
}

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    username: this.username,
    role: this.role,
    phone: this.phone,
    isPhoneVerified: this.isPhoneVerified,
    hasGoogle: Boolean(this.googleId),
    createdAt: this.createdAt,
  }
}

export default mongoose.model('User', userSchema)
