import { Link } from 'react-router-dom'
import Breadcrumb from '../components/layout/Breadcrumb'
import Footer from '../components/layout/Footer'
import {
  MountainIcon,
  LeafIcon,
  ShieldIcon,
  MapPinIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  HillsIcon,
  TruckIcon,
} from '../components/icons'
import { ROUTES } from '../config'
import heroImage from '../assets/images/banners/offer-mix-products.webp'
import storyImage from '../assets/images/banners/offer-honey-buransh.webp'
import rangeImage from '../assets/images/categories/category-organic-food.webp'

const PROMISES = [
  {
    icon: MountainIcon,
    title: 'Sourced in the hills',
    text: 'We buy from farmers and kitchen makers across Almora, Nainital, and nearby villages - not from factory blends shipped in from elsewhere.',
  },
  {
    icon: LeafIcon,
    title: 'Clean and natural',
    text: 'Honey, dals, millets, and sweets stay close to how they are made at home. No bulk fillers, no unnecessary preservatives.',
  },
  {
    icon: ShieldIcon,
    title: 'Checked before dispatch',
    text: 'Every order is packed in Haldwani, checked for damage, and sent with clear labels so you know what you are opening.',
  },
]

const MILESTONES = [
  {
    label: 'Where we work',
    value: 'Haldwani, Uttarakhand',
  },
  {
    label: 'What we ship',
    value: 'Foods, crafts & gifts',
  },
  {
    label: 'Delivery',
    value: 'Pan-India, 2–5 days*',
  },
  {
    label: 'Free shipping',
    value: 'First order free',
  },
  {
    label: 'Later delivery',
    value: 'From ₹39',
  },
  {
    label: 'First-order off',
    value: 'Flat ₹75',
  },
]

const RANGE = [
  'Pahadi rajma, gahat dal, mandua & jhangora',
  'Raw forest honey and buransh squash',
  'Bal mithai and festival sweets',
  'Ringaal crafts, pahadi topi, pichodi and gift hampers',
]

const About = () => {
  return (
    <>
      <main className="about-page">
        <div className="breadcrumb-bar breadcrumb-bar--soft">
          <div className="container">
            <Breadcrumb items={[{ label: 'About' }]} />
          </div>
        </div>

        <section className="about-hero" aria-label="About PahadLink">
          <div
            className="about-hero__media"
            style={{ backgroundImage: `url(${heroImage})` }}
            aria-hidden="true"
          />
          <div className="about-hero__veil" aria-hidden="true" />
          <div className="container about-hero__content">
            <h1>Hill-fresh essentials from Uttarakhand</h1>
            <p className="about-hero__lead">
              We connect mountain makers with homes across India - so pahadi taste
              arrives the way it should: pure, honest, and packed with care.
            </p>
            <div className="about-hero__actions">
              <Link to={ROUTES.SHOP} className="btn-hero-primary">
                Shop pahadi picks
                <ArrowRightIcon size={16} />
              </Link>
              <Link to={ROUTES.CONTACT} className="about-hero__ghost">
                Talk to our team
              </Link>
            </div>
          </div>
        </section>

        <section className="about-story">
          <div className="container about-story__grid">
            <div className="about-story__copy">
              <p className="about-kicker">Our story</p>
              <h2>Built from the hills, for kitchens that miss home</h2>
              <p>
                PahadLink started with a simple problem: families living away from
                Uttarakhand wanted real pahadi staples - rajma that softens right,
                honey that tastes of wild flowers, sweets that feel like Almora -
                but city shelves mostly offered generic substitutes.
              </p>
              <p>
                So we built a direct link. From our base on Almora Road in Haldwani,
                we work with small growers, home kitchens, and craft makers. We
                shortlist batches, pack carefully, and ship across India so the
                product in your bag is still recognisably from the hills.
              </p>
              <ul className="about-story__points">
                <li>
                  <CheckCircleIcon size={16} />
                  Fair prices for makers, fair prices for you
                </li>
                <li>
                  <CheckCircleIcon size={16} />
                  Small batches over mass-blended stock
                </li>
                <li>
                  <CheckCircleIcon size={16} />
                  Real support on WhatsApp, call, and email
                </li>
              </ul>
            </div>
            <figure className="about-story__figure">
              <img
                src={storyImage}
                alt="Pahadi honey and buransh squash from the hills"
                loading="lazy"
              />
              <figcaption>
                <HillsIcon size={16} />
                Honey, buransh, and kitchen staples sourced from Uttarakhand makers
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="about-facts" aria-label="PahadLink at a glance">
          <div className="container about-facts__row">
            {MILESTONES.map((item) => (
              <div key={item.label} className="about-fact">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="about-promise">
          <div className="container">
            <div className="about-promise__head">
              <p className="about-kicker">How we work</p>
              <h2>Three promises we keep on every order</h2>
              <p>
                No middleman remix. No mystery ingredients. Just clear sourcing,
                careful packing, and delivery you can track.
              </p>
            </div>
            <div className="about-promise__list">
              {PROMISES.map((item, index) => {
                const Icon = item.icon
                return (
                  <article key={item.title} className="about-promise__item">
                    <span className="about-promise__num" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="about-promise__icon" aria-hidden="true">
                      <Icon size={22} />
                    </span>
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.text}</p>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section className="about-range">
          <div className="container about-range__grid">
            <figure className="about-range__figure">
              <img
                src={rangeImage}
                alt="Organic pahadi foods and staples"
                loading="lazy"
              />
            </figure>
            <div className="about-range__copy">
              <p className="about-kicker">What you will find</p>
              <h2>Kitchen staples, sweets, and gifts that travel well</h2>
              <p>
                Whether you are stocking your pantry or sending a festival hamper
                home, the catalogue stays close to what pahadi households actually use.
              </p>
              <ul className="about-range__list">
                {RANGE.map((line) => (
                  <li key={line}>
                    <CheckCircleIcon size={15} />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <Link to={ROUTES.SHOP} className="about-range__link">
                Browse the full shop
                <ArrowRightIcon size={15} />
              </Link>
            </div>
          </div>
        </section>

        <section className="about-base">
          <div className="container about-base__panel">
            <div className="about-base__copy">
              <p className="about-kicker">Visit & support</p>
              <h2>Packed in Haldwani. Delivered across India.</h2>
              <p>
                Orders leave from Almora Road, Haldwani (263139). Most pin codes
                receive parcels in 2–5 days; remote hill routes can take longer in
                monsoon or winter.
              </p>
              <p className="about-base__address">
                <MapPinIcon size={16} />
                <span>Almora Road, Haldwani, Uttarakhand 263139</span>
              </p>
              <div className="about-base__actions">
                <Link to={ROUTES.CONTACT} className="btn-hero-primary">
                  Contact support
                </Link>
                <a href="https://wa.me/919690421423" className="about-base__wa">
                  WhatsApp us
                </a>
              </div>
              <p className="about-base__note">
                <TruckIcon size={14} />
                Free delivery on first order · later from ₹39
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

export default About
