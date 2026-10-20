import { useRef, useState } from 'react'
import { DEFAULT_FACTORY_SETTINGS } from '../../entities/factory-settings/defaultFactorySettings.js'
import { buildDevelopmentViewModel, updateDevelopmentHours } from '../../entities/development/model.js'
import { loadDevelopmentDecision, saveDevelopmentDecision } from '../../features/development/decisionAdapter.js'
import DevelopmentHelp from '../../features/development/DevelopmentHelp.jsx'
import DevelopmentSlider from '../../widgets/development-slider/DevelopmentSlider.jsx'
import ProgressBar from '../../widgets/progress-bar/ProgressBar.jsx'
import Button from '../../shared/ui/Button/Button.jsx'
import './DevelopmentPage.css'

function DevelopmentRound({ gameState, factorySettings, onNavigate }) {
  const [initialDecision] = useState(() => loadDevelopmentDecision(gameState.round))
  const [hours, setHours] = useState(initialDecision.hours)
  const [status, setStatus] = useState('')
  const hoursRef = useRef(initialDecision.hours)
  const savedHoursRef = useRef(initialDecision.wasAdjusted ? null : initialDecision.hours)
  const view = buildDevelopmentViewModel(gameState, hours, factorySettings)

  const handleChange = (key, value) => {
    const nextHours = updateDevelopmentHours(hoursRef.current, key, value)
    hoursRef.current = nextHours
    setHours(nextHours)
    try {
      saveDevelopmentDecision({ round: gameState.round, hours: nextHours, factorySettings })
      savedHoursRef.current = nextHours
      setStatus('')
    } catch {
      setStatus('Kehitystyön valinnan tallennus epäonnistui. Yritä uudelleen ennen sivulta poistumista.')
    }
  }

  const handleSave = () => {
    if (JSON.stringify(hoursRef.current) !== JSON.stringify(savedHoursRef.current)) {
      try {
        saveDevelopmentDecision({ round: gameState.round, hours: hoursRef.current, factorySettings })
        savedHoursRef.current = hoursRef.current
      } catch {
        setStatus('Kehitystyön tallennus epäonnistui. Yritä uudelleen ennen jatkamista.')
        return
      }
    }
    setStatus(`Kehitystyö tallennettu kaudelle ${gameState.round}.`)
    onNavigate('/do/investments')
  }

  return (
    <section className="development-page" aria-label="Kehitystyö">
      <section className="development-page__capacity" aria-label="Kehityskapasiteetti">
        <header className="development-page__header">
          <div className="development-page__title-group">
            <h1>Kehitystyö</h1>
            <DevelopmentHelp />
          </div>
          <dl className="development-page__summary">
            <div><dt>Kehityskapasiteetti</dt><dd>{view.capacity} h</dd></div>
            <div><dt>Kohdennettu</dt><dd>{view.usedHours} h</dd></div>
            <div><dt>Vapaana</dt><dd>{view.remainingHours} h</dd></div>
          </dl>
        </header>
        <ProgressBar
          label="Kapasiteetin käyttö"
          value={view.usedHours}
          maximum={view.capacity}
          showValue={false}
          formatValue={(value, maximum) => `${value} / ${maximum} h`}
        />
      </section>
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
                  allocationMaximum={method.allocationMaximum}
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