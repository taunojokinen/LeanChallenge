import { DEFAULT_FACTORY_SETTINGS } from '../entities/factory-settings/defaultFactorySettings.js'
import {
  buildCanonicalFinancialHistory,
  normalizeFinancialHistoryEntry,
} from '../entities/factory-settings/financialHistory.js'
import { selectConfirmedKnlRounds } from '../entities/history/confirmedKnl.js'
import { selectLatestConfirmedRounds } from '../entities/history/confirmedRounds.js'
import { relativePercentChange } from '../entities/history/relativeChange.js'
import { calculateAnnualConfirmedInventoryTurnover } from '../entities/history/financialMetrics.js'

const headerKpiMap = {
  oee: 'KNL',
  production: 'Tuotantomäärä',
  revenue: 'Liikevaihto',
  result: 'Tulos',
  inventoryTurnover: 'Varaston kiertonopeus',
}

function formatSignedChange(delta, unit = ' %') {
  if (delta == null || !Number.isFinite(delta)) return '—'
  const value = delta
  const sign = value > 0 ? '+' : ''

  return `${sign}${value.toLocaleString('fi-FI', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).replace('−', '-')}${unit}`
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

function incomeChange(current, previous, field) {
  return relativePercentChange(
    current?.incomeStatement?.[field],
    previous?.incomeStatement?.[field],
  )
}

export function buildGameHeaderKpis(gameState, factorySettings = DEFAULT_FACTORY_SETTINGS) {
  const settings = factorySettings ?? DEFAULT_FACTORY_SETTINGS
  const baselineEntries = buildCanonicalFinancialHistory(gameState, settings)
  const selected = selectLatestConfirmedRounds({
    baselineEntries,
    runtimeEntries: gameState.history,
    count: 2,
  })
  const [previous, current] = selected
  const currentEntry = normalizeFinancialHistoryEntry(current)
  const currentIncome = currentEntry.incomeStatement
  const resultAmount = currentIncome.result

  const production = current?.production?.actualProduction
  const currentTurnover = calculateAnnualConfirmedInventoryTurnover(current)
  const previousTurnover = calculateAnnualConfirmedInventoryTurnover(previous)
  const [previousKnl, latestConfirmed] = selectConfirmedKnlRounds(gameState, settings)

  return [
    {
      key: 'oee',
      label: headerKpiMap.oee,
      value: formatKnl(latestConfirmed?.factory?.knl),
      delta: formatSignedChange(relativePercentChange(latestConfirmed?.factory?.knl, previousKnl?.factory?.knl)),
    },
    {
      key: 'production',
      label: headerKpiMap.production,
      value: production == null ? '—' : formatContainers(production),
      delta: formatSignedChange(relativePercentChange(production, previous?.production?.actualProduction)),
    },
    {
      key: 'revenue',
      label: headerKpiMap.revenue,
      value: formatCurrency(currentIncome.revenue),
      delta: formatSignedChange(incomeChange(current, previous, 'revenue')),
    },
    {
      key: 'result',
      label: headerKpiMap.result,
      value: formatCurrency(resultAmount),
      delta: formatSignedChange(incomeChange(current, previous, 'result')),
    },
    {
      key: 'inventoryTurnover',
      label: headerKpiMap.inventoryTurnover,
      value: currentTurnover == null ? '—' : `${currentTurnover.toLocaleString('fi-FI', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}x/vuosi`,
      delta: formatSignedChange(
        currentTurnover == null || previousTurnover == null ? null : currentTurnover - previousTurnover,
        'x/vuosi',
      ),
    },
  ]
}