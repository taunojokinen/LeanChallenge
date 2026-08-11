import { useState } from 'react'
import Button from '../../shared/ui/Button/Button.jsx'
import { loginWithPlaceholder } from '../../features/auth/login.js'
import './LoginPage.css'

function LoginPage({ onBackToLanding, onLoginSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    const result = await loginWithPlaceholder({ username, password })

    if (!result.ok) {
      setErrors(result.errors)
      return
    }

    setErrors({})
    onLoginSuccess()
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
        <form className="login-card" onSubmit={handleSubmit} noValidate>
          <div className="login-card-header">
            <h2>KIRJAUDU</h2>
            <p>Syötä käyttäjätunnuksesi ja salasanasi.</p>
          </div>

          <div className="login-field-group">
            <label className="login-field-label" htmlFor="login-username">
              Käyttäjätunnus
            </label>
            <div className={`login-input-shell ${errors.username ? 'is-invalid' : ''}`}>
              <span className="login-input-icon" aria-hidden="true">
                ◯
              </span>
              <input
                id="login-username"
                name="username"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Syötä käyttäjätunnus"
                autoComplete="username"
              />
            </div>
            {errors.username ? <p className="login-error">{errors.username}</p> : null}
          </div>

          <div className="login-field-group">
            <label className="login-field-label" htmlFor="login-password">
              Salasana
            </label>
            <div className={`login-input-shell ${errors.password ? 'is-invalid' : ''}`}>
              <span className="login-input-icon" aria-hidden="true">
                ▣
              </span>
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Syötä salasana"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Piilota salasana' : 'Näytä salasana'}
              >
                {showPassword ? 'Piilota' : 'Näytä'}
              </button>
            </div>
            {errors.password ? <p className="login-error">{errors.password}</p> : null}
          </div>

          <Button className="login-submit-button" type="submit">
            KIRJAUDU
          </Button>

          <div className="login-divider" aria-hidden="true">
            <span />
            <strong>TAI</strong>
            <span />
          </div>

          <Button className="login-guides-button" type="button" onClick={onBackToLanding}>
            Ohjeet ja oppaat
          </Button>
        </form>
      </main>
    </div>
  )
}

export default LoginPage