import { Router } from 'express'
import mongoose from 'mongoose'
import CrmLead from '../models/CrmLead.js'

const router = Router()

const TOPICS = [
  'Order help',
  'Shipping',
  'Product query',
  'Bulk / wholesale',
  'Partnership',
  'Other',
]

function requireMongo(_req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      message: 'Contact form unavailable — database disconnected.',
    })
  }
  return next()
}

/** Public contact form / live chat -> CRM lead */
router.post('/', requireMongo, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim()
    const email = String(req.body.email || '').trim().toLowerCase()
    const phone = String(req.body.phone || '').trim()
    const topic = String(req.body.topic || '').trim()
    const message = String(req.body.message || '').trim()

    if (!name) {
      return res.status(400).json({ message: 'Please enter your name' })
    }
    if (!email && !phone) {
      return res.status(400).json({ message: 'Please share an email or phone number' })
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Please enter a valid email' })
    }
    if (!message || message.length < 10) {
      return res.status(400).json({ message: 'Please write a short message (at least 10 characters)' })
    }

    const interest = TOPICS.includes(topic) ? topic : topic || 'Other'
    const lead = await CrmLead.create({
      name,
      email,
      phone,
      source: 'website',
      status: 'new',
      interest: String(interest).slice(0, 120),
      notes: message.slice(0, 1000),
      assignedTo: null,
    })

    res.status(201).json({
      message: 'Thanks! Our team will reply within 1 business day.',
      id: lead._id.toString(),
    })
  } catch (error) {
    res.status(500).json({ message: error.message || 'Could not send message' })
  }
})

export default router
