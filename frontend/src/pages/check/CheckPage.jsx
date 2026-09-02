import { useEffect, useMemo, useState } from 'react'
import Button from '../../shared/ui/Button/Button.jsx'
import Card from '../../shared/ui/Card/Card.jsx'
import { calculateRoundForecast } from '../../entities/forecast/model.js'
import { loadFiveSDecision } from '../../features/five-s/decisionStore.js'
import { loadProjectsDecision } from '../../features/projects/decisionStore.js'
import { loadInvestmentsDecision } from '../../features/investments/decisionStore.js'
import {
  loadCheckStaffingDecision,
  saveCheckStaffingDecision,
} from '../../features/check/decisionStore.js'
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

  useEffect(() => {
    if (!gameState) {
      return
    }

    const round = gameState.round
    const fiveSDecision = loadFiveSDecision(round)
    const projectsDecision = loadProjectsDecision(round)
    const investmentsDecision = loadInvestmentsDecision(round)
    const checkStaffingDecision = loadCheckStaffingDecision(round)

    const defaultStaffing = {
      assembly: gameState.staffing?.assembly ?? 0,
      shipping: gameState.staffing?.shipping ?? 0,
    }

    setStaffing(checkStaffingDecision?.staffing || defaultStaffing)
    setDecisionGameState({
      ...gameState,
      fiveSDecision,
      projectsDecision,
      investmentsDecision,
      checkStaffingDecision,
    })
  }, [gameState])

  const forecast = useMemo(() => {
    if (!decisionGameState) {
      return null
    }

    return calculateRoundForecast(decisionGameState, {
      staffing,
    }, factorySettings)
  }, [decisionGameState, factorySettings, staffing])

  const updateStaffing = (key, delta) => {
    setStaffing((previousValue) => ({
      ...previousValue,
      [key]: Math.max(0, (Number(previousValue[key]) || 0) + delta),
    }))
  }

  const handleSaveStaffing = () => {
    if (!forecast || !decisionGameState) {
      return
    }

    const decision = {
      round: decisionGameState.round,
      staffing,
      savedAt: new Date().toISOString(),
    }

    saveCheckStaffingDecision(decision)
    setStatusMessage('Henkilöstöpäätös tallennettu CHECK-vaiheeseen.')
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
                  <th>Ennuste</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((department) => {
                  const isBottleneck = forecast.summary.bottleneckKey === department.key
                  return (
                    <tr key={department.key} className={isBottleneck ? 'is-bottleneck' : ''}>
                      <td>{department.label}</td>
                      <td>{formatContainers(forecast.current.capacityByDepartment[department.key])}</td>
                      <td>{formatContainers(forecast.forecast.capacityByDepartment[department.key])}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p>
              Pullonkaula: <strong>{forecast.summary.bottleneckLabel}</strong>
            </p>
          </article>
        </Card>

        <Card>
          <article className="check-section">
            <h2>5. Henkilosto seuraavalle kierrokselle</h2>
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
            <h2>6. Varasto ja tila</h2>
            <p>Tuotantoajot / variaatio: {forecast.forecast.market.runsPerVariation}</p>
            <p>Erakoko: {formatContainers(forecast.forecast.batchSize)}</p>
            <p>Vaihtojen maara: {forecast.forecast.switches}</p>
            <p>
              Keskimääräinen valmistuotevarasto: {formatContainers(forecast.forecast.inventory.averageFinishedGoodsInventory)}
            </p>
            <p>Varaston arvo: {formatCurrency(forecast.forecast.inventory.finishedGoodsValue)}</p>
            <p>Varaston tilantarve: {Math.round(forecast.forecast.inventory.finishedGoodsArea)} m2</p>
            <p>Vapaa tehdastila: {Math.round(forecast.forecast.space.freeFactorySpace)} m2</p>
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
