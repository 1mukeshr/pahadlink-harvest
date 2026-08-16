import mongoose from 'mongoose'

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'out_for_delivery',
  'delivered',
  'cancelled',
]

export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded']

/** PahadLink fulfilment path */
export const STATUS_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'shipped'],
  processing: ['shipped'],
  shipped: ['out_for_delivery', 'delivered'],
  out_for_delivery: ['delivered'],
  delivered: [],
  cancelled: [],
}

export const STATUS_TIMELINE_NOTES = {
  pending: 'Order placed',
  confirmed: 'Order confirmed',
  processing: 'Packed and ready to ship',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered successfully',
  cancelled: 'Order cancelled',
}

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: String, default: '', trim: true },
    name: { type: String, required: true, trim: true },
    size: { type: String, default: '', trim: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
)

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    customerName: { type: String, required: true, trim: true },
    customerEmail: { type: String, required: true, trim: true, lowercase: true },
    customerPhone: { type: String, default: '', trim: true },
    items: {
      type: [orderItemSchema],
      validate: [(v) => v.length > 0, 'At least one item required'],
    },
    totalAmount: { type: Number, required: true, min: 0 },
    itemsTotal: { type: Number, default: 0, min: 0 },
    shippingFee: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    couponCode: { type: String, default: '', trim: true, uppercase: true },
    taxableValue: { type: Number, default: 0, min: 0 },
    gstRate: { type: Number, default: 0.05, min: 0 },
    gstAmount: { type: Number, default: 0, min: 0 },
    cgstAmount: { type: Number, default: 0, min: 0 },
    sgstAmount: { type: Number, default: 0, min: 0 },
    igstAmount: { type: Number, default: 0, min: 0 },
    gstType: {
      type: String,
      enum: ['cgst_sgst', 'igst', ''],
      default: 'cgst_sgst',
    },
    pricesIncludeGst: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: 'pending',
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      enum: ['cod', 'upi', 'card'],
      default: 'cod',
    },
    shippingAddress: {
      line1: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      pincode: { type: String, default: '' },
    },
    trackingNumber: { type: String, default: '', trim: true },
    courier: { type: String, default: '', trim: true },
    assignedSeller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    stockDeducted: { type: Boolean, default: false },
    review: {
      rating: { type: Number, min: 1, max: 5, default: null },
      comment: { type: String, default: '', maxlength: 500 },
      createdAt: { type: Date, default: null },
    },
    notes: { type: String, default: '', maxlength: 500 },
    timeline: [
      {
        status: String,
        note: String,
        by: String,
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
)

orderSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    orderNumber: this.orderNumber,
    user: this.user,
    customerName: this.customerName,
    customerEmail: this.customerEmail,
    customerPhone: this.customerPhone,
    items: this.items,
    totalAmount: this.totalAmount,
    itemsTotal: this.itemsTotal,
    shippingFee: this.shippingFee,
    discountAmount: this.discountAmount,
    couponCode: this.couponCode,
    taxableValue: this.taxableValue,
    gstRate: this.gstRate,
    gstAmount: this.gstAmount,
    cgstAmount: this.cgstAmount,
    sgstAmount: this.sgstAmount,
    igstAmount: this.igstAmount,
    gstType: this.gstType,
    pricesIncludeGst: this.pricesIncludeGst === true,
    status: this.status,
    paymentStatus: this.paymentStatus,
    paymentMethod: this.paymentMethod,
    shippingAddress: this.shippingAddress,
    trackingNumber: this.trackingNumber,
    courier: this.courier,
    assignedSeller: this.assignedSeller,
    stockDeducted: this.stockDeducted,
    review: this.review,
    notes: this.notes,
    timeline: this.timeline || [],
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  }
}

export function canTransition(from, to) {
  const allowed = STATUS_TRANSITIONS[from] || []
  return allowed.includes(to)
}

/** Brand prefix — first live order is PAHADLINK0101 */
export const ORDER_NUMBER_PREFIX = 'PAHADLINK'
export const ORDER_NUMBER_START = 101

function formatOrderNumber(n) {
  return `${ORDER_NUMBER_PREFIX}${String(Math.max(ORDER_NUMBER_START, n)).padStart(4, '0')}`
}

/**
 * Next PahadLink order id: PAHADLINK0101, PAHADLINK0102, …
 * Reads the highest existing numeric suffix so restarts stay sequential.
 */
export async function buildOrderNumber() {
  const Model = mongoose.models.Order
  if (!Model) {
    return formatOrderNumber(ORDER_NUMBER_START)
  }

  try {
    const rows = await Model.aggregate([
      {
        $match: {
          orderNumber: {
            $regex: `^${ORDER_NUMBER_PREFIX}\\d+$`,
            $options: 'i',
          },
        },
      },
      {
        $project: {
          digits: {
            $substrBytes: [
              '$orderNumber',
              ORDER_NUMBER_PREFIX.length,
              {
                $subtract: [
                  { $strLenBytes: '$orderNumber' },
                  ORDER_NUMBER_PREFIX.length,
                ],
              },
            ],
          },
        },
      },
      {
        $project: {
          n: {
            $convert: {
              input: '$digits',
              to: 'int',
              onError: 0,
              onNull: 0,
            },
          },
        },
      },
      { $group: { _id: null, max: { $max: '$n' } } },
    ])

    const max = Number(rows[0]?.max) || 0
    const next = max >= ORDER_NUMBER_START ? max + 1 : ORDER_NUMBER_START
    return formatOrderNumber(next)
  } catch {
    // Fallback if aggregate fails — still branded + unique-ish
    const stamp = Date.now().toString().slice(-6)
    return `${ORDER_NUMBER_PREFIX}${stamp}`
  }
}

export default mongoose.model('Order', orderSchema)
