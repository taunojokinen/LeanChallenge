import { selectConfirmedKnlRounds } from '../../entities/history/confirmedKnl.js'

const DEPARTMENT_LABELS = {
  machining: 'Koneistus',
  assembly: 'Koonta',
  shipping: 'Lähettämö',
}

const STANDARD_METRICS = [
  { key: 'kAvailabilityPct', label: 'K - käytettävyys' },
  { key: 'nPct', label: 'N - nopeus' },
  { key: 'lPct', label: 'L - laatu' },
  { key: 'knl', label: 'KNL' },
]

const MACHINING_METRICS = [
  { key: 'kChangeoverPct', label: 'K - vaihdot' },
  ...STANDARD_METRICS,
]

function toNumber(value, fallback = 0) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

export function calculateRelativeChange(currentValue, previousValue) {
  const current = toNumber(currentValue)
  const previous = toNumber(previousValue)

  if (previous === 0) {
    return 0
  }

  return Number((((current - previous) / Math.abs(previous)) * 100).toFixed(1))
}

export function formatPercent(value) {
  return `${Math.round(toNumber(value))} %`
}

export function formatChange(value) {
  const numeric = toNumber(value)
  const sign = numeric > 0 ? '+' : ''
  return `${sign}${numeric.toLocaleString('fi-FI', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).replace('−', '-')} %`
}

function buildMetricComparison(current, previous, metrics, knlIsRatio = false) {
  return Object.fromEntries(
    metrics.map(({ key, label }) => [
      label,
      {
        key,
        label,
        current: knlIsRatio && key === 'knl' ? toNumber(current?.[key]) * 100 : toNumber(current?.[key]),
        previous: knlIsRatio && key === 'knl' ? toNumber(previous?.[key]) * 100 : toNumber(previous?.[key]),
        change: calculateRelativeChange(
          knlIsRatio && key === 'knl' ? toNumber(current?.[key]) * 100 : current?.[key],
          knlIsRatio && key === 'knl' ? toNumber(previous?.[key]) * 100 : previous?.[key],
        ),
      },
    ]),
  )
}

function buildDepartmentCard(department, currentEntry, previousEntry) {
  const metrics = department === 'machining' ? MACHINING_METRICS : STANDARD_METRICS

  return {
    key: department,
    name: DEPARTMENT_LABELS[department],
    metrics: buildMetricComparison(
      currentEntry?.departments?.[department],
      previousEntry?.departments?.[department],
      metrics,
    ),
  }
}

export function buildConfirmedCockpitViewModel(gameState, factorySettings) {
  if (!gameState) {
    return null
  }

  const [previousEntry, currentEntry] = selectConfirmedKnlRounds(gameState, factorySettings)
  const currentFactory = currentEntry?.factory ?? {}
  const previousFactory = previousEntry?.factory ?? {}

  return {
    confirmedRound: currentEntry.round,
    previousConfirmedRound: previousEntry.round,
    gauges: [
      { label: 'Käytettävyys', value: currentFactory.kPct, change: calculateRelativeChange(currentFactory.kPct, previousFactory.kPct) },
      { label: 'Nopeus', value: currentFactory.nPct, change: calculateRelativeChange(currentFactory.nPct, previousFactory.nPct) },
      { label: 'Laatu', value: currentFactory.lPct, change: calculateRelativeChange(currentFactory.lPct, previousFactory.lPct) },
    ],
    factory: buildMetricComparison(currentFactory, previousFactory, STANDARD_METRICS, true),
    departments: Object.keys(DEPARTMENT_LABELS).map((department) => buildDepartmentCard(department, currentEntry, previousEntry)),
    round: gameState.round,
  }
}
