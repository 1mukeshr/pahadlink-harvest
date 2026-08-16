import { memo, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useShop } from '../../context/ShopContext'
import { ROUTES, productPath } from '../../config'
import { CloseIcon, HeartIcon } from '../icons'

const formatPrice = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`

const WishlistDrawer = () => {
  const {
    wishlist,
    wishlistCount,
    wishlistOpen,
    closeWishlist,
    toggleWishlist,
  } = useShop()
  const panelRef = useRef(null)
  const wasOpen = useRef(false)

  useEffect(() => {
    if (wishlistOpen && !wasOpen.current && panelRef.current) {
      panelRef.current.focus({ preventScroll: true })
    }
    wasOpen.current = wishlistOpen
  }, [wishlistOpen])

  return (
    <div
      className={`wishlist-drawer${wishlistOpen ? ' wishlist-drawer--open' : ''}`}
      aria-hidden={!wishlistOpen}
    >
      <button
        type="button"
        className="wishlist-drawer__backdrop"
        aria-label="Close wishlist"
        tabIndex={wishlistOpen ? 0 : -1}
        onClick={closeWishlist}
      />

      <aside
        ref={panelRef}
        className="wishlist-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wishlist-drawer-title"
        tabIndex={-1}
      >
        <header className="wishlist-drawer__head">
          <div>
            <h2 id="wishlist-drawer-title">My wishlist</h2>
            <span>
              {wishlistCount} saved item{wishlistCount === 1 ? '' : 's'}
            </span>
          </div>
          <button
            type="button"
            className="wishlist-drawer__close"
            aria-label="Close wishlist"
            onClick={closeWishlist}
          >
            <CloseIcon size={18} />
          </button>
        </header>

        <div className="wishlist-drawer__body">
          {wishlist.length === 0 ? (
            <div className="wishlist-drawer__empty">
              <span className="wishlist-drawer__empty-icon">
                <HeartIcon size={28} />
              </span>
              <h3>Your wishlist is empty</h3>
              <p>Save products you love and find them here anytime.</p>
              <Link
                to={ROUTES.SHOP}
                className="wishlist-drawer__shop"
                onClick={closeWishlist}
              >
                Explore products
              </Link>
            </div>
          ) : (
            <ul className="wishlist-drawer__list">
              {wishlist.map((item) => (
                <li key={item.id} className="wishlist-drawer__item">
                  <Link
                    to={productPath(item.id)}
                    className="wishlist-drawer__thumb"
                    aria-label={`View ${item.name}`}
                    onClick={closeWishlist}
                  >
                    <img src={item.image} alt={item.name} loading="lazy" />
                  </Link>

                  <div className="wishlist-drawer__info">
                    <Link
                      to={productPath(item.id)}
                      className="wishlist-drawer__name"
                      onClick={closeWishlist}
                    >
                      {item.name}
                    </Link>
                    <strong>{formatPrice(item.price)}</strong>
                  </div>

                  <button
                    type="button"
                    className="wishlist-drawer__remove"
                    aria-label={`Remove ${item.name} from wishlist`}
                    title="Remove"
                    onClick={() => toggleWishlist(item)}
                  >
                    <CloseIcon size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {wishlist.length > 0 && (
          <footer className="wishlist-drawer__foot">
            <Link
              to={ROUTES.SHOP}
              className="wishlist-drawer__shop"
              onClick={closeWishlist}
            >
              Continue shopping
            </Link>
          </footer>
        )}
      </aside>
    </div>
  )
}

export default memo(WishlistDrawer)
