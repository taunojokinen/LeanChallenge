import { useState } from 'react'
import Button from '../../shared/ui/Button/Button.jsx'
import './LoginPage.css'

function LoginPage({ onBackToLanding, onStartQuest, onOpenTeacherSettings }) {
  const [view, setView] = useState('entry')
  const [playerName, setPlayerName] = useState('')
  const [gameCode, setGameCode] = useState('')
  const [joinMessage, setJoinMessage] = useState('')

  const handleJoinSubmit = (event) => {
    event.preventDefault()
    setJoinMessage('Peliin liittyminen otetaan käyttöön myöhemmin. Tarkistamme pelikoodin ennen peliin pääsyä.')
  }

  return (
    <div className="login-page">
      <section className="login-visual" aria-labelledby="login-visual-title">
        <div className="login-visual-content">
          <div className="login-brand" aria-label="Lean Cockpit">
            <span className="login-brand-mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="login-brand-text">LEAN COCKPIT</span>
          </div>
          <div className="login-copy-block">
            <h1 id="login-visual-title">LEAN COCKPIT</h1>
            <p className="login-tagline">Johda. Kehitä. Paranna.</p>
            <p className="login-copy">
              Lean Cockpit on pelillinen oppimisympäristö, jossa johdat tuotantoyritystä
              PDCA-mallin mukaisesti. Päätöksesi vaikuttavat tuotantoon, kannattavuuteen,
              laatuun ja KNL-tuloksiin.
            </p>
          </div>
        </div>
      </section>

      <main className="login-panel">
        {view === 'entry' ? (
          <section className="login-entry" aria-labelledby="login-entry-title">
            <header className="login-entry-header">
              <p className="login-eyebrow">LEAN CHALLENGE</p>
              <h2 id="login-entry-title">Valitse tapa aloittaa</h2>
            </header>

            <div className="login-options">
              <button className="login-option-card login-option-quest" type="button" onClick={onStartQuest}>
                <span className="login-option-copy">
                  <strong>Pelaa Quest</strong>
                  <span>Aloita itsenäinen peli heti, ilman kirjautumista.</span>
                </span>
                <span className="login-option-action">ALOITA <span aria-hidden="true">›</span></span>
              </button>
              <button className="login-option-card" type="button" onClick={() => setView('join')}>
                <span className="login-option-copy">
                  <strong>Liity peliin</strong>
                  <span>Syötä pelaajan nimi ja opettajalta saamasi pelikoodi.</span>
                </span>
                <span className="login-option-action">LIITY <span aria-hidden="true">›</span></span>
              </button>
              <button className="login-option-card" type="button" onClick={() => setView('teacher')}>
                <span className="login-option-copy">
                  <strong>Opettajan kirjautuminen</strong>
                  <span>Pelien avaaminen ja opiskelijoiden etenemisen seuranta.</span>
                </span>
                <span className="login-option-action">OPETTAJA <span aria-hidden="true">›</span></span>
              </button>
            </div>

            <Button className="login-back-button" type="button" onClick={onBackToLanding}>
              Etusivulle
            </Button>
          </section>
        ) : view === 'join' ? (
          <form className="login-card" onSubmit={handleJoinSubmit}>
            <div className="login-card-header">
              <p className="login-eyebrow">PELIN ALOITUS</p>
              <h2>Liity peliin</h2>
              <p>Peliin liittyminen ei ole vielä käytössä. Pelikoodi tarkistetaan ennen peliin pääsyä.</p>
            </div>

            <div className="login-field-group">
              <label className="login-field-label" htmlFor="join-player-name">Pelaajan nimi</label>
              <div className="login-input-shell">
                <input
                  id="join-player-name"
                  name="playerName"
                  type="text"
                  value={playerName}
                  onChange={(event) => setPlayerName(event.target.value)}
                  placeholder="Kirjoita nimesi"
                  autoComplete="name"
                  required
                />
              </div>
            </div>

            <div className="login-field-group">
              <label className="login-field-label" htmlFor="join-game-code">Pelikoodi</label>
              <div className="login-input-shell">
                <input
                  id="join-game-code"
                  name="gameCode"
                  type="text"
                  value={gameCode}
                  onChange={(event) => setGameCode(event.target.value)}
                  placeholder="Syötä pelikoodi"
                  autoComplete="off"
                  required
                />
              </div>
            </div>

            {joinMessage ? <p className="login-notice" role="status">{joinMessage}</p> : null}

            <Button className="login-submit-button" type="submit">Liity peliin</Button>
            <Button className="login-back-button" type="button" onClick={() => setView('entry')}>
              Takaisin
            </Button>
          </form>
        ) : (
          <section className="login-card" aria-labelledby="teacher-login-title">
            <div className="login-card-header">
              <p className="login-eyebrow">OPETTAJAN TYÖTILA</p>
              <h2 id="teacher-login-title">Opettajan kirjautuminen</h2>
            </div>

            <p className="login-notice" role="status">
              Opettajan tunnistautuminen otetaan käyttöön myöhemmin Firebase Authenticationilla. Tunnuksia ei kysytä eikä tallenneta tässä vaiheessa.
            </p>

            <div className="login-upcoming">
              <h3>Tulossa</h3>
              <ul>
                <li>Uusien pelien avaaminen ja vaikeusasetukset</li>
                <li>Pelikoodien luominen ja opiskelijoiden etenemisen seuranta</li>
                <li>Omien pelien hallinta sekä Questin pelaaminen</li>
                <li>Liittyminen omaan peliin pelaajana</li>
              </ul>
            </div>

            <Button className="login-submit-button" type="button" onClick={onOpenTeacherSettings}>
              Avaa opettajan asetukset
            </Button>
            <Button className="login-back-button" type="button" onClick={() => setView('entry')}>
              Takaisin
            </Button>
          </section>
        )}
      </main>
    </div>
  )
}

export default LoginPage