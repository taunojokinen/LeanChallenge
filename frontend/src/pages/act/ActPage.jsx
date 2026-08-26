import { useEffect, useMemo, useState } from 'react'
import Button from '../../shared/ui/Button/Button.jsx'
import Card from '../../shared/ui/Card/Card.jsx'
import { calculateRoundForecast } from '../../entities/forecast/model.js'
import { getFiveSSnapshot } from '../../shared/api/fiveSApi.js'
import { getProjectsSnapshot } from '../../shared/api/projectsApi.js'
import { getInvestmentsSnapshot } from '../../shared/api/investmentsApi.js'
import { getBalanceSheetSnapshot } from '../../shared/api/balanceSheetApi.js'
import { getProductionSnapshot } from '../../shared/api/productionApi.js'
import { loadFiveSDecision } from '../../features/five-s/decisionStore.js'
import { loadProjectsDecision } from '../../features/projects/decisionStore.js'
import { loadInvestmentsDecision } from '../../features/investments/decisionStore.js'
import { loadCheckStaffingDecision } from '../../features/check/decisionStore.js'
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
  const sign = rounded < 0 ? '-' : ''
  return `${sign}${EURO_FORMATTER.format(Math.abs(rounded))} €`
}

function formatContainers(value) {
  return `${DECIMAL_FORMATTER.format(Number(value) || 0)} konttia`
}

function formatKnl(ratio) {
  return `${DECIMAL_FORMATTER.format((Number(ratio) || 0) * 100)} %`
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

function ActPage({ onNavigate }) {
  const [gameState, setGameState] = useState(null)
  const [price, setPrice] = useState(25000)
  const [productionQuantity, setProductionQuantity] = useState(0)
  const [addedVariations, setAddedVariations] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      const [
        fiveSSnapshot,
        projectsSnapshot,
        investmentsSnapshot,
        balanceSheetSnapshot,
        productionSnapshot,
      ] = await Promise.all([
        getFiveSSnapshot(),
        getProjectsSnapshot(),
        getInvestmentsSnapshot(),
        getBalanceSheetSnapshot(),
        getProductionSnapshot(),
      ])

      if (!isMounted) {
        return
      }

      const round = investmentsSnapshot.round
      const fiveSDecision = loadFiveSDecision(round)
      const projectsDecision = loadProjectsDecision(round)
      const investmentsDecision = loadInvestmentsDecision(round)
      const checkStaffingDecision = loadCheckStaffingDecision(round)
      const actDecision = loadActDecision(round)

      const nextGameState = {
        round,
        fiveSSnapshot,
        projectsSnapshot,
        investmentsSnapshot,
        balanceSheetSnapshot,
        productionSnapshot,
        fiveSDecision,
        projectsDecision,
        investmentsDecision,
        checkStaffingDecision,
      }

      const initialPrice = actDecision?.price ?? 25000
      const initialAddedVariations = actDecision?.addedVariations ?? 0
      const baseForecast = calculateRoundForecast(nextGameState, {
        market: {
          price: initialPrice,
          addedVariations: initialAddedVariations,
        },
      })

      const initialProductionQuantity =
        actDecision?.productionQuantity ?? Math.min(baseForecast.summary.demand, baseForecast.summary.plantCapacity)

      setPrice(initialPrice)
      setAddedVariations(initialAddedVariations)
      setProductionQuantity(initialProductionQuantity)
      setGameState(nextGameState)
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [])

  const forecast = useMemo(() => {
    if (!gameState) {
      return null
    }

    return calculateRoundForecast(gameState, {
      market: {
        price,
        addedVariations,
        productionQuantity,
      },
    })
  }, [addedVariations, gameState, price, productionQuantity])

  useEffect(() => {
    if (!forecast) {
      return
    }

    if (productionQuantity > forecast.summary.plantCapacity) {
      const clampedQuantity = forecast.summary.plantCapacity
      setProductionQuantity(clampedQuantity)

      if (gameState) {
        saveActDecision({
          round: gameState.round,
          price,
          productionQuantity: clampedQuantity,
          addedVariations,
          savedAt: new Date().toISOString(),
        })
      }
    }
  }, [addedVariations, forecast, gameState, price, productionQuantity])

  const updateAndPersist = (nextValues) => {
    if (!gameState) {
      return
    }

    saveActDecision({
      round: gameState.round,
      price: nextValues.price,
      productionQuantity: nextValues.productionQuantity,
      addedVariations: nextValues.addedVariations,
      savedAt: new Date().toISOString(),
    })
  }

  const handlePriceChange = (rawValue) => {
    const nextPrice = Math.max(1, toNonNegativeInteger(rawValue, price))
    setPrice(nextPrice)
    updateAndPersist({
      price: nextPrice,
      productionQuantity,
      addedVariations,
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
    })
  }

  const handleAddedVariationsChange = (rawValue) => {
    const requested = toNonNegativeInteger(rawValue, addedVariations)
    const maxAllowed = forecast ? forecast.decisions.market.allowedNewVariations : 0
    const nextAddedVariations = clamp(requested, 0, maxAllowed)

    setAddedVariations(nextAddedVariations)
    updateAndPersist({
      price,
      productionQuantity,
      addedVariations: nextAddedVariations,
    })
  }

  const handleApprove = () => {
    if (!gameState || !forecast) {
      return
    }

    const approvedForecast = calculateRoundForecast(gameState, {
      market: {
        price,
        addedVariations,
        productionQuantity,
      },
    })

    saveActDecision({
      round: gameState.round,
      price,
      productionQuantity: approvedForecast.summary.productionQuantity,
      addedVariations: approvedForecast.decisions.market.addedVariations,
      savedAt: new Date().toISOString(),
    })

    setStatusMessage(
      'Päätökset tallennettu. Kierrossiirtymä ei ole vielä käytössä tässä prototyyppiversiossa.',
    )
  }

  if (!forecast) {
    return (
      <section className="act-page" aria-label="ACT-vaiheen päätöksenteko latautuu">
        <h1>ACT - Päätä ja vahvista</h1>
        <p>Ladataan ACT-näkymää...</p>
      </section>
    )
  }

  const overallKnl =
    (forecast.forecast.knl.machining.knl +
      forecast.forecast.knl.assembly.knl +
      forecast.forecast.knl.shipping.knl) /
    3

  return (
    <section className="act-page" aria-label="ACT-vaiheen päätösnäkymä">
      <header className="act-header">
        <h1>ACT - Päätä ja vahvista</h1>
        <p>
          Sovita tuotantomäärä ja markkinapäätökset tehtaan kapasiteettiin. Hyväksy lopuksi
          seuraavan kierroksen suunnitelma.
        </p>
      </header>

      <Card>
        <article className="act-section">
          <h2>CHECK-yhteenveto</h2>
          <p>Tehtaan ennustettu kapasiteetti: {formatContainers(forecast.summary.plantCapacity)}</p>
          <p>Pullonkaula: {forecast.summary.bottleneckLabel}</p>
          <p>Koonta-henkilöstö: {forecast.forecast.staffing.assembly}</p>
          <p>Lähettämö-henkilöstö: {forecast.forecast.staffing.shipping}</p>
          <p>KNL: {formatKnl(overallKnl)}</p>
          <p>Vapaa tehdastila: {Math.round(forecast.summary.freeFactorySpace)} m2</p>
        </article>
      </Card>

      <div className="act-grid">
        <Card>
          <article className="act-section">
            <h2>1. Myyntihinta</h2>
            <label className="act-input-row">
              <span>Hinta (€/kontti)</span>
              <input
                type="number"
                min="1"
                step="100"
                value={price}
                onChange={(event) => handlePriceChange(event.target.value)}
              />
            </label>
            <p>Ennustettu kysyntä: {formatContainers(forecast.summary.demand)}</p>
            <p>Ennustettu liikevaihto: {formatCurrency(forecast.summary.revenue)}</p>
            <p>Ennustettu tulos: {formatCurrency(forecast.summary.result)}</p>
          </article>
        </Card>

        <Card>
          <article className="act-section">
            <h2>2. Kysyntä vs. kapasiteetti</h2>
            <p>Kysyntä: {formatContainers(forecast.summary.demand)}</p>
            <p>Valmistuskapasiteetti: {formatContainers(forecast.summary.plantCapacity)}</p>
            <p>Suunniteltu tuotantomäärä: {formatContainers(forecast.summary.productionQuantity)}</p>
            <p>Käyttämätön kapasiteetti: {formatContainers(forecast.summary.unusedCapacity)}</p>
            <p>Kysyntävaje: {formatContainers(forecast.summary.lostSalesUnits)}</p>
          </article>
        </Card>

        <Card>
          <article className="act-section">
            <h2>3. Tuotevariaatiot</h2>
            <p>Aktiiviset variaatiot: {forecast.decisions.market.activeVariationCount}</p>
            <label className="act-input-row">
              <span>Uudet variaatiot (max {forecast.decisions.market.allowedNewVariations})</span>
              <input
                type="number"
                min="0"
                max={forecast.decisions.market.allowedNewVariations}
                step="1"
                value={addedVariations}
                onChange={(event) => handleAddedVariationsChange(event.target.value)}
              />
            </label>
            <p>Käytössä olevat variaatiot yhteensä: {forecast.decisions.market.totalVariations}</p>
            <p>Tuotantoajot / variaatio (read-only): {forecast.decisions.market.runsPerVariation}</p>
            <p>Vaihdot: {forecast.forecast.switches}</p>
          </article>
        </Card>

        <Card>
          <article className="act-section">
            <h2>4. Tuotantomäärä</h2>
            <label className="act-input-row">
              <span>Suunniteltu tuotantomäärä (0 - {forecast.summary.plantCapacity})</span>
              <input
                type="number"
                min="0"
                max={forecast.summary.plantCapacity}
                step="1"
                value={productionQuantity}
                onChange={(event) => handleProductionQuantityChange(event.target.value)}
              />
            </label>
            <p>Toteutuva tuotanto: {formatContainers(forecast.summary.actualProduction)}</p>
            <p>Toimitukset: {formatContainers(forecast.summary.deliveries)}</p>
            <p>Menetetty myynti: {formatContainers(forecast.summary.lostSalesUnits)}</p>
          </article>
        </Card>

        <Card>
          <article className="act-section">
            <h2>5. Kannattavuusennuste</h2>
            <p>Liikevaihto: {formatCurrency(forecast.forecast.finance.revenue)}</p>
            <p>Raaka-ainekustannukset: {formatCurrency(forecast.forecast.finance.materials)}</p>
            <p>Henkilöstökustannukset: {formatCurrency(forecast.forecast.finance.labor)}</p>
            <p>Kiinteät kustannukset: {formatCurrency(forecast.forecast.finance.fixedCosts)}</p>
            <p>Varaston muutos: {formatCurrency(forecast.forecast.finance.inventoryChange)}</p>
            <p>Poistot: {formatCurrency(forecast.forecast.finance.depreciation)}</p>
            <p>Korkokulut: {formatCurrency(forecast.forecast.finance.interest)}</p>
            <p>
              <strong>Tulos: {formatCurrency(forecast.forecast.finance.result)}</strong>
            </p>
          </article>
        </Card>

        <Card>
          <article className="act-section">
            <h2>Varasto</h2>
            <p>Variaatiot: {forecast.decisions.market.totalVariations}</p>
            <p>Tuotantoajot / variaatio: {forecast.decisions.market.runsPerVariation}</p>
            <p>Eräkoko: {formatContainers(forecast.forecast.batchSize)}</p>
            <p>
              Keskimääräinen valmistuotevarasto: {formatContainers(forecast.forecast.inventory.averageFinishedGoodsInventory)}
            </p>
            <p>Valmistuotevaraston arvo: {formatCurrency(forecast.forecast.inventory.finishedGoodsValue)}</p>
            <p>Varaston tilantarve: {Math.round(forecast.forecast.inventory.finishedGoodsArea)} m2</p>
            <p>Vapaa tehdastila: {Math.round(forecast.forecast.space.freeFactorySpace)} m2</p>
          </article>
        </Card>
      </div>

      <Card>
        <article className="act-section">
          <h2>Yhteenveto seuraavasta kierroksesta</h2>
          <p>Myyntihinta: {formatCurrency(price)}</p>
          <p>Variaatiot: {forecast.decisions.market.totalVariations}</p>
          <p>Kysyntä: {formatContainers(forecast.summary.demand)}</p>
          <p>Tuotantomäärä: {formatContainers(forecast.summary.productionQuantity)}</p>
          <p>Valmistuskapasiteetti: {formatContainers(forecast.summary.plantCapacity)}</p>
          <p>Käyttämätön kapasiteetti: {formatContainers(forecast.summary.unusedCapacity)}</p>
          <p>Toimitukset: {formatContainers(forecast.summary.deliveries)}</p>
          <p>Liikevaihto: {formatCurrency(forecast.summary.revenue)}</p>
          <p>Tulos: {formatCurrency(forecast.summary.result)}</p>
          <p>Pullonkaula: {forecast.summary.bottleneckLabel}</p>
          {forecast.summary.lostSalesUnits > 0 ? (
            <p className="act-highlight">Menetetty myynti: {formatContainers(forecast.summary.lostSalesUnits)}</p>
          ) : null}
          {forecast.summary.unusedCapacity > 0 ? (
            <p className="act-highlight">Käyttämätön kapasiteetti: {formatContainers(forecast.summary.unusedCapacity)}</p>
          ) : null}
        </article>
      </Card>

      <section className="act-actions" aria-label="ACT-vaiheen navigointi">
        <Button type="button" onClick={() => onNavigate('/check')}>
          ← PALAA CHECK-VAIHEESEEN
        </Button>
        <Button type="button" onClick={handleApprove}>
          HYVÄKSY PÄÄTÖKSET JA SIIRRY SEURAAVALLE KIERROKSELLE →
        </Button>
      </section>

      {statusMessage ? <p className="act-status">{statusMessage}</p> : null}
    </section>
  )
}

export default ActPage
