import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Footer from '../components/layout/Footer'
import { HillsIcon, ArrowRightIcon } from '../components/icons'
import { ROUTES } from '../config'

export default function NotFound() {
  const { pathname } = useLocation()

  useEffect(() => {
    document.title = 'Page not found · PahadLink'
    return () => {
      document.title = 'PahadLink'
    }
  }, [])

  return (
    <>
      <main className="not-found-page">
        <section className="not-found" aria-labelledby="not-found-title">
          <div className="not-found__glow" aria-hidden="true" />
          <p className="not-found__brand">PahadLink</p>
          <p className="not-found__code" aria-hidden="true">
            404
          </p>
          <div className="not-found__icon" aria-hidden="true">
            <HillsIcon size={40} />
          </div>
          <h1 id="not-found-title">This trail ends here</h1>
          <p className="not-found__text">
            We could not find that page in the hills. Check the link, or head
            back to the shop.
          </p>
          {pathname && pathname !== '/' ? (
            <p className="not-found__path">
              Asked for <code>{pathname}</code>
            </p>
          ) : null}
          <div className="not-found__actions">
            <Link to={ROUTES.HOME} className="btn-hero-primary">
              Go home
              <ArrowRightIcon size={16} />
            </Link>
            <Link to={ROUTES.SHOP} className="not-found__secondary">
              Browse shop
            </Link>
            <Link to={ROUTES.CONTACT} className="not-found__link">
              Contact care
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
