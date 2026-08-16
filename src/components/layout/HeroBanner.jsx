import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRightIcon } from '../icons'
import { categoryPath, productPath } from '../../config'
import { productBanners } from '../../data/siteData'

/** Large product-related hero banners */
const LARGE_SLIDES = productBanners.map((banner) => ({
  alt: banner.alt,
  title: banner.title,
  text: banner.text,
  to: productPath(banner.id),
  image: banner.image,
}))

/**
 * Side panels — brand cards drawn from the theme rather than photography, so
 * the copy never lands on top of the wordmark baked into a product shot.
 */
const SMALL_PANELS = [
  {
    to: productPath('raw-honey'),
    tone: 'green',
    eyebrow: 'Natural products',
    title: 'Raw honey',
    text: 'Unprocessed forest honey from local keepers.',
  },
  {
    to: categoryPath('organic-food'),
    tone: 'cream',
    eyebrow: 'Organic foods',
    title: 'Hill staples',
    text: 'Rajma, millets and red rice for everyday pahadi cooking.',
  },
]

/**
 * Large product banner slider + two related product cards
 */
const HeroBanner = () => {
  const [index, setIndex] = useState(0)
  const active = LARGE_SLIDES[index]

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % LARGE_SLIDES.length)
    }, 4500)
    return () => clearInterval(timer)
  }, [])

  return (
    <section className="mf-hero" aria-label="PahadLink product banners">
      <div className="mf-hero__inner">
        <div className="mf-hero__grid">
          <div className="mf-hero__large-wrap">
            {LARGE_SLIDES.map((slide, i) => (
              <div
                key={slide.alt}
                className={`mf-hero__panel-img${i === index ? ' is-active' : ''}`}
              >
                <img
                  src={slide.image}
                  alt={slide.alt}
                  width={1000}
                  height={500}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                  fetchPriority={i === 0 ? 'high' : 'auto'}
                />
              </div>
            ))}

            <div className="mf-hero__cta" key={active.alt}>
              <p className="mf-hero__eyebrow">From the hills</p>
              <h2 className="mf-hero__title">{active.title}</h2>
              <p className="mf-hero__text">{active.text}</p>
              <Link to={active.to} className="mf-hero__shop-btn">
                <span>Shop now</span>
                <ArrowRightIcon size={16} />
              </Link>
            </div>

            <div className="mf-hero__dots" role="tablist" aria-label="Banner slides">
              {LARGE_SLIDES.map((slide, i) => (
                <button
                  key={slide.alt}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  className={`mf-hero__dot${i === index ? ' is-active' : ''}`}
                  onClick={() => setIndex(i)}
                  aria-label={`Slide ${i + 1}: ${slide.alt}`}
                />
              ))}
            </div>
          </div>

          <div className="mf-hero__smalls-row">
            {SMALL_PANELS.map((panel) => (
              <Link
                key={panel.title}
                to={panel.to}
                className={`mf-hero__small-wrap mf-hero__small-wrap--${panel.tone}`}
              >
                <div className="mf-hero__small-content">
                  <p className="mf-hero__small-eyebrow">{panel.eyebrow}</p>
                  <h3 className="mf-hero__small-title">{panel.title}</h3>
                  <p className="mf-hero__small-text">{panel.text}</p>
                </div>
                <span className="mf-hero__small-go" aria-hidden="true">
                  <ArrowRightIcon size={15} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default HeroBanner
