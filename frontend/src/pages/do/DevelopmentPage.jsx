import { useState } from 'react'
import { DEFAULT_FACTORY_SETTINGS } from '../../entities/factory-settings/defaultFactorySettings.js'
import { buildDevelopmentViewModel, updateDevelopmentHours } from '../../entities/development/model.js'
import { loadDevelopmentDecision, saveDevelopmentDecision } from '../../features/development/decisionAdapter.js'
import DevelopmentSlider from '../../widgets/development-slider/DevelopmentSlider.jsx'
import ProgressBar from '../../widgets/progress-bar/ProgressBar.jsx'
import Button from '../../shared/ui/Button/Button.jsx'
import './DevelopmentPage.css'

function DevelopmentRound({ gameState, factorySettings, onNavigate }) {
  const [initialDecision] = useState(() => loadDevelopmentDecision(gameState.round))
  const [hours, setHours] = useState(initialDecision.hours)
  const [status, setStatus] = useState('')
  const view = buildDevelopmentViewModel(gameState, hours, factorySettings)

  const handleChange = (key, value) => {
    setHours((previous) => updateDevelopmentHours(previous, key, value))
    setStatus('')
  }

  const handleSave = () => {
    try {
      saveDevelopmentDecision({ round: gameState.round, hours, factorySettings })
      setStatus(`Kehitystyö tallennettu kaudelle ${gameState.round}.`)
    } catch {
      setStatus('Kehitystyön tallennus epäonnistui. Muutokset ovat edelleen tässä näkymässä.')
      return
    }
    onNavigate('/do/investments')
  }

  return (
    <section className="development-page" aria-label="Kehitystyö">
      <header className="development-page__header">
        <h1>Kehitystyö</h1>
        <dl className="development-page__summary">
          <div><dt>Kehityskapasiteetti</dt><dd>{view.capacity} h</dd></div>
          <div><dt>Kohdennettu</dt><dd>{view.usedHours} h</dd></div>
          <div><dt>Vapaana</dt><dd>{view.remainingHours} h</dd></div>
        </dl>
      </header>
      <ProgressBar
        label="Kohdennettu"
        value={view.usedHours}
        maximum={view.capacity}
        formatValue={(value, maximum) => `${value} / ${maximum} h`}
      />
      {initialDecision.wasAdjusted ? (
        <p className="development-page__warning" role="status">
          Aiemmat päätökset eivät mahtuneet nykyiseen kapasiteettiin. Tarkista kohdennus ennen tallennusta.
        </p>
      ) : null}
      <div className="development-page__departments">
        {view.departments.map((department) => (
          <section className="development-page__department" key={department.key}
            aria-labelledby={`development-${department.key}`}>
            <h2 id={`development-${department.key}`}>{department.label}</h2>
            {department.methods.map((method) => (
              <div className="development-page__method" key={method.key}>
                <DevelopmentSlider
                  label={method.label}
                  value={method.value}
                  max={method.maximum}
                  predictedLevel={method.predictedLevel}
                  onChange={(value) => handleChange(method.key, value)}
                />
              </div>
            ))}
          </section>
        ))}
      </div>
      <footer className="development-page__footer">
        <p role="status" aria-live="polite">{status}</p>
        <Button onClick={handleSave}>Tallenna ja jatka</Button>
      </footer>
    </section>
  )
}

function DevelopmentPage({ gameState, factorySettings = DEFAULT_FACTORY_SETTINGS, onNavigate }) {
  return <DevelopmentRound key={gameState.round} gameState={gameState}
    factorySettings={factorySettings} onNavigate={onNavigate} />
}

export default DevelopmentPage