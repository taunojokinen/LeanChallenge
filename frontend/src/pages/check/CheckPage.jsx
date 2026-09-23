import { useEffect, useMemo, useState } from 'react'
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

function formatCurrency(value) {
  const rounded = Math.round(Number(value) || 0)
  const sign = rounded < 0 ? '-' : ''
  return `${sign}${EURO_FORMATTER.format(Math.abs(rounded))} €`
}

function formatContainers(value) {
  return `${DECIMAL_FORMATTER.format(Number(value) || 0)} konttia`
}

function formatPercent(value) {
  return `${DECIMAL_FORMATTER.format(Number(value) || 0)} %`
}

function formatKnl(ratio) {
  return `${DECIMAL_FORMATTER.format((Number(ratio) || 0) * 100)} %`
}

function formatTransition(currentValue, nextValue, formatValue) {
  return `${formatValue(currentValue)} -> ${formatValue(nextValue)}`
}

function toNonNegativeInteger(value, fallback = 0) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return fallback
  }

  return Math.round(numericValue)
}

function DecisionList({ items, emptyLabel }) {
  if (items.length === 0) {
    return <p>{emptyLabel}</p>
  }

  return (
    <ul className="check-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

function CheckPage({ onNavigate, gameState, factorySettings }) {
  const [decisionGameState, setDecisionGameState] = useState(null)
  const [staffing, setStaffing] = useState({ assembly: 0, shipping: 0 })
  const [statusMessage, setStatusMessage] = useState('')
  const [batchSize, setBatchSize] = useState(20)
  const [productionStatusMessage, setProductionStatusMessage] = useState('')

  useEffect(() => {
    if (!gameState) {
      return
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

    setStaffing(nextStaffing)
    setBatchSize(initialBatchSize)
    setDecisionGameState(nextGameState)
  }, [factorySettings, gameState])

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

  // Auto-persist every edit to the existing round-scoped decision stores so values entered
  // during this round survive page navigation (component unmount/remount) without requiring an
  // explicit save click; the Save buttons remain only to give the player an explicit confirmation.
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

  const updateStaffing = (key, delta) => {
    const nextStaffing = {
      ...staffing,
      [key]: Math.max(0, (Number(staffing[key]) || 0) + delta),
    }

    setStaffing(nextStaffing)
    persistStaffing(nextStaffing)
  }

  const handleSaveStaffing = () => {
    if (!forecast || !decisionGameState) {
      return
    }

    persistStaffing(staffing)
    setStatusMessage('Henkilöstöpäätös tallennettu CHECK-vaiheeseen.')
  }

  const handleBatchSizeChange = (rawValue) => {
    const minBatchSize = factorySettings?.production?.minBatchSize ?? 1
    const maxBatchSize = factorySettings?.production?.maxBatchSize ?? 20
    const requestedValue = toNonNegativeInteger(rawValue, batchSize)
    const nextBatchSize = Math.min(maxBatchSize, Math.max(minBatchSize, requestedValue))

    setBatchSize(nextBatchSize)
    persistBatchSizeDecision(nextBatchSize)
  }

  const handleSaveNextRoundDecision = () => {
    if (!decisionGameState) {
      return
    }

    saveCheckProductionDecision({
      round: decisionGameState.round,
      batchSize,
      savedAt: new Date().toISOString(),
    })
    setProductionStatusMessage(`Eräkokopäätös tallennettu kierrokselle ${resolveCheckRoundLabels(decisionGameState.round).planningRound}.`)
  }

  if (!forecast) {
    return (
      <section className="check-page" aria-label="CHECK-vaiheen vaikutusarvio latautuu">
        <h1>CHECK - Vaikutusarvio</h1>
        <p>Ladataan ennustetta...</p>
      </section>
    )
  }

  const projectsDecisionItems = forecast.decisions.projects.map((selection) => {
    const hours = Number(selection.investedHours) || 0
    return `${selection.department} / ${selection.method}: ${hours} h`
  })

  const investmentDecisionItems = forecast.decisions.investments.map((item) => {
    const quantity = item.quantity > 1 ? ` x${item.quantity}` : ''
    return `${item.type}${quantity}`
  })
  const previewInventory = previewForecast?.forecast.inventory
  const previewSummary = previewForecast?.summary
  const { confirmedRound, planningRound } = resolveCheckRoundLabels(decisionGameState.round)

  const departments = [
    { key: 'machining', label: 'Koneistus' },
    { key: 'assembly', label: 'Koonta' },
    { key: 'shipping', label: 'Lahettamo' },
  ]

  return (
    <section className="check-page" aria-label="CHECK-vaiheen vaikutusarvio">
      <header className="check-header">
        <h1>CHECK - Vaikutusarvio</h1>
        <p>Arvioi DO-vaiheen vaikutukset ennen ACT-vaiheen hyvaksyntaa.</p>
      </header>

      <div className="check-grid">
        <Card>
          <article className="check-section">
            <h2>1. DO-vaiheen paatokset</h2>
            <p>
              5S-tunnit: Koneistus {forecast.decisions.fiveS.machining} h, Koonta{' '}
              {forecast.decisions.fiveS.assembly} h, Lahettamo {forecast.decisions.fiveS.shipping} h
            </p>
            <DecisionList items={projectsDecisionItems} emptyLabel="Projektipaato ksia ei ole tallennettu." />
            <DecisionList items={investmentDecisionItems} emptyLabel="Investointipaatoksia ei ole tallennettu." />
            <p>Tuotantoajot / variaatio: {forecast.decisions.market.runsPerVariation}</p>
            <p>Hinta: {formatCurrency(forecast.decisions.market.price)} / kontti</p>
            <p>
              Uudet variaatiot: {forecast.decisions.market.selectedNewVariations} / max{' '}
              {forecast.decisions.market.allowedNewVariations}
            </p>
            <p>Aktiiviset variaatiot: {forecast.decisions.market.activeVariationCount}</p>
          </article>
        </Card>

        <Card>
          <article className="check-section">
            <h2>2. Koko tehtaan yhteenveto</h2>
            <p>KNL: {formatKnl(forecast.current.knl.machining.knl)} -&gt; {formatKnl(forecast.forecast.knl.machining.knl)}</p>
            <p>Kysynta: {formatContainers(forecast.summary.demand)}</p>
            <p>Kapasiteetti: {formatContainers(forecast.summary.plantCapacity)}</p>
            <p>Toteutunut valmistus: {formatContainers(forecast.summary.actualProduction)}</p>
            <p>Toimitukset: {formatContainers(forecast.summary.deliveries)}</p>
            <p>Menetetty myynti: {formatContainers(forecast.summary.lostSalesUnits)}</p>
            <p>Liikevaihto: {formatCurrency(forecast.summary.revenue)}</p>
            <p>Tulos: {formatCurrency(forecast.summary.result)}</p>
            <p>Valmistuotevarasto: {formatContainers(forecast.summary.finishedGoodsInventory)}</p>
            <p>Vapaa tehdastila: {Math.round(forecast.summary.freeFactorySpace)} m2</p>
          </article>
        </Card>

        <Card>
          <article className="check-section">
            <h2>3. K/N/L/KNL osastoittain</h2>
            <table className="check-table">
              <thead>
                <tr>
                  <th>Osasto</th>
                  <th>K</th>
                  <th>N</th>
                  <th>L</th>
                  <th>KNL</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((department) => {
                  const currentMetrics = forecast.current.knl[department.key]
                  const forecastMetrics = forecast.forecast.knl[department.key]
                  return (
                    <tr key={department.key}>
                      <td>{department.label}</td>
                      <td>{formatTransition(currentMetrics.kPct, forecastMetrics.kPct, formatPercent)}</td>
                      <td>{formatTransition(currentMetrics.nPct, forecastMetrics.nPct, formatPercent)}</td>
                      <td>{formatTransition(currentMetrics.lPct, forecastMetrics.lPct, formatPercent)}</td>
                      <td>{formatTransition(currentMetrics.knl, forecastMetrics.knl, formatKnl)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </article>
        </Card>

        <Card>
          <article className="check-section">
            <h2>4. Kapasiteetti osastoittain</h2>
            <table className="check-table">
              <thead>
                <tr>
                  <th>Osasto</th>
                  <th>Nykytila</th>
                  <th>Ennuste (kierros {planningRound})</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((department) => {
                  const highlightedBottleneckKey = previewForecast?.summary?.bottleneckKey ?? forecast.summary.bottleneckKey
                  const isBottleneck = highlightedBottleneckKey === department.key
                  return (
                    <tr key={department.key} className={isBottleneck ? 'is-bottleneck' : ''}>
                      <td>{department.label}</td>
                      <td>{formatContainers(forecast.forecast.capacityByDepartment[department.key])}</td>
                      <td>
                        {previewForecast
                          ? formatContainers(previewForecast.forecast.capacityByDepartment[department.key])
                          : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p>
              Pullonkaula (kierros {confirmedRound}): <strong>{forecast.summary.bottleneckLabel}</strong>
            </p>
            {previewForecast ? (
              <p>
                Pullonkaula-ennuste (kierros {planningRound}):{' '}
                <strong>{previewForecast.summary.bottleneckLabel}</strong>
              </p>
            ) : null}
          </article>
        </Card>

        <Card>
          <article className="check-section">
            <h2>5. Henkilosto tälle kierrokselle</h2>
            <div className="check-staffing-row">
              <span>Koneistus (read-only)</span>
              <strong>{forecast.forecast.staffing.machining}</strong>
            </div>
            <div className="check-staffing-row">
              <span>Koonta</span>
              <div className="check-staffing-controls">
                <Button type="button" onClick={() => updateStaffing('assembly', -1)}>
                  -
                </Button>
                <strong>{staffing.assembly}</strong>
                <Button type="button" onClick={() => updateStaffing('assembly', 1)}>
                  +
                </Button>
              </div>
            </div>
            <div className="check-staffing-row">
              <span>Lahettamo</span>
              <div className="check-staffing-controls">
                <Button type="button" onClick={() => updateStaffing('shipping', -1)}>
                  -
                </Button>
                <strong>{staffing.shipping}</strong>
                <Button type="button" onClick={() => updateStaffing('shipping', 1)}>
                  +
                </Button>
              </div>
            </div>
            <Button type="button" onClick={handleSaveStaffing}>
              TALLENNA HENKILOSTO
            </Button>
            {statusMessage ? <p className="check-status">{statusMessage}</p> : null}
          </article>
        </Card>

        <Card>
          <article className="check-section">
            <h2>6. Varasto ja tila: nykytila vs. ennuste</h2>
            <table className="check-table">
              <thead>
                <tr>
                  <th>Mittari</th>
                  <th>Nykytila (kierros {confirmedRound})</th>
                  <th>Ennuste (kierros {planningRound})</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Erakoko</td>
                  <td>{formatContainers(forecast.decisions.market.batchSize)}</td>
                  <td>{previewForecast ? formatContainers(previewForecast.decisions.market.batchSize) : '-'}</td>
                </tr>
                <tr>
                  <td>Vaihtojen maara</td>
                  <td>{forecast.forecast.knl.machining.totalChangeovers}</td>
                  <td>{previewForecast ? previewForecast.forecast.knl.machining.totalChangeovers : '-'}</td>
                </tr>
                <tr>
                  <td>Fyysinen valmistuotevarasto</td>
                  <td>{formatContainers(forecast.forecast.inventory.closingFinishedGoodsInventory)}</td>
                  <td>
                    {previewForecast
                      ? formatContainers(previewForecast.forecast.inventory.closingFinishedGoodsInventory)
                      : '-'}
                  </td>
                </tr>
                <tr>
                  <td>Minimivarasto</td>
                  <td>{formatContainers(forecast.forecast.inventory.minimumFinishedGoodsInventory)}</td>
                  <td>
                    {previewForecast
                      ? formatContainers(previewForecast.forecast.inventory.minimumFinishedGoodsInventory)
                      : '-'}
                  </td>
                </tr>
                <tr>
                  <td>Myytavissa varastosta (valitulla eraikoolla)</td>
                  <td>{formatContainers(forecast.forecast.inventory.sellableOpeningFinishedGoodsInventory)}</td>
                  <td>
                    {previewForecast
                      ? formatContainers(previewForecast.forecast.inventory.sellableOpeningFinishedGoodsInventory)
                      : '-'}
                  </td>
                </tr>
                <tr>
                  <td>Varaston arvo</td>
                  <td>{formatCurrency(forecast.forecast.inventory.finishedGoodsValue)}</td>
                  <td>
                    {previewForecast ? formatCurrency(previewForecast.forecast.inventory.finishedGoodsValue) : '-'}
                  </td>
                </tr>
                <tr>
                  <td>Varaston tilantarve</td>
                  <td>{Math.round(forecast.forecast.inventory.finishedGoodsArea)} m2</td>
                  <td>{previewForecast ? `${Math.round(previewForecast.forecast.inventory.finishedGoodsArea)} m2` : '-'}</td>
                </tr>
                <tr>
                  <td>Vapaa tehdastila</td>
                  <td>{Math.round(forecast.forecast.space.freeFactorySpace)} m2</td>
                  <td>{previewForecast ? `${Math.round(previewForecast.forecast.space.freeFactorySpace)} m2` : '-'}</td>
                </tr>
              </tbody>
            </table>
          </article>
        </Card>

        <Card>
          <article className="check-section">
            <h2>7. Talousennuste</h2>
            <p>Liikevaihto: {formatCurrency(forecast.forecast.finance.revenue)}</p>
            <p>Raaka-aineet: {formatCurrency(forecast.forecast.finance.materials)}</p>
            <p>Henkilostokustannus: {formatCurrency(forecast.forecast.finance.labor)}</p>
            <p>Kiinteat kustannukset: {formatCurrency(forecast.forecast.finance.fixedCosts)}</p>
            <p>Varaston muutos: {formatCurrency(forecast.forecast.finance.inventoryChange)}</p>
            <p>Poistot: {formatCurrency(forecast.forecast.finance.depreciation)}</p>
            <p>Korot: {formatCurrency(forecast.forecast.finance.interest)}</p>
            <p>
              <strong>Tulos: {formatCurrency(forecast.forecast.finance.result)}</strong>
            </p>
          </article>
        </Card>

        <Card>
          <article className="check-section">
            <h2>8. Miksi nain?</h2>
            <ul className="check-list">
              {forecast.insights.map((insight) => (
                <li key={insight}>{insight}</li>
              ))}
            </ul>
          </article>
        </Card>

        <Card>
          <article className="check-section">
            <h2>9. Eräkokopäätös</h2>
            <p>Max. kapasiteetti: {previewSummary ? formatContainers(previewSummary.plantCapacity) : '-'}</p>
            <p>Rajoittava osasto: {previewSummary?.bottleneckLabel ?? '-'}</p>
            <p>
              Nykyinen erakoko (kierros {confirmedRound}):{' '}
              {formatContainers(forecast.decisions.market.batchSize)}
            </p>
            <label className="check-input-row">
              <span>
                Eräkoko suunniteltavalle kierrokselle (kierros {planningRound}, {' '}
                {factorySettings?.production?.minBatchSize ?? 1}-{factorySettings?.production?.maxBatchSize ?? 20})
              </span>
              <input
                type="number"
                min={factorySettings?.production?.minBatchSize ?? 1}
                max={factorySettings?.production?.maxBatchSize ?? 20}
                step="1"
                value={batchSize}
                onChange={(event) => handleBatchSizeChange(event.target.value)}
              />
            </label>
            <p>
              Minimivarasto (valitulla eräkoolla):{' '}
              {previewInventory ? formatContainers(previewInventory.minimumFinishedGoodsInventory) : '-'}
            </p>
            <p>Fyysinen valmisvarasto: {formatContainers(forecast.forecast.inventory.openingFinishedGoodsInventory)}</p>
            <Button type="button" onClick={handleSaveNextRoundDecision}>
              TALLENNÄ ERÄKOKOPÄÄTÖS
            </Button>
            {productionStatusMessage ? <p className="check-status">{productionStatusMessage}</p> : null}
          </article>
        </Card>
      </div>

      <section className="check-actions" aria-label="CHECK-vaiheen navigointi">
        <Button type="button" onClick={() => onNavigate('/do/5s')}>
          TAKAISIN DO:HON
        </Button>
        <Button type="button" onClick={() => onNavigate('/act')}>
          SIIRRY ACT-VAIHEESEEN
        </Button>
      </section>
    </section>
  )
}

export default CheckPage
