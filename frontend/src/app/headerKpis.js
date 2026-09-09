import { DEFAULT_FACTORY_SETTINGS } from '../entities/factory-settings/defaultFactorySettings.js'
import {
  buildCanonicalFinancialHistory,
  normalizeFinancialHistoryEntry,
} from '../entities/factory-settings/financialHistory.js'
import { calculateDemandPerVariation } from '../entities/forecast/model.js'
import { selectConfirmedKnlRounds } from '../entities/history/confirmedKnl.js'
import { selectLatestConfirmedRounds } from '../entities/history/confirmedRounds.js'

const headerKpiMap = {
  oee: 'KNL',
  production: 'Tuotantomäärä',
  revenue: 'Liikevaihto',
  result: 'Tulos',
  inventoryTurnover: 'Varaston kiertonopeus',
}

function formatSignedPercent(delta) {
  const value = Number(delta) || 0
  const sign = value > 0 ? '+' : ''

  return `${sign}${value.toLocaleString('fi-FI', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} %`
}

function formatCurrency(value) {
  return `${Math.round(Number(value) || 0).toLocaleString('fi-FI')} €`
}

function formatContainers(value) {
  return `${Math.round(Number(value) || 0).toLocaleString('fi-FI')} kpl`
}

function formatKnl(value) {
  return `${Math.round((Number(value) || 0) * 100).toLocaleString('fi-FI')} %`
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

export function buildGameHeaderKpis(gameState, factorySettings = DEFAULT_FACTORY_SETTINGS) {
  const settings = factorySettings ?? DEFAULT_FACTORY_SETTINGS
  const baselineEntries = buildCanonicalFinancialHistory(gameState, settings)
  const selected = selectLatestConfirmedRounds({
    baselineEntries,
    runtimeEntries: gameState.history,
    count: 1,
  })
  const currentEntry = normalizeFinancialHistoryEntry(selected[0] ?? baselineEntries[1])
  const currentIncome = currentEntry.incomeStatement
  const resultAmount = currentIncome.result

  const salesAmount = currentIncome.salesUnits
  const inventoryContainers = Math.max(1, toNumber(gameState.inventory?.finishedGoodsContainers, 1))
  const inventoryTurnover = salesAmount / inventoryContainers
  const demandPerVariation = calculateDemandPerVariation(
    gameState.market?.price,
    settings,
  )
  const demand = demandPerVariation * Math.max(0, toNumber(gameState.market?.activeVariations, 0))
  const production = Math.min(demand, salesAmount)
  const [, latestConfirmed] = selectConfirmedKnlRounds(gameState, settings)

  return [
    {
      key: 'oee',
      label: headerKpiMap.oee,
      value: formatKnl(latestConfirmed?.factory?.knl),
      delta: formatSignedPercent(0),
    },
    {
      key: 'production',
      label: headerKpiMap.production,
      value: formatContainers(production),
      delta: formatSignedPercent(0),
    },
    {
      key: 'revenue',
      label: headerKpiMap.revenue,
      value: formatCurrency(currentIncome.revenue),
      delta: formatSignedPercent(0),
    },
    {
      key: 'result',
      label: headerKpiMap.result,
      value: formatCurrency(resultAmount),
      delta: formatSignedPercent(0),
    },
    {
      key: 'inventoryTurnover',
      label: headerKpiMap.inventoryTurnover,
      value: `${inventoryTurnover.toLocaleString('fi-FI', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}x`,
      delta: '+0.0',
    },
  ]
}