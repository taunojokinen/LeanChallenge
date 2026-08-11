const PHASES = ['PLAN', 'DO', 'CHECK', 'ACT']

export function getPhaseSequence(round) {
  return round <= 12 ? PHASES : PHASES
}

export function getCurrentPhaseLabel(round, phaseIndex) {
  return PHASES[phaseIndex] ?? 'PLAN'
}

export function getPhaseProgress(round, phaseIndex) {
  const label = getCurrentPhaseLabel(round, phaseIndex)
  return `Kierros ${round} · ${label}`
}
