import { calculateKnlFromMetrics } from '../forecast/factoryKnl.js'

export const REPORT_METRICS = [
  { key: 'knl', label: 'KNL (%)', unit: '%' },
  { key: 'revenue', label: 'Liikevaihto (€)', unit: '€' },
  { key: 'result', label: 'Tulos (€)', unit: '€' },
  { key: 'equity', label: 'Oma pääoma (€)', unit: '€' },
]

function finiteValue(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function buildReportSeries(history, totalRounds) {
  return (Array.isArray(history) ? history : [])
    .filter((entry) => Number.isInteger(entry?.round) && entry.round >= 1 && entry.round <= totalRounds)
    .toSorted((a, b) => a.round - b.round)
    .map((entry) => {
      const metrics = entry.factoryKnl
      const hasKnl = metrics && ['kPct', 'nPct', 'lPct'].every((key) => finiteValue(metrics[key]) !== null)

      return {
        round: entry.round,
        knl: hasKnl ? calculateKnlFromMetrics(metrics).knl * 100 : null,
        revenue: finiteValue(entry.incomeStatement?.revenue),
        result: finiteValue(entry.incomeStatement?.result),
        equity: finiteValue(entry.finance?.equity),
      }
    })
}

export function formatReportValue(value, unit) {
  if (value == null || !Number.isFinite(value)) {
    return '—'
  }

  return `${value.toLocaleString('fi-FI', {
    minimumFractionDigits: unit === '%' ? 1 : 0,
    maximumFractionDigits: unit === '%' ? 1 : 0,
  })} ${unit}`
}

export function createReport(id, name) {
  return { id, name }
}
