import { useEffect, useMemo, useState } from 'react'
import Button from '../../shared/ui/Button/Button.jsx'
import Card from '../../shared/ui/Card/Card.jsx'
import { calculateRoundForecast } from '../../entities/forecast/model.js'
import { buildCanonicalFinancialHistory, normalizeFinancialHistoryEntry } from '../../entities/factory-settings/financialHistory.js'
import { relativePercentChange } from '../../entities/history/relativeChange.js'
import { loadFiveSDecision } from '../../features/five-s/decisionStore.js'
import { loadProjectsDecision } from '../../features/projects/decisionStore.js'
import { loadInvestmentsDecision } from '../../features/investments/decisionStore.js'
import { loadCheckStaffingDecision, loadCheckProductionDecision } from '../../features/check/decisionStore.js'
import { loadActDecision, saveActDecision } from '../../features/act/decisionStore.js'
import './ActPage.css'

const EURO_FORMATTER = new Intl.NumberFormat('fi-FI', {
  maximumFractionDigits: 0,
})

const DECIMAL_FORMATTER = new Intl.NumberFormat('fi-FI', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

function formatCurrency(value) {
  const rounded = Math.round(Number(value) || 0)
  const sign = rounded < 0 ? '−' : ''
  return `${sign}${EURO_FORMATTER.format(Math.abs(rounded))} €`
}

function formatContainers(value) {
  return `${DECIMAL_FORMATTER.format(Number(value) || 0)} konttia`
}

function formatChange(value) {
  if (value == null || !Number.isFinite(value)) {
    return '—'
  }

  const sign = value > 0 ? '+' : ''
  return `${sign}${DECIMAL_FORMATTER.format(value)} %`
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function toNonNegativeInteger(value, fallback = 0) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return fallback
  }

  return Math.round(numericValue)
}

function getPreviousIncome(gameState, factorySettings) {
  if (!gameState) {
    return null
  }

  const baselineEntries = buildCanonicalFinancialHistory(gameState, factorySettings)
  const entriesByRound = new Map(baselineEntries.map((entry) => [Number(entry.round), entry]))
  for (const entry of gameState.history ?? []) {
    entriesByRound.set(Number(entry.round), entry)
  }

  const previousEntry = entriesByRound.get(Number(gameState.round) - 1)
  return previousEntry ? normalizeFinancialHistoryEntry(previousEntry).incomeStatement : null
}

function createInitialActState(gameState, factorySettings) {
  if (!gameState) {
    return {
      decisionGameState: null,
      price: 25000,
      productionQuantity: 0,
      addedVariations: 0,
      useFinishedGoodsInventoryForDeliveries: false,
      batchSize: null,
      previousIncome: null,
    }
  }

  const round = gameState.round
  const fiveSDecision = loadFiveSDecision(round)
  const projectsDecision = loadProjectsDecision(round)
  const investmentsDecision = loadInvestmentsDecision(round)
  const checkStaffingDecision = loadCheckStaffingDecision(round)
  const checkProductionDecision = loadCheckProductionDecision(round)
  const actDecision = loadActDecision(round)

  const decisionGameState = {
    ...gameState,
    fiveSDecision,
    projectsDecision,
    investmentsDecision,
    checkStaffingDecision,
  }
  const price = actDecision?.price ?? gameState.market?.price ?? 25000
  const addedVariations = actDecision?.addedVariations ?? 0
  const batchSize =
    checkProductionDecision?.batchSize ??
    gameState.market?.batchSize ??
    factorySettings?.production?.initialBatchSize ??
    20
  const baseForecast = calculateRoundForecast(
    decisionGameState,
    { market: { price, addedVariations, batchSize } },
    factorySettings,
  )

  return {
    decisionGameState,
    price,
    productionQuantity: clamp(
      actDecision?.productionQuantity ??
        gameState.market?.productionQuantity ??
        Math.min(baseForecast.summary.demand, baseForecast.summary.plantCapacity),
      0,
      baseForecast.summary.plantCapacity,
    ),
    addedVariations: baseForecast.decisions.market.addedVariations,
    useFinishedGoodsInventoryForDeliveries: actDecision?.useFinishedGoodsInventoryForDeliveries ?? false,
    batchSize,
    previousIncome: getPreviousIncome(gameState, factorySettings),
  }
}

function Stepper({ value, minimum, maximum, onChange, label }) {
  return (
    <div className="act-stepper">
      <button
        type="button"
        aria-label={`Vähennä: ${label}`}
        disabled={value <= minimum}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <output aria-live="polite">{value}</output>
      <button
        type="button"
        aria-label={`Lisää: ${label}`}
        disabled={value >= maximum}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  )
}

function ActPage({ gameState, factorySettings, onAdvanceRound, statusMessage: roundStatusMessage }) {
  const [initialActState] = useState(() => createInitialActState(gameState, factorySettings))
  const [decisionGameState] = useState(initialActState.decisionGameState)
  const [price] = useState(initialActState.price)
  const [productionQuantity, setProductionQuantity] = useState(initialActState.productionQuantity)
  const [addedVariations, setAddedVariations] = useState(initialActState.addedVariations)
  const [useFinishedGoodsInventoryForDeliveries, setUseFinishedGoodsInventoryForDeliveries] = useState(
    initialActState.useFinishedGoodsInventoryForDeliveries,
  )
  const [batchSize] = useState(initialActState.batchSize)
  const previousIncome = initialActState.previousIncome

  const forecast = useMemo(() => {
    if (!decisionGameState) {
      return null
    }

    const overrides = {
      market: {
        price,
        addedVariations,
        productionQuantity,
        batchSize,
        useFinishedGoodsInventoryForDeliveries,
      },
    }
    const requestedForecast = calculateRoundForecast(decisionGameState, overrides, factorySettings)
    const clampedQuantity = Math.min(productionQuantity, requestedForecast.summary.plantCapacity)

    return clampedQuantity === productionQuantity
      ? requestedForecast
      : calculateRoundForecast(decisionGameState, {
          ...overrides,
          market: { ...overrides.market, productionQuantity: clampedQuantity },
        }, factorySettings)
  }, [
    addedVariations,
    decisionGameState,
    factorySettings,
    price,
    productionQuantity,
    batchSize,
    useFinishedGoodsInventoryForDeliveries,
  ])

  const effectiveProductionQuantity = forecast
    ? Math.min(productionQuantity, forecast.summary.plantCapacity)
    : productionQuantity

  useEffect(() => {
    if (!forecast || productionQuantity <= forecast.summary.plantCapacity || !decisionGameState) {
      return
    }

    saveActDecision({
      round: decisionGameState.round,
      price,
      productionQuantity: forecast.summary.plantCapacity,
      addedVariations,
      useFinishedGoodsInventoryForDeliveries,
      savedAt: new Date().toISOString(),
    })
  }, [addedVariations, decisionGameState, forecast, price, productionQuantity, useFinishedGoodsInventoryForDeliveries])

  const updateAndPersist = (nextValues) => {
    if (!decisionGameState) {
      return
    }

    saveActDecision({
      round: decisionGameState.round,
      price: nextValues.price,
      productionQuantity: nextValues.productionQuantity,
      addedVariations: nextValues.addedVariations,
      useFinishedGoodsInventoryForDeliveries: nextValues.useFinishedGoodsInventoryForDeliveries,
      savedAt: new Date().toISOString(),
    })
  }

  const handleProductionQuantityChange = (rawValue) => {
    const maxCapacity = forecast ? forecast.summary.plantCapacity : 0
    const nextQuantity = clamp(toNonNegativeInteger(rawValue, productionQuantity), 0, maxCapacity)

    setProductionQuantity(nextQuantity)
    updateAndPersist({
      price,
      productionQuantity: nextQuantity,
      addedVariations,
      useFinishedGoodsInventoryForDeliveries,
    })
  }

  const handleAddedVariationsChange = (rawValue) => {
    const requested = toNonNegativeInteger(rawValue, addedVariations)
    const maxAllowed = forecast ? forecast.decisions.market.allowedNewVariations : 0
    const nextAddedVariations = clamp(requested, 0, maxAllowed)

    setAddedVariations(nextAddedVariations)
    updateAndPersist({
      price,
      productionQuantity: effectiveProductionQuantity,
      addedVariations: nextAddedVariations,
      useFinishedGoodsInventoryForDeliveries,
    })
  }

  const handleUseFinishedGoodsInventoryForDeliveriesChange = (nextValue) => {
    setUseFinishedGoodsInventoryForDeliveries(nextValue)
    updateAndPersist({
      price,
      productionQuantity: effectiveProductionQuantity,
      addedVariations,
      useFinishedGoodsInventoryForDeliveries: nextValue,
    })
  }

  const handleApprove = () => {
    if (!decisionGameState || !forecast) {
      return
    }

    const approvedForecast = calculateRoundForecast(
      decisionGameState,
      {
        market: {
          price,
          addedVariations,
          productionQuantity: effectiveProductionQuantity,
          batchSize,
          useFinishedGoodsInventoryForDeliveries,
        },
      },
      factorySettings,
    )

    saveActDecision({
      round: decisionGameState.round,
      price,
      productionQuantity: approvedForecast.summary.productionQuantity,
      addedVariations: approvedForecast.decisions.market.addedVariations,
      useFinishedGoodsInventoryForDeliveries,
      savedAt: new Date().toISOString(),
    })

    onAdvanceRound(approvedForecast)
  }

  if (!forecast) {
    return (
      <section className="act-page" aria-label="ACT-vaiheen päätösnäkymä">
        <h1>ACT – Päätä ja vahvista</h1>
        <p>Ladataan ACT-näkymää...</p>
      </section>
    )
  }

  const qualityPct = forecast.forecast.knl.totalQualityAverage
  const allowedNewVariations = forecast.decisions.market.allowedNewVariations
  const revenueChange = relativePercentChange(forecast.forecast.finance.revenue, previousIncome?.revenue)
  const resultChange = relativePercentChange(forecast.forecast.finance.result, previousIncome?.result)
  const productionMaximum = forecast.summary.plantCapacity
  const variationMinimum = 0

  return (
    <section className="act-page" aria-label="ACT-vaiheen päätösnäkymä">
      <header className="act-header">
        <h1>ACT – Päätä ja vahvista</h1>
      </header>

      <div className="act-primary-grid">
        <Card>
          <article className="act-card">
            <h2>Tuotantopäätös</h2>
            <dl className="act-metrics">
              <div><dt>Kysyntä</dt><dd>{formatContainers(forecast.summary.demand)}</dd></div>
              <div><dt>Kapasiteetti</dt><dd>{formatContainers(forecast.summary.plantCapacity)}</dd></div>
              <div><dt>Varastosta käytettävissä</dt><dd>{formatContainers(forecast.summary.sellableOpeningFinishedGoodsInventory)}</dd></div>
            </dl>

            <div className="act-decision-control">
              <div className="act-control-heading">
                <label htmlFor="act-production-quantity">Tuotantomäärä</label>
                <Stepper
                  value={effectiveProductionQuantity}
                  minimum={0}
                  maximum={productionMaximum}
                  onChange={handleProductionQuantityChange}
                  label="tuotantomäärä"
                />
              </div>
              <input
                id="act-production-quantity"
                aria-label="Tuotantomäärä"
                type="range"
                min="0"
                max={productionMaximum}
                step="1"
                value={effectiveProductionQuantity}
                onChange={(event) => handleProductionQuantityChange(event.target.value)}
              />
            </div>

            <label className="act-checkbox">
              <input
                type="checkbox"
                checked={useFinishedGoodsInventoryForDeliveries}
                disabled={forecast.summary.sellableOpeningFinishedGoodsInventory <= 0}
                onChange={(event) => handleUseFinishedGoodsInventoryForDeliveriesChange(event.target.checked)}
              />
              <span>Täydennä toimitukset valmistuotevarastosta</span>
            </label>
            <div className="act-metric-highlight">
              <span>Toimitukset yhteensä</span>
              <strong>{formatContainers(forecast.summary.deliveries)}</strong>
            </div>
          </article>
        </Card>

        <Card>
          <article className="act-card">
            <h2>Uudet asiakkuudet</h2>
            <p className="act-quality">Tuotannon laatuprosentti: <strong>{DECIMAL_FORMATTER.format(qualityPct)} %</strong></p>
            {allowedNewVariations === 0 ? (
              <p className="act-quality-message">Laatu ei riitä uusien asiakkaiden vaatimuksiin.</p>
            ) : (
              <>
                <p className="act-quality-message">
                  {allowedNewVariations === 1
                    ? 'Laatuasi pidetään markkinoilla hyvänä. 1 uusi asiakas on kiinnostunut tuotteistasi.'
                    : 'Laatuasi pidetään markkinoilla erinomaisena. 2 uutta asiakasta on kiinnostunut tuotteistasi.'}
                </p>
                <div className="act-decision-control">
                  <div className="act-control-heading">
                    <label htmlFor="act-new-customers">Uudet asiakkuudet</label>
                    <Stepper
                      value={addedVariations}
                      minimum={variationMinimum}
                      maximum={allowedNewVariations}
                      onChange={handleAddedVariationsChange}
                      label="uudet asiakkuudet"
                    />
                  </div>
                  <input
                    id="act-new-customers"
                    aria-label="Uudet asiakkuudet"
                    type="range"
                    min={variationMinimum}
                    max={allowedNewVariations}
                    step="1"
                    value={addedVariations}
                    onChange={(event) => handleAddedVariationsChange(event.target.value)}
                  />
                </div>
                <div className="act-metric-highlight">
                  <span>Tuotevariaatiot yhteensä</span>
                  <strong>{forecast.decisions.market.totalVariations}</strong>
                </div>
              </>
            )}
          </article>
        </Card>

        <Card>
          <article className="act-card">
            <h2>Päätösten vaikutukset</h2>
            <dl className="act-impact-list">
              <div>
                <dt>Liikevaihtoennuste</dt>
                <dd>{formatCurrency(forecast.forecast.finance.revenue)}</dd>
              </div>
              <div>
                <dt>Liikevaihdon muutos edelliseen kierrokseen</dt>
                <dd className={revenueChange == null ? '' : revenueChange > 0 ? 'is-positive' : revenueChange < 0 ? 'is-negative' : ''}>
                  {formatChange(revenueChange)}
                </dd>
              </div>
              <div>
                <dt>Tulosennuste</dt>
                <dd>{formatCurrency(forecast.forecast.finance.result)}</dd>
              </div>
              {previousIncome?.result !== 0 ? (
                <div>
                  <dt>Tuloksen muutos edelliseen kierrokseen</dt>
                  <dd className={resultChange == null ? '' : resultChange > 0 ? 'is-positive' : resultChange < 0 ? 'is-negative' : ''}>
                    {formatChange(resultChange)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </article>
        </Card>
      </div>

      <section className="act-actions" aria-label="ACT-vaiheen navigointi">
        <Button type="button" onClick={handleApprove}>
          HYVÄKSY PÄÄTÖKSET JA SIIRRY SEURAAVALLE KIERROKSELLE →
        </Button>
      </section>

      {roundStatusMessage ? <p className="act-status">{roundStatusMessage}</p> : null}
    </section>
  )
}

export default ActPage
