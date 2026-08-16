import { useState } from 'react'
import { Link } from 'react-router-dom'
import Breadcrumb from '../components/layout/Breadcrumb'
import FaqSection from '../components/layout/FaqSection'
import Footer from '../components/layout/Footer'
import {
  MapPinIcon,
  PhoneIcon,
  MailIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  WhatsAppIcon,
} from '../components/icons'
import { submitContact } from '../services/contactService'
import { ROUTES } from '../config'

const PHONE_DISPLAY = '+91 96904 21423'
const PHONE_TEL = '+919690421423'
const PHONE_WA = '919690421423'
const EMAIL = 'care@pahadlink.com'

const TOPICS = [
  'Order help',
  'Shipping',
  'Product query',
  'Bulk / wholesale',
  'Partnership',
  'Other',
]

const Contact = () => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    topic: 'Order help',
    message: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const onChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      const data = await submitContact(form)
      setSuccess(data.message || 'Thanks! We will get back to you soon.')
      setForm({
        name: '',
        email: '',
        phone: '',
        topic: 'Order help',
        message: '',
      })
    } catch (err) {
      setError(err.message || 'Could not send message')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <main className="contact-page">
        <div className="breadcrumb-bar breadcrumb-bar--soft">
          <div className="container">
            <Breadcrumb items={[{ label: 'Contact' }]} />
          </div>
        </div>

        <section className="contact-shell" aria-label="Contact PahadLink">
          <aside className="contact-brand">
            <div className="contact-brand__inner">
              <p className="contact-brand__eyebrow">PahadLink support</p>
              <h1>We&apos;re here to help</h1>
              <p className="contact-brand__lead">
                Clear answers on orders, shipping, and pahadi products - from a real team in the hills.
              </p>

              <div className="contact-channels" role="list">
                <a href={`tel:${PHONE_TEL}`} className="contact-channel" role="listitem">
                  <span className="contact-channel__icon">
                    <PhoneIcon size={18} />
                  </span>
                  <span className="contact-channel__body">
                    <strong>Call us</strong>
                    <span>{PHONE_DISPLAY}</span>
                  </span>
                </a>

                <a
                  href={`https://wa.me/${PHONE_WA}`}
                  className="contact-channel"
                  target="_blank"
                  rel="noreferrer"
                  role="listitem"
                >
                  <span className="contact-channel__icon contact-channel__icon--wa">
                    <WhatsAppIcon size={18} />
                  </span>
                  <span className="contact-channel__body">
                    <strong>WhatsApp</strong>
                    <span>Chat for a quick reply</span>
                  </span>
                  <ArrowRightIcon size={14} className="contact-channel__arrow" />
                </a>

                <a href={`mailto:${EMAIL}`} className="contact-channel" role="listitem">
                  <span className="contact-channel__icon">
                    <MailIcon size={18} />
                  </span>
                  <span className="contact-channel__body">
                    <strong>Email</strong>
                    <span>{EMAIL}</span>
                  </span>
                  <ArrowRightIcon size={14} className="contact-channel__arrow" />
                </a>
              </div>

              <div className="contact-brand__meta">
                <p>
                  <MapPinIcon size={15} />
                  Almora Road, Haldwani, Uttarakhand 263139
                </p>
                <p>
                  <MailIcon size={15} />
                  Mon-Sat · 10:00 AM - 7:00 PM IST
                </p>
              </div>
            </div>
          </aside>

          <div className="contact-panel" id="contact-form">
            {success ? (
              <div className="contact-success" role="status">
                <span className="contact-success__icon">
                  <CheckCircleIcon size={34} />
                </span>
                <h2>Message received</h2>
                <p>{success}</p>
                <div className="contact-success__actions">
                  <button
                    type="button"
                    className="contact-submit"
                    onClick={() => setSuccess('')}
                  >
                    Send another
                  </button>
                  <Link to={ROUTES.HOME} className="contact-text-link">
                    Continue shopping
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <header className="contact-panel__head">
                  <h2>Send a message</h2>
                  <p>We reply within 1 business day.</p>
                </header>

                <form className="contact-form" onSubmit={onSubmit} noValidate>
                  {error && (
                    <p className="contact-alert" role="alert">
                      {error}
                    </p>
                  )}

                  <label className="contact-field">
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={onChange}
                      placeholder=" "
                      required
                      autoComplete="name"
                    />
                    <span>Full name</span>
                  </label>

                  <div className="contact-field-row">
                    <label className="contact-field">
                      <input
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={onChange}
                        placeholder=" "
                        autoComplete="email"
                      />
                      <span>Email</span>
                    </label>
                    <label className="contact-field">
                      <input
                        type="tel"
                        name="phone"
                        value={form.phone}
                        onChange={onChange}
                        placeholder=" "
                        autoComplete="tel"
                        inputMode="tel"
                      />
                      <span>Phone</span>
                    </label>
                  </div>

                  <label className="contact-field contact-field--select">
                    <span className="contact-select-wrap">
                      <select name="topic" value={form.topic} onChange={onChange}>
                        {TOPICS.map((topic) => (
                          <option key={topic} value={topic}>
                            {topic}
                          </option>
                        ))}
                      </select>
                    </span>
                    <span>Topic</span>
                  </label>

                  <label className="contact-field contact-field--area">
                    <textarea
                      name="message"
                      value={form.message}
                      onChange={onChange}
                      placeholder=" "
                      rows={5}
                      required
                    />
                    <span>Message</span>
                  </label>

                  <button type="submit" className="contact-submit" disabled={submitting}>
                    {submitting ? 'Sending...' : 'Send message'}
                    {!submitting && <ArrowRightIcon size={16} />}
                  </button>
                </form>
              </>
            )}
          </div>
        </section>

        <FaqSection page="contact" title="Quick answers" />
      </main>
      <Footer />
    </>
  )
}

export default Contact
