import { useMemo, useState } from 'react'
import Button from '../../shared/ui/Button/Button.jsx'
import Card from '../../shared/ui/Card/Card.jsx'
import { calculateRoundForecast } from '../../entities/forecast/model.js'
import { advanceRoundState } from '../../entities/game-round/advanceRound.js'
import { loadFiveSDecision } from '../../features/five-s/decisionStore.js'
import { loadProjectsDecision } from '../../features/projects/decisionStore.js'
import { loadInvestmentsDecision } from '../../features/investments/decisionStore.js'
import {
  loadCheckStaffingDecision,
  saveCheckStaffingDecision,
  loadCheckProductionDecision,
  saveCheckProductionDecision,
} from '../../features/check/decisionStore.js'
import { resolveCheckRoundLabels } from './roundLabels.js'
import './CheckPage.css'

const EURO_FORMATTER = new Intl.NumberFormat('fi-FI', {
  maximumFractionDigits: 0,
})

const DECIMAL_FORMATTER = new Intl.NumberFormat('fi-FI', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

function formatArea(value) {
  return `${EURO_FORMATTER.format(Math.round(Number(value) || 0))} m²`
}

function formatContainers(value) {
  return `${DECIMAL_FORMATTER.format(Number(value) || 0)} konttia`
}

function toNonNegativeInteger(value, fallback = 0) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return fallback
  }

  return Math.round(numericValue)
}

function getStaffingSliderMax(department, staffing, forecast, factorySettings) {
  const currentEmployees = Math.max(0, Number(staffing[department]) || 0)
  const workerSpace = Math.max(0, Number(factorySettings?.factory?.workerSpaceM2) || 0)
  const freeSpace = Number(forecast?.forecast?.inventory?.openingFreeFactorySpace) || 0

  return workerSpace > 0
    ? currentEmployees + Math.floor(Math.max(0, freeSpace) / workerSpace)
    : currentEmployees + 1
}

function CheckPage({ onNavigate, gameState, factorySettings }) {
  const [staffingDraft, setStaffingDraft] = useState(null)
  const [batchSizeDraft, setBatchSizeDraft] = useState(null)

  const decisionData = useMemo(() => {
    if (!gameState) {
      return null
    }

    const round = gameState.round
    const fiveSDecision = loadFiveSDecision(round)
    const projectsDecision = loadProjectsDecision(round)
    const investmentsDecision = loadInvestmentsDecision(round)
    const checkStaffingDecision = loadCheckStaffingDecision(round)
    const checkProductionDecision = loadCheckProductionDecision(round)

    const defaultStaffing = {
      assembly: gameState.staffing?.assembly ?? 0,
      shipping: gameState.staffing?.shipping ?? 0,
    }
    const nextStaffing = checkStaffingDecision?.staffing || defaultStaffing
    const nextGameState = {
      ...gameState,
      fiveSDecision,
      projectsDecision,
      investmentsDecision,
      checkStaffingDecision,
    }

    // Default the planned round's batch size to the currently active (confirmed) batch size,
    // so nothing changes unless the player deliberately picks a different value.
    const initialBatchSize =
      checkProductionDecision?.batchSize ??
      gameState.market?.batchSize ??
      factorySettings?.production?.initialBatchSize ??
      20

    return {
      gameState: nextGameState,
      staffing: nextStaffing,
      batchSize: initialBatchSize,
    }
  }, [factorySettings, gameState])

  const decisionGameState = decisionData?.gameState ?? null
  const decisionRound = decisionGameState ? decisionGameState.round : null
  const staffing = useMemo(() => (
    staffingDraft?.round === decisionRound
      ? staffingDraft.values
      : decisionData?.staffing ?? { assembly: 0, shipping: 0 }
  ), [decisionData, decisionRound, staffingDraft])
  const batchSize = batchSizeDraft?.round === decisionRound
    ? batchSizeDraft.value
    : decisionData?.batchSize ?? 20

  const forecast = useMemo(() => {
    if (!decisionGameState) {
      return null
    }

    // Only the staffing decision affects this baseline forecast; batchSize is applied separately
    // below (via previewForecast) since calculateScenario resolves current/forecast from the same
    // market decisions and batchSize must not retroactively change the confirmed round's own capacity.
    return calculateRoundForecast(decisionGameState, {
      staffing,
    }, factorySettings)
  }, [decisionGameState, factorySettings, staffing])

  // The round-N forecast including this round's own batch-size decision. Despite its name and
  // the advanceRoundState plumbing, this represents THIS planning round's (gameState.round) own
  // forecast, not round+1 - see the round labels above. Planned production is owned by ACT, so no
  // productionQuantity override is passed here - it naturally falls back to a demand-driven value
  // for capacity/minimum-FG purposes.
  const previewForecast = useMemo(() => {
    if (!decisionGameState || !forecast) {
      return null
    }

    try {
      const { nextGameState: previewGameState } = advanceRoundState({
        gameState: decisionGameState,
        forecast,
        totalRounds: factorySettings?.game?.totalRounds ?? 12,
        checkProductionDecision: {
          round: decisionGameState.round,
          batchSize,
        },
      })

      return calculateRoundForecast(previewGameState, {}, factorySettings)
    } catch {
      return null
    }
  }, [batchSize, decisionGameState, factorySettings, forecast])
  const capacityForecast = previewForecast ?? forecast

  // Persist every edit to the round-scoped decision stores so choices survive navigation and reload.
  const persistStaffing = (nextStaffing) => {
    if (!decisionGameState) {
      return
    }

    saveCheckStaffingDecision({
      round: decisionGameState.round,
      staffing: nextStaffing,
      savedAt: new Date().toISOString(),
    })
  }

  const persistBatchSizeDecision = (nextBatchSize) => {
    if (!decisionGameState) {
      return
    }

    saveCheckProductionDecision({
      round: decisionGameState.round,
      batchSize: nextBatchSize,
      savedAt: new Date().toISOString(),
    })
  }

  const updateStaffing = (key, rawValue) => {
    const maxStaffing = getStaffingSliderMax(key, staffing, forecast, factorySettings)
    const requestedStaffing = toNonNegativeInteger(rawValue, staffing[key])
    const nextStaffing = {
      ...staffing,
      [key]: Math.min(maxStaffing, requestedStaffing),
    }

    setStaffingDraft({ round: decisionGameState.round, values: nextStaffing })
    persistStaffing(nextStaffing)
  }

  const handleBatchSizeChange = (rawValue) => {
    const minBatchSize = factorySettings?.production?.minBatchSize ?? 1
    const maxBatchSize = factorySettings?.production?.maxBatchSize ?? 20
    const requestedValue = toNonNegativeInteger(rawValue, batchSize)
    const nextBatchSize = Math.min(maxBatchSize, Math.max(minBatchSize, requestedValue))

    setBatchSizeDraft({ round: decisionGameState.round, value: nextBatchSize })
    persistBatchSizeDecision(nextBatchSize)
  }

  const adjustStaffing = (key, delta) => {
    updateStaffing(key, Math.max(0, (Number(staffing[key]) || 0) + delta))
  }

  const adjustBatchSize = (delta) => {
    handleBatchSizeChange(batchSize + delta)
  }

  if (!forecast) {
    return (
      <section className="check-page" aria-label="CHECK-vaiheen vaikutusarvio latautuu">
        <h1>CHECK - Vaikutusarvio</h1>
        <p>Ladataan ennustetta...</p>
      </section>
    )
  }

  const factorySpace = capacityForecast.forecast.space
  const previewInventory = previewForecast?.forecast.inventory
  const { planningRound } = resolveCheckRoundLabels(decisionGameState.round)

  const departments = [
    { key: 'machining', label: 'Koneistus' },
    { key: 'assembly', label: 'Koonta', staffActionLabel: 'koonnan' },
    { key: 'shipping', label: 'Lähettämö', staffActionLabel: 'lähettämön' },
  ]

  return (
    <section className="check-page" aria-label="CHECK-vaiheen vaikutusarvio">
      <header className="check-header">
        <h1>CHECK – Vaikutusarvio</h1>
        <p>Säädä henkilöstöä ja eräkokoa. Tarkista vaikutukset ennen ACT-vaihetta.</p>
      </header>

      <div className="check-primary-grid">
        <Card>
          <article className="check-primary-card">
            <h2>Henkilöstö ja kapasiteetti</h2>
            <p className="check-card-intro">
              Henkilöstöpäätökset kierrokselle {planningRound}; kapasiteettiennuste kierrokselle {capacityForecast.round}.
            </p>
            <div className="check-department-list">
              {departments.map((department) => {
                const employeeCount = capacityForecast.forecast.staffing[department.key]
                const capacity = capacityForecast.forecast.capacityByDepartment[department.key]
                const isBottleneck = capacityForecast.summary.bottleneckKey === department.key
                const adjustable = department.key !== 'machining'
                const sliderMax = adjustable
                  ? getStaffingSliderMax(department.key, staffing, forecast, factorySettings)
                  : employeeCount
                const staffingSpaceBlocked = adjustable
                  && (Number(factorySettings?.factory?.workerSpaceM2) || 0) > 0
                  && sliderMax <= staffing[department.key]
                  && (Number(forecast.forecast.inventory.openingFreeFactorySpace) || 0)
                    < (Number(factorySettings?.factory?.workerSpaceM2) || 0)

                return (
                  <div
                    key={department.key}
                    className={`check-department check-department--${department.key}${isBottleneck ? ' is-bottleneck' : ''}`}
                  >
                    <div className="check-department__heading">
                      <span>{department.label}{adjustable ? '' : ' · automaattinen'}</span>
                      <strong>{employeeCount} hlö</strong>
                    </div>
                    <p>{formatContainers(capacity)} / kierros</p>
                    {adjustable ? (
                      <>
                        <div className="check-value-stepper">
                          <Button
                            type="button"
                            aria-label={`Vähennä ${department.staffActionLabel} henkilöstöä`}
                            disabled={staffing[department.key] <= 0}
                            onClick={() => adjustStaffing(department.key, -1)}
                          >
                            −
                          </Button>
                          <output aria-live="polite">{staffing[department.key]} hlö</output>
                          <Button
                            type="button"
                            aria-label={`Lisää ${department.staffActionLabel} henkilöstöä`}
                            disabled={staffingSpaceBlocked}
                            onClick={() => adjustStaffing(department.key, 1)}
                          >
                            +
                          </Button>
                        </div>
                        <label className="check-range">
                          <span className="visually-hidden">{department.label} henkilöstö</span>
                          <input
                            aria-label={`${department.label} henkilöstö`}
                            aria-describedby={`${department.key}-staffing-help`}
                            type="range"
                            min="0"
                            max={sliderMax}
                            step="1"
                            value={staffing[department.key]}
                            onChange={(event) => updateStaffing(department.key, event.target.value)}
                          />
                          <span id={`${department.key}-staffing-help`} className="visually-hidden">
                            Henkilöstön alaraja on nolla. Yläraja määräytyy käytettävissä olevan tehdastilan perusteella.
                          </span>
                        </label>
                        {staffingSpaceBlocked ? (
                          <small className="check-space-warning" role="status">
                            Tehdastila ei riitä henkilöstön lisäämiseen.
                          </small>
                        ) : null}
                      </>
                    ) : null}
                    {isBottleneck ? <small className="check-bottleneck-label">Pullonkaula</small> : null}
                  </div>
                )
              })}
            </div>
          </article>
        </Card>

        <Card>
          <article className="check-primary-card">
            <h2>Eräkoko ja varasto</h2>
            <p className="check-card-intro">
              Eräkoon tuotantovaikutus näkyy kierroksen {capacityForecast.round} ennusteessa.
            </p>
            <div className="check-batch-control">
              <span>Eräkoko</span>
              <div className="check-value-stepper">
                <Button
                  type="button"
                  aria-label="Pienennä eräkokoa"
                  disabled={batchSize <= (factorySettings?.production?.minBatchSize ?? 1)}
                  onClick={() => adjustBatchSize(-1)}
                >
                  −
                </Button>
                <output aria-live="polite">{batchSize} konttia</output>
                <Button
                  type="button"
                  aria-label="Suurenna eräkokoa"
                  disabled={batchSize >= (factorySettings?.production?.maxBatchSize ?? 20)}
                  onClick={() => adjustBatchSize(1)}
                >
                  +
                </Button>
              </div>
              <input
                aria-label="Eräkoko"
                type="range"
                min={factorySettings?.production?.minBatchSize ?? 1}
                max={factorySettings?.production?.maxBatchSize ?? 20}
                step="1"
                value={batchSize}
                onChange={(event) => handleBatchSizeChange(event.target.value)}
              />
            </div>
            <dl className="check-inventory-metrics">
              <div>
                <dt>Minimivarasto</dt>
                <dd>{formatContainers(previewInventory?.minimumFinishedGoodsInventory)}</dd>
              </div>
              <div>
                <dt>Vapaasti myytävä varasto</dt>
                <dd>{formatContainers(previewInventory?.sellableOpeningFinishedGoodsInventory)}</dd>
              </div>
              <div>
                <dt>Fyysinen varasto</dt>
                <dd>{formatContainers(previewInventory?.openingFinishedGoodsInventory)}</dd>
              </div>
              <div>
                <dt>
                  Vapaa tehdastila
                  <span
                    className="check-space-info"
                    role="img"
                    aria-label="Kierroksen alun valmistuotevarasto varaa tilansa koko kierroksen ajan. Toimitukset eivät vapauta tilaa saman kierroksen uudelle tuotannolle."
                    title="Kierroksen alun valmistuotevarasto varaa tilansa koko kierroksen ajan. Toimitukset eivät vapauta tilaa saman kierroksen uudelle tuotannolle."
                  >
                    i
                  </span>
                </dt>
                <dd className={(previewInventory?.openingFreeFactorySpace ?? 0) < 0 ? 'is-negative' : ''}>
                  {previewForecast ? `${Math.round(previewInventory?.openingFreeFactorySpace ?? 0)} m²` : '-'}
                </dd>
              </div>
            </dl>
            <p className="check-space-explanation">
              Kierroksen alun fyysinen varasto varaa tilansa koko kierroksen ajan; toimitukset eivät vapauta tilaa saman kierroksen uudelle tuotannolle.
            </p>
          </article>
        </Card>

        <Card>
          <article className="check-primary-card check-primary-card--info">
            <h2>Miksi minimivarastoa tarvitaan?</h2>
            <p>
              Asiakas edellyttää jatkuvaa toimituskykyä: viikon aikana on pystyttävä toimittamaan mitä tahansa tuotevariaatiota.
            </p>
            <hr />
            <p>
              <strong>Pienempi eräkoko ja suurempi konemäärä vähentävät minimivaraston tarvetta.</strong>
            </p>
            <h3 className="check-space-breakdown__title">Tehdastilan käyttö</h3>
            <dl className="check-space-breakdown">
              <div>
                <dt>Koneistus</dt>
                <dd>{formatArea(factorySpace.machiningArea)}</dd>
              </div>
              <div>
                <dt>Koonta</dt>
                <dd>{formatArea(factorySpace.assemblyArea)}</dd>
              </div>
              <div>
                <dt>Lähettämö ja sen henkilöstö</dt>
                <dd>{formatArea(factorySpace.shippingArea + factorySpace.shippingWorkerArea)}</dd>
              </div>
              <div>
                <dt>Toimisto- ja sosiaalitilat</dt>
                <dd>{formatArea(factorySpace.officeAndSocialArea)}</dd>
              </div>
              <div>
                <dt>Valmistuotevarasto</dt>
                <dd>{formatArea(factorySpace.finishedGoodsArea)}</dd>
              </div>
              <div className="check-space-breakdown__total">
                <dt>Käytetty tehdastila yhteensä</dt>
                <dd>{formatArea(factorySpace.totalUsed)}</dd>
              </div>
              <div className="check-space-breakdown__total">
                <dt>Vapaa tehdastila</dt>
                <dd>{formatArea(factorySpace.freeArea)}</dd>
              </div>
              <div>
                <dt>Tehtaan kokonaispinta-ala</dt>
                <dd>{formatArea(factorySpace.totalArea)}</dd>
              </div>
            </dl>
          </article>
        </Card>
      </div>

      <section className="check-page__footer" aria-label="CHECK-vaiheen eteneminen">
        <Button type="button" onClick={() => onNavigate('/act')}>
          Siirry ACT-vaiheeseen
        </Button>
      </section>
    </section>
  )
}

export default CheckPage
