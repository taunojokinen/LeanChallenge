import { useState } from 'react'
import Button from '../../shared/ui/Button/Button.jsx'
import GuideWindow from './GuideWindow.jsx'
import { LANDING_GUIDES } from './guideContent.js'
import factoryImage from '../../assets/factory.png'
import './LandingPage.css'

function LandingPage({ onLogin }) {
  const [activeGuideId, setActiveGuideId] = useState(null)
  const activeGuide = LANDING_GUIDES.find((guide) => guide.id === activeGuideId)

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
      </header>

      <div className="landing-layout">
        <aside className="landing-sidebar" aria-label="Ohjeet">
          <h2>OHJEET</h2>
          <nav className="landing-guide-list" aria-label="Lean-aiheiden ohjeet">
            {LANDING_GUIDES.map((guide) => (
              <button
                type="button"
                className={`landing-guide-link${activeGuideId === guide.id ? ' is-active' : ''}`}
                key={guide.id}
                aria-pressed={activeGuideId === guide.id}
                aria-controls={activeGuideId === guide.id ? 'landing-guide-window' : undefined}
                onClick={() => setActiveGuideId(guide.id)}
              >
                <span className="landing-guide-icon" aria-hidden="true">
                  <span />
                  <span />
                </span>
                <span>{guide.title}</span>
              </button>
            ))}
          </nav>
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
                Kirjaudu ja aloita
              </Button>
            </div>
            {activeGuide ? (
              <GuideWindow guide={activeGuide} onClose={() => setActiveGuideId(null)} />
            ) : null}
          </section>
        </main>
      </div>
    </div>
  )
}

export default LandingPage
