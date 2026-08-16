/**
 * Frontend coupon helpers — re-export shared domain (server re-validates on order).
 */
export {
  FREE_SHIP_AT,
  SHIPPING_FEE,
  FIRST_ORDER_DISCOUNT,
  normalizeCouponCode,
  calcShipping,
  applyCoupon,
  welcomeDiscount,
} from '@pahadlink/shared/coupons'
