import { useState, useEffect } from 'react'
import { APP_NAME, APP_TAGLINE } from '../../config/appConfig.js'
import Button from '../../shared/ui/Button/Button.jsx'
import { fetchGameByJoinCode, fetchSetups } from '../../shared/api/gamesApi.js'
import { loginTeacher } from '../../shared/api/authApi.js'
import './LoginPage.css'

function LoginPage({ onBackToLanding, onStartQuest, onJoinClassroomGame, onTeacherLogin }) {
  const [view, setView] = useState('entry')
  const [playerName, setPlayerName] = useState('')
  const [gameCode, setGameCode] = useState('')
  const [joinMessage, setJoinMessage] = useState('')
  const [joinError, setJoinError] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const [setups, setSetups] = useState([])
  const [selectedSetupId, setSelectedSetupId] = useState(null)
  const [setupsError, setSetupsError] = useState('')
  const [isLoadingSetups, setIsLoadingSetups] = useState(false)
  const [teacherUsername, setTeacherUsername] = useState('')
  const [teacherPassword, setTeacherPassword] = useState('')
  const [teacherError, setTeacherError] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  // Haetaan vaikeustasot kun Quest-valintanäkymä avataan
  useEffect(() => {
    if (view !== 'quest') return

    let cancelled = false

    fetchSetups()
      .then((data) => {
        if (cancelled) return
        setSetups(data)
        // Kisälli (normaali) oletusvalinnaksi
        const defaultSetup = data.find((s) => s.name === 'Kisälli') ?? data[0]
        setSelectedSetupId(defaultSetup?.id ?? null)
      })
      .catch((error) => {
        if (cancelled) return
        setSetupsError(error.message)
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSetups(false)
      })

    return () => { cancelled = true }
  }, [view])

  const handleJoinSubmit = async (event) => {
    event.preventDefault()
    setJoinError('')
    setJoinMessage('')
    setIsJoining(true)

    try {
      const game = await fetchGameByJoinCode(gameCode, playerName)
      onJoinClassroomGame({ playerName: playerName.trim(), game })
    } catch (error) {
      setJoinError(error.message)
    } finally {
      setIsJoining(false)
    }
  }

  const handleStartQuestWithSetup = () => {
    const selectedSetup = setups.find((s) => s.id === selectedSetupId)
    if (selectedSetup) {
      onStartQuest(selectedSetup)
    }
  }

  const handleTeacherLoginSubmit = async (event) => {
    event.preventDefault()
    setTeacherError('')
    setIsLoggingIn(true)

    try {
      const teacher = await loginTeacher(teacherUsername.trim(), teacherPassword)
      onTeacherLogin(teacher)
      window.history.pushState({}, '', '/teacher/dashboard')
      window.dispatchEvent(new PopStateEvent('popstate'))
    } catch (error) {
      setTeacherError(error.message)
    } finally {
      setIsLoggingIn(false)
    }
  }

  return (
    <div className="login-page">
      <section className="login-visual" aria-labelledby="login-visual-title">
        <div className="login-visual-content">
          <div className="login-brand" aria-label={APP_NAME}>
            <span className="login-brand-mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="login-brand-text">{APP_NAME.toUpperCase()}</span>
          </div>
          <div className="login-copy-block">
            <h1 id="login-visual-title" className="login-tagline">{APP_TAGLINE}</h1>
            <p className="login-copy">
              {APP_NAME} on pelillinen oppimisympäristö, jossa johdat tuotantoyritystä
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
              <p className="login-eyebrow">{APP_NAME.toUpperCase()}</p>
              <h2 id="login-entry-title">Valitse tapa aloittaa</h2>
            </header>

            <div className="login-options">
              <button className="login-option-card" type="button" onClick={() => { setIsLoadingSetups(true); setSetupsError(''); setView('quest') }}>
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
        ) : view === 'quest' ? (
          <section className="login-card" aria-labelledby="quest-setup-title">
            <div className="login-card-header">
              <p className="login-eyebrow">QUEST</p>
              <h2 id="quest-setup-title">Valitse vaikeustaso</h2>
              <p>Valitse pelin vaikeustaso ennen aloittamista.</p>
            </div>

            {isLoadingSetups ? (
              <p className="login-notice" role="status">Ladataan vaikeustasoja…</p>
            ) : setupsError ? (
              <p className="login-notice login-notice--error" role="alert">{setupsError}</p>
            ) : (
              <div className="login-setup-options" role="radiogroup" aria-label="Vaikeustaso">
                {setups.map((setup) => (
                  <label
                    key={setup.id}
                    className={`login-setup-option${selectedSetupId === setup.id ? ' login-setup-option--selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="setup"
                      value={setup.id}
                      checked={selectedSetupId === setup.id}
                      onChange={() => setSelectedSetupId(setup.id)}
                      className="login-setup-radio"
                    />
                    <span className="login-setup-label">
                      <strong>{setup.name}</strong>
                      <span className="login-setup-description">
                        {setup.name === 'Oppipoika' && 'Helppo — sopii ensikertalaisille'}
                        {setup.name === 'Kisälli' && 'Normaali — tasapainoinen haaste'}
                        {setup.name === 'Mestari' && 'Vaikea — kokeneille pelaajille'}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}

            <Button
              className="login-submit-button"
              type="button"
              onClick={handleStartQuestWithSetup}
              disabled={isLoadingSetups || !!setupsError || !selectedSetupId}
            >
              Aloita peli
            </Button>
            <Button className="login-back-button" type="button" onClick={() => setView('entry')}>
              Takaisin
            </Button>
          </section>
        ) : view === 'join' ? (
          <form className="login-card" onSubmit={handleJoinSubmit}>
            <div className="login-card-header">
              <p className="login-eyebrow">PELIN ALOITUS</p>
              <h2>Liity peliin</h2>
              <p>Syötä nimesi ja opettajalta saamasi pelikoodi.</p>
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

            {joinError ? <p className="login-notice login-notice--error" role="alert">{joinError}</p> : null}
            {joinMessage ? <p className="login-notice" role="status">{joinMessage}</p> : null}

            <Button className="login-submit-button" type="submit" disabled={isJoining}>
              {isJoining ? 'Liitytään…' : 'Liity peliin'}
            </Button>
            <Button className="login-back-button" type="button" onClick={() => setView('entry')}>
              Takaisin
            </Button>
          </form>
        ) : (
          <form className="login-card" onSubmit={handleTeacherLoginSubmit}>
            <div className="login-card-header">
              <p className="login-eyebrow">OPETTAJAN TYÖTILA</p>
              <h2 id="teacher-login-title">Opettajan kirjautuminen</h2>
            </div>

            <div className="login-field-group">
              <label className="login-field-label" htmlFor="teacher-username">Käyttäjätunnus</label>
              <div className="login-input-shell">
                <input
                  id="teacher-username"
                  name="username"
                  type="text"
                  value={teacherUsername}
                  onChange={(event) => setTeacherUsername(event.target.value)}
                  placeholder="Käyttäjätunnus"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="login-field-group">
              <label className="login-field-label" htmlFor="teacher-password">Salasana</label>
              <div className="login-input-shell">
                <input
                  id="teacher-password"
                  name="password"
                  type="password"
                  value={teacherPassword}
                  onChange={(event) => setTeacherPassword(event.target.value)}
                  placeholder="Salasana"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            {teacherError ? <p className="login-notice login-notice--error" role="alert">{teacherError}</p> : null}

            <Button className="login-submit-button" type="submit" disabled={isLoggingIn}>
              {isLoggingIn ? 'Kirjaudutaan…' : 'Kirjaudu sisään'}
            </Button>
            <Button className="login-back-button" type="button" onClick={() => setView('entry')}>
              Takaisin
            </Button>
          </form>
        )}
      </main>
    </div>
  )
}

export default LoginPage