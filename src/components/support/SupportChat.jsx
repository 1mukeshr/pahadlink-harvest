import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  ArrowUpIcon,
  ChatIcon,
  CloseIcon,
  LeafIcon,
  MailIcon,
  PackageIcon,
  PhoneIcon,
  TruckIcon,
  WhatsAppIcon,
} from '../icons'
import { ROUTES } from '../../config'
import { useAuth } from '../../context/AuthContext'
import { useShop } from '../../context/ShopContext'
import { submitContact } from '../../services/contactService'
import {
  SUPPORT,
  buildWaLink,
  clearChatSession,
  findBestFaq,
  findOrderForUser,
  formatOrderReply,
  getSupportAvailability,
  pageGreeting,
  readChatSession,
  writeChatSession,
} from '../../utils/supportChat'

const TOPICS = [
  {
    id: 'order',
    label: 'Track order',
    Icon: PackageIcon,
    topic: 'Order help',
    seed: 'I want to track my order',
  },
  {
    id: 'shipping',
    label: 'Shipping',
    Icon: TruckIcon,
    topic: 'Shipping',
    seed: 'Tell me about shipping and delivery time',
  },
  {
    id: 'product',
    label: 'Products',
    Icon: LeafIcon,
    topic: 'Product query',
    seed: 'I have a product question',
  },
]

const makeId = (prefix) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

const SupportChat = () => {
  const { pathname } = useLocation()
  const { user, isAuthenticated } = useAuth()
  const { cartOpen } = useShop()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [sendingTicket, setSendingTicket] = useState(false)
  const [availability, setAvailability] = useState(() => getSupportAvailability())
  const [messages, setMessages] = useState(() => {
    const saved = readChatSession()
    if (saved?.length) return saved
    return [
      {
        id: 'welcome',
        from: 'bot',
        text: pageGreeting('/'),
        kind: 'welcome',
      },
    ]
  })
  const listRef = useRef(null)
  const typingTimer = useRef(null)

  const hide = cartOpen || pathname !== ROUTES.HOME

  useEffect(() => {
    if (cartOpen || pathname !== ROUTES.HOME) setOpen(false)
  }, [cartOpen, pathname])

  useEffect(() => {
    writeChatSession(messages)
  }, [messages])

  useEffect(() => {
    const tick = () => setAvailability(getSupportAvailability())
    tick()
    const id = window.setInterval(tick, 60_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!open || !listRef.current) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, typing, open])

  useEffect(() => {
    return () => {
      if (typingTimer.current) window.clearTimeout(typingTimer.current)
    }
  }, [])

  const draftForWa = useMemo(() => {
    const lastUser = [...messages].reverse().find((m) => m.from === 'user')
    const name = user?.name ? ` (${user.name})` : ''
    return lastUser?.text
      ? `Hi PahadLink support${name}, I need help with: ${lastUser.text}`
      : `Hi PahadLink support${name}, I need help with my order.`
  }, [messages, user])

  const pushBot = useCallback((text, extras = {}) => {
    setMessages((prev) => [
      ...prev,
      { id: makeId('bot'), from: 'bot', text, ...extras },
    ])
  }, [])

  const pushUser = useCallback((text) => {
    setMessages((prev) => [
      ...prev,
      { id: makeId('user'), from: 'user', text },
    ])
  }, [])

  const replyLater = useCallback((fn) => {
    setTyping(true)
    if (typingTimer.current) window.clearTimeout(typingTimer.current)
    typingTimer.current = window.setTimeout(() => {
      setTyping(false)
      fn()
    }, 380 + Math.floor(Math.random() * 280))
  }, [])

  const buildReply = useCallback(
    (rawText, topicMeta = null) => {
      const text = String(rawText || '').trim()
      const lower = text.toLowerCase()

      // Order tracking
      if (
        topicMeta?.id === 'order' ||
        /track|order|where is my|status|pl\d+/i.test(lower)
      ) {
        const { order, recent, orderId } = findOrderForUser(user, text)
        if (order) {
          return {
            text: formatOrderReply(order),
            topicId: 'order',
            handoff: true,
            draft: `Order ${order.id || order.orderNumber}: need help`,
          }
        }
        if (isAuthenticated && recent.length) {
          const lines = recent
            .map((o) => {
              const id = o.id || o.orderNumber
              const st = o.status || o.paymentStatus || 'processing'
              return `• ${id} — ${st}`
            })
            .join('\n')
          return {
            text: `Here are your recent orders:\n${lines}\n\nReply with an order ID for details, or continue on WhatsApp.`,
            topicId: 'order',
            handoff: true,
            multiline: true,
          }
        }
        if (orderId) {
          return {
            text: `I could not find order ${orderId} in this browser${
              isAuthenticated ? '' : '. Sign in to see your orders'
            }. Share it on WhatsApp and we will check with the warehouse.`,
            topicId: 'order',
            handoff: true,
            draft: `Please check order ${orderId}`,
            linkOrders: isAuthenticated,
          }
        }
        return {
          text: isAuthenticated
            ? 'Share your order ID (e.g. PL12345678), or open My Orders. You can also WhatsApp us the ID.'
            : 'Sign in to see your orders, or share your order ID on WhatsApp for a live check.',
          topicId: 'order',
          handoff: true,
          linkOrders: isAuthenticated,
          linkLogin: !isAuthenticated,
        }
      }

      const faq = findBestFaq(text)
      if (faq) {
        return {
          text: faq.a,
          topicId: topicMeta?.id || 'faq',
          handoff: true,
          faq: true,
        }
      }

      if (/hello|hi\b|hey|namaste|good (morning|evening|afternoon)/i.test(lower)) {
        return {
          text: `${pageGreeting(pathname)} ${
            availability.open
              ? 'Our desk is online now.'
              : `We are away (${SUPPORT.hoursLabel}).`
          }`,
          kind: 'welcome',
        }
      }

      if (/human|agent|person|call me|speak|live/.test(lower)) {
        return {
          text: availability.open
            ? 'Sure — tap WhatsApp for a live reply, or leave your question and we will ticket it to the team.'
            : `Our live desk is closed (${SUPPORT.hoursLabel}). Leave a message and we will email/WhatsApp you next business day.`,
          handoff: true,
          ticket: true,
          draft: text,
        }
      }

      return {
        text: availability.open
          ? 'Got it. I could not auto-answer that — continue on WhatsApp for a quick team reply, or send it as a support ticket.'
          : `Thanks — our team is offline (${SUPPORT.hoursLabel}). Send a ticket or WhatsApp and we will follow up.`,
        handoff: true,
        ticket: true,
        draft: text,
      }
    },
    [availability.open, isAuthenticated, pathname, user],
  )

  const handleUserText = useCallback(
    (text, topicMeta = null) => {
      const clean = String(text || '').trim()
      if (!clean || typing || sendingTicket) return
      pushUser(clean)
      setInput('')
      replyLater(() => {
        const reply = buildReply(clean, topicMeta)
        pushBot(reply.text, reply)
      })
    },
    [buildReply, pushBot, pushUser, replyLater, sendingTicket, typing],
  )

  const onTopic = (topic) => {
    handleUserText(topic.seed, topic)
  }

  const onSubmit = (e) => {
    e.preventDefault()
    handleUserText(input)
  }

  const onSendTicket = async (draft) => {
    const message = String(draft || input || '').trim()
    if (message.length < 10) {
      pushBot('Please type a bit more detail (at least 10 characters) so we can help.')
      return
    }
    if (!isAuthenticated && !user?.email) {
      pushBot(
        'To create a ticket, sign in first — or WhatsApp us directly. Your cart stays saved either way.',
        { handoff: true, linkLogin: true, draft: message },
      )
      return
    }

    setSendingTicket(true)
    try {
      const result = await submitContact({
        name: user?.name || 'PahadLink customer',
        email: user?.email || '',
        phone: user?.phone || '',
        topic: 'Order help',
        message: `[Live chat] ${message}`.slice(0, 1000),
      })
      pushBot(
        result?.message ||
          'Ticket sent. Our team will reply within 1 business day.',
        { ticketSent: true },
      )
    } catch (err) {
      pushBot(
        err?.message ||
          'Could not send the ticket right now. Please use WhatsApp or email care@pahadlink.com.',
        { handoff: true, draft: message },
      )
    } finally {
      setSendingTicket(false)
    }
  }

  const onReset = () => {
    clearChatSession()
    setMessages([
      {
        id: makeId('welcome'),
        from: 'bot',
        text: pageGreeting(pathname),
        kind: 'welcome',
      },
    ])
  }

  // Refresh welcome when opening on a new page if chat is still default-only
  useEffect(() => {
    if (!open) return
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].kind === 'welcome') {
        return [
          {
            ...prev[0],
            text: pageGreeting(pathname),
          },
        ]
      }
      return prev
    })
  }, [open, pathname])

  if (hide) return null

  return (
    <div className={`support-chat${open ? ' is-open' : ''}`}>
      {open && (
        <section
          className="support-chat__panel"
          role="dialog"
          aria-label="Customer support chat"
        >
          <header className="support-chat__head">
            <div className="support-chat__brand">
              <span className="support-chat__avatar" aria-hidden="true">
                <ChatIcon size={16} />
                <i
                  className={`support-chat__online${
                    availability.open ? ' is-live' : ''
                  }`}
                />
              </span>
              <div>
                <strong>Support</strong>
                <span className="support-chat__status">
                  {availability.label}
                </span>
              </div>
            </div>
            <div className="support-chat__head-actions">
              <button
                type="button"
                className="support-chat__reset"
                onClick={onReset}
              >
                New chat
              </button>
              <button
                type="button"
                className="support-chat__close"
                aria-label="Close chat"
                onClick={() => setOpen(false)}
              >
                <CloseIcon size={14} />
              </button>
            </div>
          </header>

          <div className="support-chat__body" ref={listRef}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`support-chat__row support-chat__row--${msg.from}`}
              >
                {msg.from === 'bot' && (
                  <span className="support-chat__mini-avatar" aria-hidden="true">
                    <ChatIcon size={11} />
                  </span>
                )}
                <div
                  className={`support-chat__bubble support-chat__bubble--${msg.from}`}
                >
                  <p className={msg.multiline ? 'is-multiline' : undefined}>
                    {msg.text}
                  </p>

                  <div className="support-chat__actions">
                    {msg.from === 'bot' && msg.linkOrders && (
                      <Link
                        to={ROUTES.ORDERS}
                        className="support-chat__chip-link"
                      >
                        <PackageIcon size={11} />
                        My orders
                      </Link>
                    )}
                    {msg.from === 'bot' && msg.linkLogin && (
                      <Link
                        to={ROUTES.LOGIN}
                        state={{ from: pathname, intent: 'support' }}
                        className="support-chat__chip-link"
                      >
                        Sign in
                      </Link>
                    )}
                    {msg.from === 'bot' &&
                      msg.topicId === 'order' &&
                      !msg.linkOrders && (
                        <Link
                          to={ROUTES.ORDERS}
                          className="support-chat__chip-link"
                        >
                          <PackageIcon size={11} />
                          My orders
                        </Link>
                      )}

                    {msg.from === 'bot' && msg.ticket && !msg.ticketSent && (
                      <button
                        type="button"
                        className="support-chat__chip-btn"
                        disabled={sendingTicket}
                        onClick={() => onSendTicket(msg.draft)}
                      >
                        {sendingTicket ? 'Sending…' : 'Send ticket'}
                      </button>
                    )}

                    {msg.from === 'bot' && (msg.handoff || msg.topicId) && (
                      <a
                        href={buildWaLink(msg.draft || draftForWa)}
                        target="_blank"
                        rel="noreferrer"
                        className="support-chat__chip-wa"
                      >
                        <WhatsAppIcon size={12} />
                        WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {typing && (
              <div className="support-chat__row support-chat__row--bot">
                <span className="support-chat__mini-avatar" aria-hidden="true">
                  <ChatIcon size={11} />
                </span>
                <div
                  className="support-chat__bubble support-chat__bubble--bot support-chat__typing"
                  aria-label="Typing"
                >
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            )}
          </div>

          <footer className="support-chat__footer">
            <div className="support-chat__topics" aria-label="Quick help topics">
              {TOPICS.map((topic) => {
                const Icon = topic.Icon
                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => onTopic(topic)}
                    disabled={typing || sendingTicket}
                  >
                    <Icon size={13} />
                    <span>{topic.label}</span>
                  </button>
                )
              })}
            </div>

            <div className="support-chat__direct">
              <a href={`tel:${SUPPORT.phoneTel}`} aria-label="Call support">
                <PhoneIcon size={14} />
                <span>Call</span>
              </a>
              <a
                href={buildWaLink(draftForWa)}
                target="_blank"
                rel="noreferrer"
                className="support-chat__direct-wa"
                aria-label="WhatsApp support"
              >
                <WhatsAppIcon size={14} />
                <span>WhatsApp</span>
              </a>
              <a href={`mailto:${SUPPORT.email}`} aria-label="Email support">
                <MailIcon size={14} />
                <span>Email</span>
              </a>
            </div>

            <form className="support-chat__form" onSubmit={onSubmit}>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message…"
                aria-label="Support message"
                disabled={typing || sendingTicket}
              />
              <button
                type="submit"
                aria-label="Send message"
                disabled={typing || sendingTicket || !input.trim()}
              >
                <ArrowUpIcon size={15} />
              </button>
            </form>
          </footer>
        </section>
      )}

      <button
        type="button"
        className={`support-chat__launcher${open ? ' is-open' : ''}`}
        aria-expanded={open}
        aria-label={open ? 'Close support chat' : 'Open support chat'}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="support-chat__launcher-icon" aria-hidden="true">
          {open ? <CloseIcon size={22} /> : <ChatIcon size={22} />}
        </span>
        {!open && (
          <span className="support-chat__launcher-pulse" aria-hidden="true" />
        )}
      </button>
    </div>
  )
}

export default SupportChat
