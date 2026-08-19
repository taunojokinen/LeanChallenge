import { useEffect, useMemo, useState } from 'react'
import Card from '../../shared/ui/Card/Card.jsx'
import Button from '../../shared/ui/Button/Button.jsx'
import { buildFiveSViewModel } from '../../entities/five-s/model.js'
import { getFiveSSnapshot } from '../../shared/api/fiveSApi.js'
import { loadFiveSDecision, saveFiveSDecision } from '../../features/five-s/decisionStore.js'
import './FiveSPage.css'

const DEPARTMENT_FIELDS = [
  { key: 'machining', label: 'Koneistus' },
  { key: 'assembly', label: 'Koonta' },
  { key: 'shipping', label: 'Lähettämö' },
]

const EMPTY_HOURS = {
  machining: 0,
  assembly: 0,
  shipping: 0,
}

function sanitizeHours(value) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0
  }

  return Math.round(numericValue)
}

function formatLevelShort(level) {
  return Number(level || 0).toLocaleString('fi-FI', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

function FiveSPage() {
  const [snapshot, setSnapshot] = useState(null)
  const [investedHours, setInvestedHours] = useState(EMPTY_HOURS)
  const [savedDecision, setSavedDecision] = useState(null)
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadSnapshot = async () => {
      const data = await getFiveSSnapshot()

      if (!isMounted) {
        return
      }

      setSnapshot(data)

      const storedDecision = loadFiveSDecision(data.round)

      if (storedDecision) {
        setSavedDecision(storedDecision)
        setInvestedHours(storedDecision.investedHours)
      }
    }

    loadSnapshot()

    return () => {
      isMounted = false
    }
  }, [])

  const viewModel = useMemo(() => {
    if (!snapshot) {
      return null
    }

    return buildFiveSViewModel(snapshot, savedDecision, investedHours)
  }, [savedDecision, investedHours, snapshot])

  const updateDepartmentHours = (departmentKey, nextValue) => {
    setInvestedHours((previousValue) => ({
      ...previousValue,
      [departmentKey]: sanitizeHours(nextValue),
    }))
  }

  const handleSave = () => {
    if (!snapshot || !viewModel || !viewModel.focus.canSave) {
      setStatusMessage('Panostusta ei voi tallentaa, koska osastojen tuntisumma ylittää fokusbudjetin.')
      return
    }

    const nextDecision = {
      round: snapshot.round,
      investedHours,
      usedFocusHours: viewModel.focus.usedHours,
      savedAt: new Date().toISOString(),
    }

    saveFiveSDecision(nextDecision)
    setSavedDecision(nextDecision)
    setStatusMessage(
      `5S-panostus ${viewModel.focus.usedHoursText} tallennettu kierrokselle ${snapshot.round}.`,
    )
  }

  if (!viewModel) {
    return (
      <section className="five-s-page" aria-label="5S-näkymä latautuu">
        <header className="five-s-header">
          <h1>5S – Paranna koko tehtaan suorituskykyä</h1>
          <p>Ladataan 5S-näkymää...</p>
        </header>
      </section>
    )
  }

  return (
    <section className="five-s-page" aria-label="5S-ohjelman päätösnäkymä">
      <header className="five-s-header">
        <div>
          <h1>5S – Paranna koko tehtaan suorituskykyä</h1>
          <p>
            Kohdista Lean-asiantuntijan fokus osastoille. Panostus ylläpitää 5S-kuria ja nostaa
            osastojen kehitystasoa seuraavalle kierrokselle.
          </p>
          <p className="five-s-focus-line">
            Fokus {viewModel.focus.totalHoursText} | Käytetty {viewModel.focus.usedHoursText} |
            Jäljellä {viewModel.focus.remainingHoursText}
          </p>
        </div>

        <div className="five-s-budget-strip" aria-label="Fokusbudjetti">
          <Card>
            <div className="five-s-budget-item">
              <small>Fokus yhteensä</small>
              <strong>{viewModel.focus.totalHoursText}</strong>
            </div>
          </Card>
          <Card>
            <div className="five-s-budget-item">
              <small>Käytetty fokus</small>
              <strong>{viewModel.focus.usedHoursText}</strong>
            </div>
          </Card>
          <Card>
            <div className="five-s-budget-item">
              <small>Jäljellä</small>
              <strong>{viewModel.focus.remainingHoursText}</strong>
            </div>
          </Card>
        </div>
      </header>

      <div className="five-s-three-column" aria-label="5S-päätöksen pääalueet">
        <Card>
          <article className="five-s-panel">
            <header className="five-s-panel-header">
              <h2>Nykyinen 5S-taso</h2>
              <p>5S-taso lasketaan osaston tehollisista työtunneista.</p>
            </header>

            <div className="five-s-area-list">
              {viewModel.departments.map((department) => (
                <div className="five-s-area-item" key={department.key}>
                  <div className="five-s-area-row">
                    <div>
                      <strong>
                        {department.name} {department.currentLevelText}
                      </strong>
                      <p>Teholliset 5S-tunnit: {department.currentEffectiveHoursText}</p>
                    </div>
                    <span>{department.currentLevelText}</span>
                  </div>
                  <div className="five-s-area-meter" aria-hidden="true">
                    <span style={{ width: `${Math.min(100, department.currentLevel * 20)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </article>
        </Card>

        <Card>
          <article className="five-s-panel">
            <header className="five-s-panel-header">
              <h2>Panostus tällä kierroksella</h2>
              <p>Syötä tunnit osastoittain. Yhteensä enintään {viewModel.focus.totalHoursText}.</p>
            </header>

            <div className="five-s-input-grid">
              {DEPARTMENT_FIELDS.map((field) => {
                const department = viewModel.departments.find((item) => item.key === field.key)

                if (!department) {
                  return null
                }

                return (
                  <label className="five-s-hour-input" key={field.key}>
                    <span>{field.label}</span>
                    <div className="five-s-hour-input-row">
                      <input
                        type="number"
                        min="0"
                        max={viewModel.focus.totalHours}
                        step="1"
                        value={investedHours[field.key]}
                        onChange={(event) => updateDepartmentHours(field.key, event.target.value)}
                        onBlur={(event) => updateDepartmentHours(field.key, event.target.value)}
                      />
                      <span aria-hidden="true">h</span>
                    </div>
                    <small>
                      Arvio: <strong>{department.impactCategory}</strong>
                    </small>
                  </label>
                )
              })}
            </div>

            <div className="five-s-decision-summary">
              <div>
                <small>Kierroksen fokus</small>
                <strong>{viewModel.focus.totalHoursText}</strong>
              </div>
              <div>
                <small>Käytetty</small>
                <strong>{viewModel.focus.usedHoursText}</strong>
              </div>
              <div>
                <small>Jäljellä</small>
                <strong>{viewModel.focus.remainingHoursText}</strong>
              </div>
            </div>

            <div className="five-s-save-area">
              <Button type="button" onClick={handleSave} disabled={!viewModel.focus.canSave}>
                TALLENNA PANOSTUS
              </Button>
              {!viewModel.focus.canSave ? (
                <small>Osastojen tuntisumma ylittää 400 h fokusbudjetin.</small>
              ) : (
                <small>Panostus tallennetaan osastokohtaisina tunteina.</small>
              )}
              {statusMessage ? <p className="five-s-status-message">{statusMessage}</p> : null}
            </div>
          </article>
        </Card>

        <Card>
          <article className="five-s-panel">
            <header className="five-s-panel-header">
              <h2>Mitä 5S tuo</h2>
              <p>Hyödyt rakentavat pohjan jatkuvalle parantamiselle.</p>
            </header>

            <ul className="five-s-benefits-list">
              {viewModel.benefits.map((benefit) => (
                <li key={benefit}>{benefit}</li>
              ))}
            </ul>
          </article>
        </Card>
      </div>

      <section className="five-s-impact-section" aria-label="Arvioitu vaikutus ensi kaudelle">
        <header className="five-s-panel-header">
          <h2>Arvio vaikutuksesta ensi kaudelle</h2>
          <p>
            Arvio on suuntaa-antava. Toteutunut vaikutus selviää CHECK-vaiheessa.
          </p>
        </header>

        <div className="five-s-impact-table-wrap">
          <table className="five-s-impact-table">
            <thead>
              <tr>
                <th>Osasto</th>
                <th>Nykyinen 5S</th>
                <th>Panostus</th>
                <th>Vaikutusarvio</th>
              </tr>
            </thead>
            <tbody>
              {viewModel.departments.map((department) => (
                <tr key={department.key}>
                  <td>{department.name}</td>
                  <td>
                    <strong>{formatLevelShort(department.currentLevel)}</strong>
                    <span>{department.currentEffectiveHoursText}</span>
                  </td>
                  <td>
                    <strong>{department.investedHoursText}</strong>
                    <span>Osastolle kohdistettu fokus</span>
                  </td>
                  <td>
                    <strong>{department.impactCategory}</strong>
                    <span>Perustuu mallin laskemaan tasomuutokseen</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="five-s-factory-impact">
          Koko tehtaan arvioitu vaikutusluokka: <strong>{viewModel.impacts.factory.impactCategory}</strong>.
        </p>
      </section>
    </section>
  )
}

export default FiveSPage