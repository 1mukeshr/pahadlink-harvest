import { Link } from 'react-router-dom'
import { ROUTES } from '../../config'

const Breadcrumb = ({ items = [], className = '' }) => {
  if (!items.length) return null

  const trail = [{ label: 'Home', to: ROUTES.HOME }, ...items]

  return (
    <nav
      className={`breadcrumb${className ? ` ${className}` : ''}`}
      aria-label="Breadcrumb"
    >
      <ol className="breadcrumb__list">
        {trail.map((item, index) => {
          const isLast = index === trail.length - 1

          return (
            <li key={`${item.label}-${index}`} className="breadcrumb__item">
              {index > 0 && (
                <span className="breadcrumb__sep" aria-hidden="true">
                  /
                </span>
              )}

              {isLast || !item.to ? (
                <span className="breadcrumb__current" aria-current="page">
                  {item.label}
                </span>
              ) : (
                <Link to={item.to} className="breadcrumb__link">
                  {item.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export default Breadcrumb
