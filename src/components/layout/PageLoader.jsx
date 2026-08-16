import logo from '../../assets/images/logo.png'

const PageLoader = ({ label = 'Loading PahadLink' }) => (
  <div className="page-loader" role="status" aria-live="polite" aria-busy="true">
    <div className="page-loader__brand" aria-hidden="true">
      <img src={logo} alt="" className="page-loader__logo" width="200" height="50" />
    </div>
    <span className="page-loader__spinner" aria-hidden="true" />
    <span className="sr-only">{label}</span>
  </div>
)

export default PageLoader
