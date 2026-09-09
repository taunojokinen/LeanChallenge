import { calculateKNL } from './knl.js'

const DEPARTMENTS = ['machining', 'assembly', 'shipping']

function toNumber(value, fallback = 0) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

export function calculateFactoryKnl(departmentMetrics = {}) {
  const weighted = { kPct: 0, nPct: 0, lPct: 0 }
  let totalWeight = 0

  DEPARTMENTS.forEach((department) => {
    const metrics = departmentMetrics[department] ?? {}
    const weight = Math.max(0, toNumber(metrics.capacityContainers))
    totalWeight += weight
    weighted.kPct += toNumber(metrics.kPct) * weight
    weighted.nPct += toNumber(metrics.nPct) * weight
    weighted.lPct += toNumber(metrics.lPct) * weight
  })

  if (totalWeight === 0) {
    return { kPct: 0, nPct: 0, lPct: 0, knl: 0 }
  }

  const kPct = weighted.kPct / totalWeight
  const nPct = weighted.nPct / totalWeight
  const lPct = weighted.lPct / totalWeight

  return {
    kPct,
    nPct,
    lPct,
    knl: calculateKNL(kPct, nPct, lPct),
  }
}

export function calculateKnlFromMetrics(metrics = {}) {
  const kPct = toNumber(metrics.kPct)
  const nPct = toNumber(metrics.nPct)
  const lPct = toNumber(metrics.lPct)

  return {
    kPct,
    nPct,
    lPct,
    knl: calculateKNL(kPct, nPct, lPct),
  }
}
