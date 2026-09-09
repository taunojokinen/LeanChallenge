export function getConfirmedRound(round) {
  return Math.max(0, Number(round) - 1)
}

export function formatGameplayRound(round, totalRounds) {
  return `Kierros ${round} / ${totalRounds}`
}

export function formatConfirmedKpiRound(round) {
  return `KPI:t vahvistettu kierrokselta ${getConfirmedRound(round)}`
}
