/**
 * Shared checkout / delivery validation — keep picker, gate, checkout, and API aligned.
 */

export const ADDRESS_MIN_LENGTH = 8
export const LOCATION_LINE_MIN = 3
export const LOCATION_AREA_MIN = 3

/** Digits-only Indian mobile (max 10); strips +91 / leading 0 when pasted */
export function digitsPhone(value) {
  let digits = String(value || '').replace(/\D/g, '')
  if (digits.startsWith('91') && digits.length >= 12) digits = digits.slice(2)
  else if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1)
  return digits.slice(0, 10)
}

/** Digits-only 6-digit PIN */
export function digitsPin(value) {
  return String(value || '')
    .replace(/\D/g, '')
    .slice(0, 6)
}

export function isValidIndianMobile(value) {
  return /^[6-9]\d{9}$/.test(digitsPhone(value))
}

export function mobileValidationMessage(value) {
  const phone = digitsPhone(value)
  if (!phone) return 'Mobile number is required'
  if (phone.length < 10) return 'Enter a complete 10-digit mobile number'
  if (!/^[6-9]\d{9}$/.test(phone)) {
    return 'Enter a valid Indian mobile (starts with 6–9)'
  }
  return ''
}

export function isValidEmail(value) {
  return /^\S+@\S+\.\S+$/.test(String(value || '').trim())
}

export function isValidPincode(value) {
  return /^\d{6}$/.test(digitsPin(value))
}

/** Street line used for checkout (house + floor + area) */
export function streetFromLocation(entry) {
  if (!entry) return ''
  const line1 = String(entry.line1 || entry.address || '').trim()
  const floor = String(entry.floor || '').trim()
  const area = String(entry.area || '').trim()
  return [line1, floor ? `Floor ${floor}` : '', area].filter(Boolean).join(', ')
}

/**
 * Location/address gate before checkout (phone is collected on checkout page).
 * Requires street (≥8 via line1/area), city, state, and 6-digit pin.
 */
export function isCompleteDeliveryLocation(entry) {
  if (!entry) return false
  const street = streetFromLocation(entry)
  const city = String(entry.city || '').trim()
  const state = String(entry.state || '').trim()
  const pin = digitsPin(entry.pin || entry.pincode)
  return (
    street.length >= ADDRESS_MIN_LENGTH &&
    Boolean(city) &&
    Boolean(state) &&
    isValidPincode(pin)
  )
}

/** Checkout form field checks — returns error map (empty = valid) */
export function validateCheckoutForm(form, payment, paymentIds = []) {
  const next = {}
  const name = String(form?.name || '').trim()
  const email = String(form?.email || '').trim()
  const address = String(form?.address || '').trim()
  const city = String(form?.city || '').trim()
  const state = String(form?.state || '').trim()
  const pincode = digitsPin(form?.pincode)
  const phoneMsg = mobileValidationMessage(form?.phone)

  if (!name) next.name = 'Name is required'
  if (!email || !isValidEmail(email)) next.email = 'Valid email is required'
  if (phoneMsg) next.phone = phoneMsg
  if (!address || address.length < ADDRESS_MIN_LENGTH) {
    next.address = 'Full address is required'
  }
  if (!city) next.city = 'City is required'
  if (!state) next.state = 'State is required'
  if (!isValidPincode(pincode)) next.pincode = 'Enter a 6-digit pincode'
  if (!payment || (paymentIds.length && !paymentIds.includes(payment))) {
    next.payment = 'Select a payment method'
  }
  return next
}

export function firstCheckoutErrorField(errors) {
  const order = [
    'name',
    'phone',
    'email',
    'address',
    'city',
    'state',
    'pincode',
    'payment',
  ]
  return order.find((key) => errors?.[key]) || 'phone'
}
