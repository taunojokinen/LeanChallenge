function requireCanonicalClosingState(forecast) {
  const canonical = forecast?.closingState?.canonical

  if (!canonical) {
    throw new Error('Cannot advance round without forecast.closingState.canonical')
  }

  return canonical
}

function buildHistoryEntry(currentRound, forecast, canonical) {
  const incomeStatement = forecast.closingState.finance.incomeStatement
  const production = forecast.forecast

  return {
    round: currentRound,
    incomeStatement: { ...incomeStatement },
    finance: { ...canonical.finance },
    market: {
      price: forecast.forecast.market.price,
      activeVariations: forecast.forecast.market.totalVariations,
    },
    production: {
      actualProduction: production.actualProduction,
      deliveries: production.deliveries,
      demand: production.demand,
      lostSalesUnits: production.lostSalesUnits,
    },
    knl: Object.fromEntries(
      Object.entries(production.knl ?? {}).map(([department, metrics]) => [department, { ...metrics }]),
    ),
    factoryKnl: {
      kPct: forecast.forecast.factoryKnl.kPct,
      nPct: forecast.forecast.factoryKnl.nPct,
      lPct: forecast.forecast.factoryKnl.lPct,
    },
  }
}

function appendHistory(history, historyEntry) {
  const existing = Array.isArray(history) ? history : []
  const withoutCurrentRound = existing.filter((entry) => entry?.round !== historyEntry.round)

  return [...withoutCurrentRound, historyEntry]
}

export function advanceRoundState({ gameState, forecast, totalRounds, checkProductionDecision }) {
  const canonical = requireCanonicalClosingState(forecast)
  const currentRound = Number(gameState?.round)

  if (!Number.isInteger(currentRound) || currentRound < 1) {
    throw new Error('Cannot advance round without a valid current gameState.round')
  }

  const closingEquity = Number(canonical.finance?.equity)
  const isGameOver = Number.isFinite(closingEquity) && closingEquity <= 0
  const isGameComplete = isGameOver || currentRound >= Number(totalRounds)
  const historyEntry = buildHistoryEntry(currentRound, forecast, canonical)
  const nextRound = isGameComplete ? currentRound : currentRound + 1
  const nextGameState = {
    ...canonical,
    round: nextRound,
    history: appendHistory(gameState.history, historyEntry),
  }

  // CHECK's next-round batch-size decision is made during the round being confirmed
  // (currentRound) and only takes effect for nextGameState; it never touches this round's own
  // forecast/actuals. Planned production quantity is a marketing decision owned by ACT and is
  // never read here, so a stale CHECK value can never carry into the next round's market state.
  if (!isGameComplete && checkProductionDecision && Number(checkProductionDecision.round) === currentRound) {
    const marketOverrides = {}

    if (checkProductionDecision.batchSize != null) {
      marketOverrides.batchSize = Math.max(0, Math.round(Number(checkProductionDecision.batchSize) || 0))
    }

    if (Object.keys(marketOverrides).length > 0) {
      nextGameState.market = {
        ...nextGameState.market,
        ...marketOverrides,
      }
    }
  }

  return {
    nextGameState,
    historyEntry,
    confirmedRound: currentRound,
    isGameOver,
    isGameComplete,
  }
}

