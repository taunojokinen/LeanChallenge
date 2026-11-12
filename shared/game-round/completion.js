export function getGameCompletion(gameState, totalRounds) {
  if (gameState?.completion) {
    return gameState.completion
  }

  // Older sessions have no completion flag, but retain the final confirmed round.
  const finalEntry = gameState?.history?.find((entry) => entry.round === gameState.round)
  if (!finalEntry) {
    return null
  }

  const equity = finalEntry.finance?.equity
  if (Number.isFinite(equity) && equity <= 0) {
    return { reason: 'bankruptcy', confirmedRound: finalEntry.round }
  }

  return finalEntry.round >= totalRounds
    ? { reason: 'round-limit', confirmedRound: finalEntry.round }
    : null
}
