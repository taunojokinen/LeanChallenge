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
    kChangeoverPct: Number.isFinite(Number(metric.kChangeoverPct))
      ? Number(metric.kChangeoverPct)
      : undefined,
    kAvailabilityPct: Number.isFinite(Number(metric.kAvailabilityPct ?? metric.kMachiningDevelopedPct))
      ? Number(metric.kAvailabilityPct ?? metric.kMachiningDevelopedPct)
      : normalized.kPct,
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

function buildRoundZeroBaseline(factorySettings) {
  const initialState = createInitialGameState(factorySettings, { historySeed: 0 })
  const initialForecast = calculateRoundForecast(initialState, {}, factorySettings)

  return {
    round: 0,
    departments: normalizeDepartments({
      ...initialForecast.current.knl,
      machining: {
        ...initialForecast.current.knl.machining,
        kAvailabilityPct: initialForecast.current.knl.machining.kMachiningDevelopedPct,
      },
    }),
    factory: normalizeFactoryMetric(initialForecast.current.factoryKnl, initialForecast.current.knl),
  }
}

export function buildInitialKnlHistory(gameState, factorySettings = DEFAULT_FACTORY_SETTINGS) {
  const roundZero = buildRoundZeroBaseline(factorySettings)
  // Legacy sessions without a seed use a stable seed, never a new draw on reads.
  let seed = toNumber(gameState?.historySeed) >>> 0
  const perturb = (value) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    // Four factors at +/-0.2% bound even the inverse KNL change below 0.81%.
    return Math.min(100, Math.max(0, value * (1 + (seed / 2 ** 32 * 2 - 1) * 0.002)))
  }
  const departments = Object.fromEntries(KNL_DEPARTMENTS.map((department) => {
    const original = roundZero.departments[department]
    const kAvailabilityPct = perturb(original.kAvailabilityPct)
    const kChangeoverPct = department === 'machining' ? perturb(original.kChangeoverPct) : undefined
    const kPct = department === 'machining'
      ? kAvailabilityPct * kChangeoverPct / 100
      : kAvailabilityPct
    const metrics = {
      ...original,
      kAvailabilityPct,
      kChangeoverPct,
      kPct,
      nPct: perturb(original.nPct),
      lPct: perturb(original.lPct),
    }
    metrics.knl = calculateKnlFromMetrics(metrics).knl * 100
    return [department, metrics]
  }))

  return [
    { round: -1, departments, factory: calculateFactoryKnl(departments) },
    roundZero,
  ]
}

export function selectConfirmedKnlRounds(gameState, factorySettings) {
  const settings = factorySettings ?? DEFAULT_FACTORY_SETTINGS
  const baselineEntries = buildInitialKnlHistory(gameState, settings)
  const runtimeEntries = Array.isArray(gameState?.history)
    ? gameState.history.map(normalizeEntry)
    : []

  return selectLatestConfirmedRounds({ baselineEntries, runtimeEntries, count: 2 })
}
