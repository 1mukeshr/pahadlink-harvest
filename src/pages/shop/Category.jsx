import { useEffect, useMemo } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import Breadcrumb from '../../components/layout/Breadcrumb'
import Footer from '../../components/layout/Footer'
import ProductCard from '../../components/products/ProductCard'
import { ROUTES, categoryPath } from '../../config'
import { CategoryIcon, ArrowRightIcon } from '../../components/icons'
import {
  getCategoryBanner,
  getCategoryById,
  getProductsByCategory,
  getRelatedCategories,
} from '../../data/siteData'

const CategoryPage = () => {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const typeParam = searchParams.get('type') || searchParams.get('sub') || ''

  const category = useMemo(() => getCategoryById(id), [id])

  const products = useMemo(
    () =>
      getProductsByCategory(id, {
        subcategory: typeParam || undefined,
      }),
    [id, typeParam]
  )

  const relatedCategories = useMemo(() => getRelatedCategories(id, 4), [id])
  const banner = useMemo(() => getCategoryBanner(id), [id])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [id])

  if (!category) {
    return <Navigate to={ROUTES.SHOP} replace />
  }

  const setType = (nextType) => {
    if (!nextType) {
      setSearchParams({}, { replace: true })
      return
    }
    setSearchParams({ type: nextType }, { replace: true })
  }

  const breadcrumbItems = [
    { label: 'Shop', to: ROUTES.SHOP },
    { label: category.name },
  ]

  return (
    <>
      <main className="category-page">
        <section
          className="category-hero"
          data-category={category.id}
          aria-labelledby="category-hero-title"
        >
          <div className="container category-hero__inner">
            {banner?.image && (
              <div className="category-hero__banner">
                <img
                  src={banner.image}
                  alt={banner.alt}
                  width={2560}
                  height={480}
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                />
                <div className="category-hero__copy">
                  
                  <h1 id="category-hero-title">{banner.title || category.name}</h1>
                  {banner.headline ? (
                    <p className="category-hero__headline">{banner.headline}</p>
                  ) : null}
                  {banner.blurb ? (
                    <p className="category-hero__blurb">{banner.blurb}</p>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </section>

        <div className="breadcrumb-bar">
          <div className="container">
            <Breadcrumb items={breadcrumbItems} />
          </div>
        </div>

        <section
          id="category-products"
          className="category-products"
          aria-label={`${category.name} products`}
        >
          <div className="container">
            <div className="category-chips" role="tablist" aria-label="Subcategories">
              <button
                type="button"
                role="tab"
                aria-selected={!typeParam}
                className={`category-chip${!typeParam ? ' is-active' : ''}`}
                onClick={() => setType('')}
              >
                All
              </button>
              {category.items.map((item) => {
                const active =
                  typeParam.trim().toLowerCase() ===
                  item.name.trim().toLowerCase()
                return (
                  <button
                    key={item.name}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`category-chip${active ? ' is-active' : ''}`}
                    onClick={() => setType(item.name)}
                  >
                    {item.name}
                  </button>
                )
              })}
            </div>

            {products.length === 0 ? (
              <div className="category-empty">
                <span className="category-empty__icon" aria-hidden="true">
                  <CategoryIcon name={category.id} size={26} />
                </span>
                <p className="category-empty__eyebrow">
                  {typeParam ? `${typeParam} filter` : category.name}
                </p>
                <h2>
                  No {typeParam ? typeParam.toLowerCase() : 'products'} available yet
                </h2>
                <p className="category-empty__copy">
                  We&apos;re adding more authentic hill products soon. Meanwhile,
                  explore everything available in this category.
                </p>
                <div className="category-empty__actions">
                  <button
                    type="button"
                    className="category-empty__primary"
                    onClick={() => setType('')}
                  >
                    Browse all {category.name}
                    <ArrowRightIcon size={14} />
                  </button>
                  <Link to={ROUTES.SHOP} className="category-empty__secondary">
                    Explore full shop
                  </Link>
                </div>
              </div>
            ) : (
              <div className="product-grid category-product-grid">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}

            {relatedCategories.length > 0 && (
              <div className="category-related">
                <div className="category-related__head">
                  <div>
                    <h2>Related categories</h2>
                    <p>Explore more authentic picks from the hills.</p>
                  </div>
                  <Link to={ROUTES.SHOP} className="category-related__all">
                    View shop
                    <ArrowRightIcon size={14} />
                  </Link>
                </div>
                <div className="category-related__grid">
                  {relatedCategories.map((group) => (
                    <Link
                      key={group.id}
                      to={categoryPath(group.id)}
                      className="category-related__card"
                    >
                      <span className="category-related__media">
                        {group.cover ? (
                          <img
                            src={group.cover}
                            alt=""
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <span className="category-related__fallback">
                            <CategoryIcon name={group.id} size={22} />
                          </span>
                        )}
                      </span>
                      <span className="category-related__body">
                        <strong>{group.name}</strong>
                        <em>
                          {group.count} product{group.count === 1 ? '' : 's'}
                        </em>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

export default CategoryPage
