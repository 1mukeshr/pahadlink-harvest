import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import FaqSection from '../components/layout/FaqSection'
import Footer from '../components/layout/Footer'
import HeroBanner from '../components/layout/HeroBanner'
import OfferBanner from '../components/layout/OfferBanner'
import ProductSection from '../components/products/ProductSection'
import {
  ShieldIcon,
  TruckIcon,
  CheckCircleIcon,
  HillsIcon,
  StarRating,
  ArrowLeftIcon,
  ArrowRightIcon,
} from '../components/icons'
import { ROUTES } from '../config'
import { features } from '../data/siteData'
import {
  ADDRESSES_EVENT,
  LOCATION_EVENT,
  clearResumeCheckout,
  hasCompleteShippingAddress,
  markResumeCheckout,
  requestOpenAddressPicker,
  shouldResumeCheckout,
} from '../utils/locationStorage'
import { fetchRecentReviews } from '../services/reviewService'
import pahadiWoman from '../assets/images/banners/hero-pahadi-woman.png'
import whyPahadLink from '../assets/images/banners/why-pahadlink.png'

const REVIEWS_VISIBLE = 3

function reviewInitials(name = '') {
  return (
    name
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'PL'
  )
}

const Home = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [homeReviews, setHomeReviews] = useState([])
  const [canSlideLeft, setCanSlideLeft] = useState(false)
  const [canSlideRight, setCanSlideRight] = useState(false)
  const reviewsTrackRef = useRef(null)

  useEffect(() => {
    let alive = true
    fetchRecentReviews(9).then((data) => {
      if (!alive) return
      setHomeReviews(data.reviews)
    })
    return () => {
      alive = false
    }
  }, [])

  const updateReviewsScroll = useCallback(() => {
    const track = reviewsTrackRef.current
    if (!track) return
    const { scrollLeft, scrollWidth, clientWidth } = track
    setCanSlideLeft(scrollLeft > 8)
    setCanSlideRight(scrollLeft + clientWidth < scrollWidth - 8)
  }, [])

  const scrollReviews = (direction) => {
    const track = reviewsTrackRef.current
    if (!track) return
    const slide = track.querySelector('.reviews-slider__slide')
    const gap = 16
    const cardStep = slide
      ? slide.getBoundingClientRect().width + gap
      : track.clientWidth / REVIEWS_VISIBLE
    const visible = Math.max(1, Math.round(track.clientWidth / cardStep))
    const step = cardStep * visible
    track.scrollBy({
      left: direction === 'next' ? step : -step,
      behavior: 'smooth',
    })
  }

  useEffect(() => {
    const track = reviewsTrackRef.current
    if (!track || homeReviews.length === 0) return undefined

    updateReviewsScroll()
    track.addEventListener('scroll', updateReviewsScroll, { passive: true })
    window.addEventListener('resize', updateReviewsScroll)

    return () => {
      track.removeEventListener('scroll', updateReviewsScroll)
      window.removeEventListener('resize', updateReviewsScroll)
    }
  }, [homeReviews.length, updateReviewsScroll])

  useEffect(() => {
    const state = location.state
    if (!state?.needAddress && !state?.resumeCheckout) return undefined

    const hint =
      state.checkoutHint ||
      'Add your current location and delivery address to continue checkout.'

    if (state.resumeCheckout) markResumeCheckout()

    if (!hasCompleteShippingAddress()) {
      const t = window.setTimeout(() => {
        requestOpenAddressPicker({
          message: hint,
          resumeCheckout: true,
        })
      }, 400)
      navigate(ROUTES.HOME, { replace: true, state: null })
      return () => window.clearTimeout(t)
    }

    clearResumeCheckout()
    navigate(ROUTES.CHECKOUT, { replace: true })
    return undefined
  }, [location.state, navigate])

  // After register/login checkout intent: once location+address saved → checkout
  useEffect(() => {
    const tryResume = () => {
      if (!shouldResumeCheckout()) return
      if (!hasCompleteShippingAddress()) return
      clearResumeCheckout()
      navigate(ROUTES.CHECKOUT)
    }

    window.addEventListener(ADDRESSES_EVENT, tryResume)
    window.addEventListener(LOCATION_EVENT, tryResume)
    return () => {
      window.removeEventListener(ADDRESSES_EVENT, tryResume)
      window.removeEventListener(LOCATION_EVENT, tryResume)
    }
  }, [navigate])

  return (
    <>
      <main className="home-page">
        <HeroBanner />

        {/* 1. Trust strip */}
        <section className="benefits benefits--home" aria-label="Why shop with us">
          <div className="container benefits-grid">
            <div className="benefit-item">
              <div className="benefit-icon" aria-hidden="true"><ShieldIcon size={22} /></div>
              <div className="benefit-copy">
                <h4>Secure pay</h4>
                <p>Safe checkout every time</p>
              </div>
            </div>
            <div className="benefit-item">
              <div className="benefit-icon" aria-hidden="true"><TruckIcon size={22} /></div>
              <div className="benefit-copy">
                <h4>Free shipping</h4>
                <p>First order free · then from ₹39</p>
              </div>
            </div>
            <div className="benefit-item">
              <div className="benefit-icon" aria-hidden="true"><CheckCircleIcon size={22} /></div>
              <div className="benefit-copy">
                <h4>100% natural</h4>
                <p>No artificial additives</p>
              </div>
            </div>
            <div className="benefit-item">
              <div className="benefit-icon" aria-hidden="true"><HillsIcon size={22} /></div>
              <div className="benefit-copy">
                <h4>From the hills</h4>
                <p>Direct from local makers</p>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Primary products */}
        <ProductSection
          id="bestsellers"
          title="Best Sellers"
          subtitle="Most-loved hill products families reorder every season."
          tag="bestseller"
          limit={5}
          seeAllHref={`${ROUTES.SHOP}?tag=bestseller`}
        />

        <OfferBanner />

        {/* What’s hot */}
        <ProductSection
          id="trending"
          title="Trending now"
          subtitle="What shoppers are discovering and adding to bag today."
          tag="trending"
          limit={5}
          seeAllHref={`${ROUTES.SHOP}?tag=trending`}
        />

        <section className="home-maker" aria-labelledby="home-maker-title">
          <div className="container home-maker__inner">
            <div className="home-maker__media">
              <img
                src={pahadiWoman}
                alt="Pahadi woman artisan with natural products in a Himalayan village"
                loading="lazy"
                decoding="async"
              />
            </div>

            <div className="home-maker__content">
              <p className="section-eyebrow">From mountain homes</p>
              <h2 id="home-maker-title">Crafted by hands that know the hills</h2>
              <p className="home-maker__lead">
                Meet the farmers and makers behind honest Himalayan food,
                craft and traditions—brought from their homes to yours.
              </p>
              <ul className="home-maker__points">
                <li>
                  <CheckCircleIcon size={15} />
                  <span>Local maker partnerships</span>
                </li>
                <li>
                  <CheckCircleIcon size={15} />
                  <span>Small-batch traditions</span>
                </li>
                <li>
                  <CheckCircleIcon size={15} />
                  <span>Delivered across India</span>
                </li>
              </ul>
              <div className="home-maker__actions">
                <Link to={ROUTES.SHOP} className="home-maker__cta">
                  Explore hill products
                  <ArrowRightIcon size={16} />
                </Link>
                <Link to={ROUTES.ABOUT} className="home-maker__story-link">
                  Our story
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Curated picks */}
        <ProductSection
          id="handpicked"
          title="Handpicked for you"
          subtitle="Fresh harvests and handmade finds from Himalayan makers."
          tag="handpicked"
          limit={5}
          seeAllHref={`${ROUTES.SHOP}?tag=handpicked`}
        />

        {/* Brand trust */}
        <section className="home-section why-section" id="why">
          <div className="container why-section__layout">
            <div className="why-section__visual">
              <img
                src={whyPahadLink}
                alt="Himalayan makers sorting local grains, honey and herbs"
                loading="lazy"
                decoding="async"
              />
              <div className="why-section__visual-copy">
                <strong>Rooted in Uttarakhand</strong>
                <span>Real produce. Real makers. Honest origins.</span>
              </div>
            </div>

            <div className="why-section__content">
              <div className="why-section__intro">
                <p className="section-eyebrow">Why PahadLink</p>
                <h2>Better goods from the hills</h2>
              </div>

              <div className="why-grid">
                {features.map((feature) => (
                  <article key={feature.title} className="why-card">
                    <div className="why-card__body">
                      <h3>{feature.title}</h3>
                      <p>{feature.desc}</p>
                      <ul className="why-card__points">
                        {feature.points.map((point) => (
                          <li key={point}>
                            <CheckCircleIcon size={14} />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Social proof */}
        <section className="home-section reviews-section" id="reviews">
          <div className="container">
            <div className="section-head reviews-head">
              <h2>Loved across India</h2>
              <p>Honest notes from shoppers who ordered hill produce.</p>
            </div>

            {homeReviews.length > 0 ? (
              <div className="reviews-slider">
                {homeReviews.length > REVIEWS_VISIBLE ? (
                  <>
                    <button
                      type="button"
                      className="reviews-slider__nav reviews-slider__nav--prev"
                      onClick={() => scrollReviews('prev')}
                      disabled={!canSlideLeft}
                      aria-label="Previous reviews"
                    >
                      <ArrowLeftIcon size={16} />
                    </button>
                    <button
                      type="button"
                      className="reviews-slider__nav reviews-slider__nav--next"
                      onClick={() => scrollReviews('next')}
                      disabled={!canSlideRight}
                      aria-label="Next reviews"
                    >
                      <ArrowRightIcon size={16} />
                    </button>
                  </>
                ) : null}

                <div className="reviews-slider__track" ref={reviewsTrackRef}>
                  {homeReviews.map((review) => (
                    <article
                      key={review.id}
                      className="reviews-slider__slide review-card"
                    >
                      <div className="review-card__rating">
                        <StarRating
                          rating={review.rating}
                          size={15}
                          className="review-stars"
                        />
                        <span className="review-card__score">
                          {Number(review.rating) || 0}/5
                        </span>
                        {review.verified ? (
                          <span className="review-verified">
                            <CheckCircleIcon size={13} />
                            Verified
                          </span>
                        ) : null}
                      </div>

                      <p className="review-text">{review.comment}</p>

                      <footer className="review-card__foot">
                        <div className="review-author">
                          <span className="review-avatar" aria-hidden="true">
                            {reviewInitials(review.userName)}
                          </span>
                          <div className="review-author__meta">
                            <strong>{review.userName}</strong>
                            <span>{review.userLocation || 'India'}</span>
                          </div>
                        </div>
                        {review.productName ? (
                          <p className="review-product">{review.productName}</p>
                        ) : null}
                      </footer>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <FaqSection
          page="home"
          title="Questions shoppers ask"
          subtitle="Quick answers before you place your first order."
        />
      </main>
      <Footer />
    </>
  )
}

export default Home
