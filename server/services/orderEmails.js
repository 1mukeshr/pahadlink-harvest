const brand = {
  name: 'PahadLink',
  // `primary` highlights amounts, `secondary` paints the header band and headings.
  primary: '#E65100',
  secondary: '#0A4F33',
  accent: '#FF9800',
  bg: '#f7f6f2',
}

function formatMoney(n) {
  return `₹${Number(n || 0).toLocaleString('in-IN')}`
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function wrap(title, bodyHtml) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:${brand.bg};font-family:Segoe UI,Arial,sans-serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${brand.bg};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #ebe6e0;">
        <tr>
          <td style="background:${brand.secondary};padding:18px 24px;">
            <div style="font-size:20px;font-weight:700;color:#fff;letter-spacing:0.02em;">${brand.name}</div>
          </td>
        </tr>
        <tr><td style="padding:28px 24px;">${bodyHtml}</td></tr>
        <tr>
          <td style="padding:16px 24px;background:#faf8f6;font-size:12px;color:#6b6b6b;border-top:1px solid #ebe6e0;">
            You’re receiving this because of an order on ${brand.name}.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function itemsRows(order) {
  return (order.items || [])
    .map(
      (item) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #f0ebe4;">${escapeHtml(item.name)} × ${item.quantity}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f0ebe4;text-align:right;">${formatMoney(item.price * item.quantity)}</td>
      </tr>`
    )
    .join('')
}

function addressBlock(order) {
  const a = order.shippingAddress || {}
  const lines = [a.line1, [a.city, a.state].filter(Boolean).join(', '), a.pincode]
    .filter(Boolean)
    .map(escapeHtml)
  return lines.length ? lines.join('<br/>') : '—'
}

function paymentLabel(method) {
  const map = { cod: 'Cash on Delivery', upi: 'UPI' }
  return map[method] || method || '—'
}

function gstRowsHtml(order) {
  const total = Number(order.totalAmount) || 0
  if (!total) return ''

  const rate = order.gstRate != null ? Number(order.gstRate) : 0.05
  const ratePct = Math.round(rate * 1000) / 10
  const halfPct = ratePct / 2
  let cgst = Number(order.cgstAmount)
  let sgst = Number(order.sgstAmount)
  let igst = Number(order.igstAmount)
  let gstType = order.gstType || ''

  if (order.gstAmount == null || (!gstType && order.cgstAmount == null)) {
    const gstAmount =
      order.gstAmount != null
        ? Number(order.gstAmount)
        : Math.round((total * rate) / (1 + rate))
    const ship = String(order.shippingAddress?.state || '')
      .trim()
      .toLowerCase()
    const sameState = ship === 'uttarakhand' || !ship
    if (sameState) {
      cgst = Math.floor(gstAmount / 2)
      sgst = gstAmount - cgst
      igst = 0
      gstType = 'cgst_sgst'
    } else {
      cgst = 0
      sgst = 0
      igst = gstAmount
      gstType = 'igst'
    }
  }

  const halfLabel = `${halfPct}%`
  if (gstType === 'igst') {
    return `<tr><td style="padding:4px 0;color:#666;">IGST (${ratePct}%)</td><td style="padding:4px 0;text-align:right;">${formatMoney(igst)}</td></tr>`
  }
  return `<tr><td style="padding:4px 0;color:#666;">CGST (${halfLabel})</td><td style="padding:4px 0;text-align:right;">${formatMoney(cgst)}</td></tr>
      <tr><td style="padding:4px 0;color:#666;">SGST (${halfLabel})</td><td style="padding:4px 0;text-align:right;">${formatMoney(sgst)}</td></tr>`
}

export function orderConfirmationEmail(order) {
  const subject = `Your order has been confirmed — ${order.orderNumber}`
  const html = wrap(
    subject,
    `
    <h1 style="margin:0 0 8px;font-size:22px;color:${brand.secondary};">Your order has been confirmed</h1>
    <p style="margin:0 0 20px;color:#444;line-height:1.5;">
      Hi ${escapeHtml(order.customerName)}, thanks for shopping with ${brand.name}. We’ve received your order <strong>${escapeHtml(order.orderNumber)}</strong>.
    </p>
    <table role="presentation" width="100%" style="margin:0 0 16px;font-size:14px;">
      ${itemsRows(order)}
      ${gstRowsHtml(order)}
      <tr>
        <td style="padding:12px 0 0;font-weight:700;">Total (incl. GST)</td>
        <td style="padding:12px 0 0;text-align:right;font-weight:700;color:${brand.primary};">${formatMoney(order.totalAmount)}</td>
      </tr>
    </table>
    <p style="margin:0 0 6px;font-size:13px;color:#666;"><strong>Payment:</strong> ${escapeHtml(paymentLabel(order.paymentMethod))}</p>
    <p style="margin:0;font-size:13px;color:#666;"><strong>Deliver to:</strong><br/>${addressBlock(order)}</p>
  `
  )
  return { subject, html }
}

export function paymentSuccessfulEmail(order) {
  const subject = `Payment successful — ${order.orderNumber}`
  const html = wrap(
    subject,
    `
    <h1 style="margin:0 0 8px;font-size:22px;color:${brand.secondary};">Payment successful</h1>
    <p style="margin:0 0 20px;color:#444;line-height:1.5;">
      Hi ${escapeHtml(order.customerName)}, we’ve received your payment for order <strong>${escapeHtml(order.orderNumber)}</strong>. We’re preparing your items for dispatch.
    </p>
    <p style="margin:0;font-size:15px;"><strong>Amount paid:</strong> <span style="color:${brand.primary};">${formatMoney(order.totalAmount)}</span></p>
  `
  )
  return { subject, html }
}

export function adminNewPaidOrderEmail(order) {
  const subject = `New paid order — ${order.orderNumber} · ${formatMoney(order.totalAmount)}`
  const html = wrap(
    subject,
    `
    <h1 style="margin:0 0 8px;font-size:22px;color:${brand.secondary};">New paid order</h1>
    <p style="margin:0 0 16px;color:#444;line-height:1.5;">
      A customer has completed payment. Review and fulfill this order.
    </p>
    <table role="presentation" width="100%" style="font-size:14px;margin-bottom:16px;">
      <tr><td style="padding:4px 0;color:#666;">Order</td><td style="padding:4px 0;text-align:right;"><strong>${escapeHtml(order.orderNumber)}</strong></td></tr>
      <tr><td style="padding:4px 0;color:#666;">Customer</td><td style="padding:4px 0;text-align:right;">${escapeHtml(order.customerName)}</td></tr>
      <tr><td style="padding:4px 0;color:#666;">Email</td><td style="padding:4px 0;text-align:right;">${escapeHtml(order.customerEmail)}</td></tr>
      <tr><td style="padding:4px 0;color:#666;">Phone</td><td style="padding:4px 0;text-align:right;">${escapeHtml(order.customerPhone || '—')}</td></tr>
      <tr><td style="padding:4px 0;color:#666;">Payment</td><td style="padding:4px 0;text-align:right;">${escapeHtml(paymentLabel(order.paymentMethod))} · paid</td></tr>
      ${gstRowsHtml(order)}
      <tr><td style="padding:4px 0;color:#666;">Total (incl. GST)</td><td style="padding:4px 0;text-align:right;font-weight:700;color:${brand.primary};">${formatMoney(order.totalAmount)}</td></tr>
    </table>
    <table role="presentation" width="100%" style="margin:0 0 16px;font-size:14px;">
      ${itemsRows(order)}
    </table>
    <p style="margin:0;font-size:13px;color:#666;"><strong>Ship to:</strong><br/>${addressBlock(order)}</p>
    ${order.notes ? `<p style="margin:12px 0 0;font-size:13px;color:#666;"><strong>Notes:</strong> ${escapeHtml(order.notes)}</p>` : ''}
  `
  )
  return { subject, html }
}
