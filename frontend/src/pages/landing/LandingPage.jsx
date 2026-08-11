import Button from '../../shared/ui/Button/Button.jsx'
import factoryImage from '../../assets/factory.png'
import './LandingPage.css'

const guideLinks = [
  'Lean-perusteet',
  'PDCA-sykli',
  'Hukan 7 lajia',
  'OEE ja KNL',
  'Lean-johtaminen',
  'JIT',
  'Kaizen',
  '5S',
]

const pdcaSteps = [
  {
    key: 'plan',
    title: 'PLAN',
    description: 'Analysoi nykytila ja aseta tavoitteet.',
  },
  {
    key: 'do',
    title: 'DO',
    description: 'Suunnittele Lean-toimenpiteet.',
  },
  {
    key: 'check',
    title: 'CHECK',
    description: 'Arvioi vaikutukset KNL-mittareihin ja kapasiteettiin.',
  },
  {
    key: 'act',
    title: 'ACT',
    description: 'Määritä hinta ja tuotevalikoima, hyväksy päätökset.',
  },
]

function LandingPage({ onLogin }) {
  return (
    <div className="landing-page">
      <header className="landing-topbar">
        <div className="landing-brand" aria-label="Lean Cockpit">
          <span className="landing-brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="landing-brand-text">LEAN COCKPIT</span>
        </div>

        <Button data-variant="topbar" onClick={onLogin}>
          KIRJAUDU
        </Button>
      </header>

      <div className="landing-layout">
        <aside className="landing-sidebar" aria-label="Ohjeet">
          <h2>OHJEET</h2>
          <nav className="landing-guide-list" aria-label="Oppaat ja ohjeet">
            {guideLinks.map((item) => (
              <button type="button" className="landing-guide-link" key={item}>
                <span className="landing-guide-icon" aria-hidden="true">
                  <span />
                  <span />
                </span>
                <span>{item}</span>
              </button>
            ))}
          </nav>

          <section className="landing-help-box" aria-label="Apu">
            <p>Tarvitsetko apua?</p>
            <button type="button" className="landing-help-link">
              Ota yhteyttä
            </button>
          </section>
        </aside>

        <main className="landing-main">
          <section className="landing-hero" aria-labelledby="landing-title">
            <img
              className="landing-hero-image"
              src={factoryImage}
              alt="Lean Cockpitin tehdasympäristö"
            />
            <div className="landing-hero-overlay" aria-hidden="true" />
            <div className="landing-hero-content">
              <h1 id="landing-title">LEAN COCKPIT</h1>
              <p className="landing-hero-tagline">Johda. Kehitä. Paranna.</p>
              <p className="landing-hero-copy">
                Lean Cockpit on pelillinen oppimisympäristö, jossa johdat tuotantoyritystä
                PDCA-mallin mukaisesti. Päätöksesi vaikuttavat tuotantoon, kannattavuuteen,
                laatuun ja KNL-tuloksiin.
              </p>
              <Button data-variant="hero" onClick={onLogin}>
                KIRJAUDU JA ALOITA
              </Button>
            </div>
          </section>

          <section className="landing-pdca" aria-labelledby="pdca-title">
            <h2 id="pdca-title">PDCA-malli</h2>
            <p className="landing-section-lead">PLAN → DO → CHECK → ACT</p>
            <div className="landing-pdca-flow" role="list" aria-label="PDCA-vaiheet">
              {pdcaSteps.map((step, index) => (
                <div className="landing-pdca-step-wrap" key={step.key} role="listitem">
                  <article className={`landing-pdca-step landing-pdca-step-${step.key}`}>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </article>
                  {index < pdcaSteps.length - 1 ? (
                    <span className="landing-pdca-arrow" aria-hidden="true">
                      →
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <section className="landing-info-bar" aria-label="Pelin keskeiset tiedot">
            <article className="landing-info-item">
              <h3>12 kierrosta</h3>
              <p>Simuloi yrityksen kehitystä 12 kierroksen ajan.</p>
            </article>
            <article className="landing-info-item">
              <h3>3 osastoa</h3>
              <p>Koneistus, Koonta, Lähettämö.</p>
            </article>
            <article className="landing-info-item">
              <h3>PDCA-malli</h3>
              <p>Jatkuva parantaminen PLAN → DO → CHECK → ACT.</p>
            </article>
            <article className="landing-info-item">
              <h3>Ohjeet ja oppaat</h3>
              <p>Vasemman reunan valikosta löydät oppaat ja ohjeet.</p>
            </article>
          </section>
        </main>
      </div>
    </div>
  )
}

export default LandingPage
