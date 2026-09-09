import { selectConfirmedKnlRounds } from '../../entities/history/confirmedKnl.js'

const DEPARTMENT_LABELS = {
  machining: 'Koneistus',
  assembly: 'Koonta',
  shipping: 'Lähettämö',
}

const METRICS = [
  { key: 'kPct', label: 'K' },
  { key: 'nPct', label: 'N' },
  { key: 'lPct', label: 'L' },
  { key: 'knl', label: 'KNL' },
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

function buildMetricComparison(current, previous, knlIsRatio = false) {
  return Object.fromEntries(
    METRICS.map(({ key, label }) => [
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
  return {
    key: department,
    name: DEPARTMENT_LABELS[department],
    metrics: buildMetricComparison(currentEntry?.departments?.[department], previousEntry?.departments?.[department]),
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
    factory: buildMetricComparison(currentFactory, previousFactory, true),
    departments: Object.keys(DEPARTMENT_LABELS).map((department) => buildDepartmentCard(department, currentEntry, previousEntry)),
    round: gameState.round,
  }
}
