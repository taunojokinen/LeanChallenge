// gameState.round is the round currently being planned (PLAN -> DO -> CHECK -> ACT); the last
// confirmed/historical round is always one earlier. CHECK's batch-size decision and its preview
// belong to planningRound, never planningRound + 1.
export function resolveCheckRoundLabels(round) {
  const planningRound = Number(round) || 0

  return {
    confirmedRound: planningRound - 1,
    planningRound,
  }
}
