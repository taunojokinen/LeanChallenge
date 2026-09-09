import { calculateFactoryKnl, calculateKnlFromMetrics } from '../forecast/factoryKnl.js'
import { calculateRoundForecast } from '../forecast/model.js'
import { createInitialGameState } from '../factory-settings/initialGameState.js'
import { DEFAULT_FACTORY_SETTINGS } from '../factory-settings/defaultFactorySettings.js'
import { selectLatestConfirmedRounds } from './confirmedRounds.js'

export const KNL_DEPARTMENTS = ['machining', 'assembly', 'shipping']

function toNumber(value, fallback = 0) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function normalizeMetric(metric = {}) {
  const normalized = {
    kPct: toNumber(metric.kPct),
    nPct: toNumber(metric.nPct),
    lPct: toNumber(metric.lPct),
  }
  const derivedKnl = calculateKnlFromMetrics(normalized).knl * 100
  const storedKnl = toNumber(metric.knl, Number.NaN)

  return {
    ...normalized,
    knl: Number.isFinite(storedKnl) ? (Math.abs(storedKnl) <= 1 ? storedKnl * 100 : storedKnl) : derivedKnl,
    capacityContainers: toNumber(metric.capacityContainers),
  }
}

function normalizeDepartments(source = {}) {
  return Object.fromEntries(
    KNL_DEPARTMENTS.map((department) => [department, normalizeMetric(source[department])]),
  )
}

function normalizeFactoryMetric(factoryMetric, departments) {
  if (factoryMetric) {
    return calculateKnlFromMetrics(factoryMetric)
  }

  return calculateFactoryKnl(departments)
}

function normalizeEntry(entry) {
  const departments = normalizeDepartments(entry?.knl)

  return {
    round: Number(entry?.round),
    departments,
    factory: normalizeFactoryMetric(entry?.factoryKnl, departments),
  }
}

function buildHistoricalBaseline(factorySettings) {
  const settings = factorySettings
  const historical = settings.history?.knl?.roundMinusOne ?? {}
  const departments = normalizeDepartments(historical)
  const factory = normalizeFactoryMetric(historical.factory, departments)

  return {
    round: -1,
    departments,
    factory,
  }
}

function buildRoundZeroBaseline(factorySettings) {
  const initialState = createInitialGameState(factorySettings)
  const initialForecast = calculateRoundForecast(initialState, {}, factorySettings)

  return {
    round: 0,
    departments: normalizeDepartments(initialForecast.current.knl),
    factory: normalizeFactoryMetric(initialForecast.current.factoryKnl, initialForecast.current.knl),
  }
}

export function selectConfirmedKnlRounds(gameState, factorySettings) {
  const settings = factorySettings ?? DEFAULT_FACTORY_SETTINGS
  const baselineEntries = [
    buildHistoricalBaseline(settings),
    buildRoundZeroBaseline(settings),
  ]
  const runtimeEntries = Array.isArray(gameState?.history)
    ? gameState.history.map(normalizeEntry)
    : []

  return selectLatestConfirmedRounds({ baselineEntries, runtimeEntries, count: 2 })
}
