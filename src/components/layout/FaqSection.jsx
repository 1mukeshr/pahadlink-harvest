import { useState } from 'react'
import { getFaqs } from '../../data/faqData'

const FaqSection = ({
  page = 'home',
  title = 'Frequently asked questions',
  subtitle,
  items,
  id = 'faq',
  className = '',
}) => {
  const faqs = items || getFaqs(page)
  const [openIndex, setOpenIndex] = useState(0)

  if (!faqs.length) return null

  return (
    <section
      className={`faq-section${className ? ` ${className}` : ''}`}
      id={id}
      aria-label={title}
    >
      <div className="container faq-section__inner">
        <div className="faq-section__head">
          <h2>{title}</h2>
          {subtitle && <p className="faq-section__sub">{subtitle}</p>}
        </div>

        <div className="faq-section__list">
          {faqs.map((item, index) => {
            const isOpen = openIndex === index
            return (
              <div
                key={item.q}
                className={`faq-item${isOpen ? ' is-open' : ''}`}
              >
                <button
                  type="button"
                  className="faq-item__trigger"
                  aria-expanded={isOpen}
                  onClick={() => setOpenIndex(isOpen ? -1 : index)}
                >
                  <span className="faq-item__index">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="faq-item__question">{item.q}</span>
                  <span className="faq-item__icon" aria-hidden="true">
                    {isOpen ? '−' : '+'}
                  </span>
                </button>
                {isOpen && (
                  <div className="faq-item__answer">
                    <p>{item.a}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default FaqSection
