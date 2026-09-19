// Canonical KNL development model (see /docs discussion in the KNL rework task):
// - 9 "normal" KNL parameters (K_machining/assembly/shipping, N_*, L_*) all develop from a
//   single shared half-life curve driven by cumulative development hours.
// - K_changeover is the one exception: it is derived from actual changeover loss, not hours.
// - Method levels (5S/SMED/TPM/...) are a separate, purely presentational concept and never
//   feed back into the KNL calculation itself.

function toNumber(value, fallback = 0) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

/**
 * Universal KNL development curve:
 *   X(H) = Xmax - (Xmax - X0) * 2 ^ (-H / halfLifeHours)
 *
 * H = 0            -> X = X0
 * H = halfLifeHours -> halves the remaining gap to Xmax
 * Never exceeds Xmax.
 */
export function calculateDevelopedKnlValue({ x0, cumulativeHours, knlMaximum, knlHalfLifeHours }) {
  const safeX0 = toNumber(x0)
  const safeMax = toNumber(knlMaximum, 0.95)
  const safeHalfLife = Math.max(1e-9, toNumber(knlHalfLifeHours, 400))
  const safeHours = Math.max(0, toNumber(cumulativeHours))

  const value = safeMax - (safeMax - safeX0) * 2 ** (-safeHours / safeHalfLife)

  return Math.min(safeMax, value)
}

/**
 * K_changeover is derived from the actual changeover loss, not from development hours:
 *   totalChangeovers = productionQuantity / batchSize
 *   totalChangeoverHours = totalChangeovers * setupTimeHours
 *   plannedMachineHours = machineCount * plannedHoursPerMachine
 *   K_changeover = 1 - totalChangeoverHours / plannedMachineHours
 *
 * machineCount only grows plannedMachineHours (available machine time); it never changes
 * totalChangeovers, which is purely production quantity / batch size.
 */
export function calculateKChangeover({
  productionQuantity,
  batchSize,
  setupTimeHours,
  machineCount,
  plannedHoursPerMachine,
}) {
  const safeBatchSize = Math.max(1e-9, toNumber(batchSize, 1))
  const totalChangeovers = Math.max(0, toNumber(productionQuantity)) / safeBatchSize
  const totalChangeoverHours = totalChangeovers * Math.max(0, toNumber(setupTimeHours))
  const plannedMachineHours = Math.max(0, toNumber(machineCount)) * Math.max(0, toNumber(plannedHoursPerMachine))

  const kChangeover = plannedMachineHours > 0
    ? clamp(1 - totalChangeoverHours / plannedMachineHours, 0, 1)
    : 0

  return { totalChangeovers, totalChangeoverHours, plannedMachineHours, kChangeover }
}

/**
 * Shared method-development-level helper (5S, SMED, TPM, ...):
 *   threshold(level) = baseHours * multiplier ^ (level - 1)
 * Levels are purely descriptive and never participate in the KNL calculation.
 */
export function resolveDevelopmentLevel(cumulativeHours, { baseHours = 100, multiplier = 1.5 } = {}) {
  const safeHours = Math.max(0, toNumber(cumulativeHours))
  const safeBaseHours = Math.max(1e-9, toNumber(baseHours, 100))
  const safeMultiplier = Math.max(1 + 1e-9, toNumber(multiplier, 1.5))

  if (safeHours < safeBaseHours) {
    return 0
  }

  const ratio = safeHours / safeBaseHours
  return 1 + Math.floor(Math.log(ratio) / Math.log(safeMultiplier) + 1e-9)
}

/**
 * A department's 5S investment is split evenly across its K, N and L development hours so the
 * total hours booked equal the invested hours exactly (no double counting).
 */
export function splitFiveSHoursAcrossKnl(fiveSEffectiveHours) {
  const share = Math.max(0, toNumber(fiveSEffectiveHours)) / 3
  return { K: share, N: share, L: share }
}
