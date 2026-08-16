import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchIcon } from '../icons'
import { ROUTES } from '../../config'

const SEARCH_PHRASES = [
  'honey, rajma, shawls and more',
  'pahadi rajma from the hills',
  'raw forest honey',
  'bal mithai & singori',
  'woolen shawls & topi',
  'organic millets & dals',
]

const HeaderSearch = () => {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [typedPlaceholder, setTypedPlaceholder] = useState('')
  const typingRef = useRef({ phraseIndex: 0, charIndex: 0, deleting: false })
  const pauseTyping = focused || query.length > 0

  useEffect(() => {
    if (pauseTyping) {
      setTypedPlaceholder('')
      return undefined
    }

    let cancelled = false
    let timer

    const schedule = (fn, delay) => {
      timer = window.setTimeout(() => {
        if (!cancelled) fn()
      }, delay)
    }

    const tick = () => {
      const state = typingRef.current
      const phrase = SEARCH_PHRASES[state.phraseIndex]

      if (!state.deleting) {
        state.charIndex += 1
        setTypedPlaceholder(phrase.slice(0, state.charIndex))

        if (state.charIndex === phrase.length) {
          state.deleting = true
          schedule(tick, 1600)
          return
        }
        schedule(tick, 55)
        return
      }

      state.charIndex -= 1
      setTypedPlaceholder(phrase.slice(0, state.charIndex))

      if (state.charIndex === 0) {
        state.deleting = false
        state.phraseIndex = (state.phraseIndex + 1) % SEARCH_PHRASES.length
        schedule(tick, 320)
        return
      }
      schedule(tick, 28)
    }

    schedule(tick, 400)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [pauseTyping])

  const handleSubmit = (e) => {
    e.preventDefault()
    const q = query.trim()
    navigate(q ? `${ROUTES.SHOP}?q=${encodeURIComponent(q)}` : ROUTES.SHOP)
  }

  return (
    <form className="header-search" role="search" onSubmit={handleSubmit}>
      <button type="submit" className="header-search-icon-btn" aria-label="Search">
        <SearchIcon size={18} />
      </button>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={pauseTyping ? 'Search products' : `Search for ${typedPlaceholder}`}
        aria-label="Search"
        className={pauseTyping ? undefined : 'is-typing'}
      />
    </form>
  )
}

export default HeaderSearch
