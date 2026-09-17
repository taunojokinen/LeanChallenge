import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_FACTORY_SETTINGS } from '../factory-settings/defaultFactorySettings.js'
import { createInitialGameState } from '../factory-settings/initialGameState.js'
import { calculateRoundForecast } from '../forecast/model.js'
import { advanceRoundState } from './advanceRound.js'

function createRoundOneForecast(overrides = {}) {
  const gameState = createInitialGameState()
  const effectiveGameState = {
    ...gameState,
    ...overrides,
  }
  const forecast = calculateRoundForecast(
    effectiveGameState,
    {
      market: {
        price: 25500,
        addedVariations: 1,
        productionQuantity: 200,
      },
    },
    DEFAULT_FACTORY_SETTINGS,
  )

  return { gameState: effectiveGameState, forecast }
}

test('advances round one to round two from canonical closing state', () => {
  const { gameState, forecast } = createRoundOneForecast()
  const result = advanceRoundState({
    gameState,
    forecast,
    totalRounds: 12,
  })

  assert.equal(result.nextGameState.round, 2)
  assert.equal(result.confirmedRound, 1)
  assert.equal(result.isGameComplete, false)
  assert.equal(result.nextGameState.market.price, forecast.closingState.canonical.market.price)
  assert.equal(result.nextGameState.finance.bankLoans, forecast.closingState.canonical.finance.bankLoans)
  assert.equal(result.nextGameState.inventory.finishedGoodsContainers, forecast.closingState.canonical.inventory.finishedGoodsContainers)
})

test('does not carry derived, history, decision, or snapshot fields', () => {
  const { gameState, forecast } = createRoundOneForecast()
  const result = advanceRoundState({ gameState, forecast, totalRounds: 12 })
  const nextState = result.nextGameState

  assert.equal('machining' in nextState.staffing, false)
  assert.equal('finishedGoodsBookValue' in nextState.inventory, false)
  assert.equal('inventoryBookValue' in nextState.finance, false)
  assert.equal('fixedAssets' in nextState.finance, false)
  assert.equal('totalAssets' in nextState.finance, false)
  assert.equal('totalLiabilitiesAndEquity' in nextState.finance, false)
  assert.equal('incomeStatement' in nextState.finance, false)
  assert.equal('overdraft' in nextState.finance, false)
  assert.equal('productionQuantity' in nextState, false)
  assert.equal('forecast' in nextState, false)
  assert.equal('investmentsSnapshot' in nextState, false)
  assert.equal('fiveSDecision' in nextState, false)
})

test('history entry matches forecast and is not duplicated for the same round', () => {
  const { gameState, forecast } = createRoundOneForecast()
  const first = advanceRoundState({ gameState, forecast, totalRounds: 12 })
  const second = advanceRoundState({
    gameState: {
      ...gameState,
      history: first.nextGameState.history,
    },
    forecast,
    totalRounds: 12,
  })

  assert.equal(first.historyEntry.round, 1)
  assert.equal(first.historyEntry.incomeStatement.result, forecast.forecast.finance.result)
  assert.equal(first.historyEntry.finance.cash, forecast.closingState.canonical.finance.cash)
  assert.equal(first.historyEntry.market.activeVariations, forecast.forecast.market.totalVariations)
  assert.equal(second.nextGameState.history.length, 1)
})

test('round twelve is confirmed without creating round thirteen', () => {
  const { gameState, forecast } = createRoundOneForecast({ round: 12 })
  const result = advanceRoundState({ gameState, forecast, totalRounds: 12 })

  assert.equal(result.nextGameState.round, 12)
  assert.equal(result.isGameComplete, true)
  assert.equal(result.isGameOver, result.nextGameState.finance.equity <= 0)
  assert.equal(result.nextGameState.history.length, 1)
})

test('non-positive closing equity marks game over without changing formulas', () => {
  const { gameState, forecast } = createRoundOneForecast()
  const losingForecast = {
    ...forecast,
    closingState: {
      ...forecast.closingState,
      canonical: {
        ...forecast.closingState.canonical,
        finance: {
          ...forecast.closingState.canonical.finance,
          equity: 0,
        },
      },
    },
  }
  const result = advanceRoundState({ gameState, forecast: losingForecast, totalRounds: 12 })

  assert.equal(result.isGameOver, true)
  assert.equal(result.isGameComplete, true)
  assert.equal(result.nextGameState.round, 1)
})

test('round chain carries finance, lean, machines, and variations into round two', () => {
  const { gameState, forecast } = createRoundOneForecast({
    fiveSDecision: {
      round: 1,
      investedHours: { machining: 100, assembly: 80, shipping: 60 },
    },
    projectsDecision: {
      round: 1,
      selections: [{ department: 'machining', method: 'smed', investedHours: 20 }],
    },
    investmentsDecision: {
      round: 1,
      investments: [{ type: 'new-machine', quantity: 1 }],
    },
  })
  const advanced = advanceRoundState({ gameState, forecast, totalRounds: 12 })
  const roundTwoForecast = calculateRoundForecast(advanced.nextGameState)

  assert.equal(roundTwoForecast.forecast.finance.openingInterestBearingDebt, advanced.nextGameState.finance.bankLoans)
  assert.equal(roundTwoForecast.forecast.finance.interest, advanced.nextGameState.finance.bankLoans * roundTwoForecast.forecast.finance.roundInterestRate)
  assert.equal(roundTwoForecast.forecast.staffing.machining, advanced.nextGameState.production.machiningMachines * DEFAULT_FACTORY_SETTINGS.production.workersPerMachine)
  assert.equal(roundTwoForecast.forecast.market.activeVariationCount, advanced.nextGameState.market.activeVariations)
  assert.equal(roundTwoForecast.closingState.lean.methods.machining.smed >= advanced.nextGameState.lean.methods.machining.smed, true)
})

test('requires canonical closing state', () => {
  assert.throws(
    () => advanceRoundState({
      gameState: createInitialGameState(),
      forecast: {},
      totalRounds: 12,
    }),
    /closingState\.canonical/,
  )
})

test('batchSize=20 survives advanceRound into nextGameState.market.batchSize', () => {
  const gameState = createInitialGameState()
  const forecast = calculateRoundForecast(
    gameState,
    { market: { price: 25000, productionQuantity: 200, batchSize: 20 } },
    DEFAULT_FACTORY_SETTINGS,
  )
  const result = advanceRoundState({ gameState, forecast, totalRounds: 12 })

  assert.equal(result.nextGameState.market.batchSize, 20)
})

test('batchSize=5 survives advanceRound into nextGameState.market.batchSize', () => {
  const gameState = createInitialGameState()
  const forecast = calculateRoundForecast(
    gameState,
    { market: { price: 25000, productionQuantity: 200, batchSize: 5 } },
    DEFAULT_FACTORY_SETTINGS,
  )
  const result = advanceRoundState({ gameState, forecast, totalRounds: 12 })

  assert.equal(result.nextGameState.market.batchSize, 5)
})

test('batchSize decision is used correctly round by round: Q20 -> Q5 -> Q20', () => {
  let gameState = createInitialGameState()

  function decideAndAdvance(batchSize) {
    const forecast = calculateRoundForecast(
      gameState,
      { market: { price: 25000, productionQuantity: 200, batchSize } },
      DEFAULT_FACTORY_SETTINGS,
    )
    const usedBatchSize = forecast.decisions.market.batchSize
    const result = advanceRoundState({ gameState, forecast, totalRounds: 12 })
    gameState = result.nextGameState
    return { usedBatchSize, nextCarriedBatchSize: result.nextGameState.market.batchSize }
  }

  const roundOne = decideAndAdvance(20)
  assert.equal(roundOne.usedBatchSize, 20)
  assert.equal(roundOne.nextCarriedBatchSize, 20)

  const roundTwo = decideAndAdvance(5)
  assert.equal(roundTwo.usedBatchSize, 5)
  assert.equal(roundTwo.nextCarriedBatchSize, 5)

  const roundThree = decideAndAdvance(20)
  assert.equal(roundThree.usedBatchSize, 20)
  assert.equal(roundThree.nextCarriedBatchSize, 20)

  // A round with no explicit ACT decision must keep using the last carried-over value (5),
  // not silently reset to initialBatchSize.
  gameState = { ...gameState, market: { ...gameState.market, batchSize: 5 } }
  const noDecisionForecast = calculateRoundForecast(gameState, {}, DEFAULT_FACTORY_SETTINGS)
  assert.equal(noDecisionForecast.decisions.market.batchSize, 5)
})

test('CHECK production decision for round N only affects round N+1, not round N itself', () => {
  const gameState = createInitialGameState()
  const forecast = calculateRoundForecast(
    gameState,
    { market: { price: 25000, productionQuantity: 150 } },
    DEFAULT_FACTORY_SETTINGS,
  )
  const roundNActualProduction = forecast.forecast.actualProduction
  const roundNDeliveries = forecast.forecast.deliveries

  const result = advanceRoundState({
    gameState,
    forecast,
    totalRounds: 12,
    checkProductionDecision: { round: gameState.round, productionQuantity: 999 },
  })

  // Round N's own forecast object is untouched by the decision made for round N+1.
  assert.equal(forecast.forecast.actualProduction, roundNActualProduction)
  assert.equal(forecast.forecast.deliveries, roundNDeliveries)
  assert.equal(result.nextGameState.round, 2)
})

test('advanceRound carries the physical closing FG into nextGameState.inventory.finishedGoodsContainers', () => {
  const gameState = createInitialGameState()
  const forecast = calculateRoundForecast(
    gameState,
    { market: { price: 25000, productionQuantity: 150 } },
    DEFAULT_FACTORY_SETTINGS,
  )
  const result = advanceRoundState({ gameState, forecast, totalRounds: 12 })

  assert.equal(
    result.nextGameState.inventory.finishedGoodsContainers,
    forecast.forecast.inventory.closingFinishedGoodsInventory,
  )
})

test('CHECK production decision survives round transition and becomes next round requested production', () => {
  const gameState = createInitialGameState()
  const forecast = calculateRoundForecast(
    gameState,
    { market: { price: 25000, productionQuantity: 150 } },
    DEFAULT_FACTORY_SETTINGS,
  )

  const result = advanceRoundState({
    gameState,
    forecast,
    totalRounds: 12,
    checkProductionDecision: { round: gameState.round, productionQuantity: 123 },
  })

  assert.equal(result.nextGameState.market.productionQuantity, 123)

  const nextRoundForecast = calculateRoundForecast(result.nextGameState, {}, DEFAULT_FACTORY_SETTINGS)

  assert.equal(nextRoundForecast.forecast.requestedProductionQuantity, 123)
})

test('CHECK production decision for a different round is ignored', () => {
  const gameState = createInitialGameState()
  const forecast = calculateRoundForecast(
    gameState,
    { market: { price: 25000, productionQuantity: 150 } },
    DEFAULT_FACTORY_SETTINGS,
  )

  const result = advanceRoundState({
    gameState,
    forecast,
    totalRounds: 12,
    checkProductionDecision: { round: gameState.round + 5, productionQuantity: 999 },
  })

  assert.equal(Object.prototype.hasOwnProperty.call(result.nextGameState.market, 'productionQuantity'), false)
})

test('CHECK batchSize decision applies to nextGameState.market.batchSize after advanceRound', () => {
  const gameState = createInitialGameState()
  gameState.market.batchSize = 20
  const forecast = calculateRoundForecast(gameState, { market: { productionQuantity: 150 } }, DEFAULT_FACTORY_SETTINGS)

  const result = advanceRoundState({
    gameState,
    forecast,
    totalRounds: 12,
    checkProductionDecision: { round: gameState.round, productionQuantity: 150, batchSize: 5 },
  })

  assert.equal(result.nextGameState.market.batchSize, 5)
})

test('CHECK target finished-goods inventory applies only to the next game state', () => {
  const gameState = createInitialGameState()
  const forecast = calculateRoundForecast(gameState, { market: { productionQuantity: 150 } }, DEFAULT_FACTORY_SETTINGS)

  const result = advanceRoundState({
    gameState,
    forecast,
    totalRounds: 12,
    checkProductionDecision: {
      round: gameState.round,
      productionQuantity: 150,
      batchSize: 5,
      targetFinishedGoodsInventory: 60,
    },
  })

  assert.equal(result.nextGameState.market.targetFinishedGoodsInventory, 60)
  assert.notEqual(forecast.forecast.inventory.targetFinishedGoodsInventory, 60)
})

test('next round forecast uses the CHECK-decided batchSize for changeovers, K, and the minimum FG metric', () => {
  const gameState = createInitialGameState()
  gameState.market.batchSize = 20
  const forecast = calculateRoundForecast(gameState, { market: { productionQuantity: 150 } }, DEFAULT_FACTORY_SETTINGS)

  const result = advanceRoundState({
    gameState,
    forecast,
    totalRounds: 12,
    checkProductionDecision: { round: gameState.round, productionQuantity: 150, batchSize: 5 },
  })

  const nextRoundForecast = calculateRoundForecast(result.nextGameState, {}, DEFAULT_FACTORY_SETTINGS)

  assert.equal(nextRoundForecast.decisions.market.batchSize, 5)
  assert.equal(nextRoundForecast.forecast.knl.machining.batchSize, 5)
  assert.equal(
    nextRoundForecast.forecast.inventory.minimumFinishedGoodsInventory,
    (nextRoundForecast.decisions.market.totalVariations * 5) / (2 * 2),
  )
})

test('missing CHECK batchSize decision preserves the current round batchSize into the next round', () => {
  const gameState = createInitialGameState()
  gameState.market.batchSize = 20
  const forecast = calculateRoundForecast(gameState, { market: { productionQuantity: 150 } }, DEFAULT_FACTORY_SETTINGS)

  const result = advanceRoundState({ gameState, forecast, totalRounds: 12 })

  assert.equal(result.nextGameState.market.batchSize, 20)
})

test('a legacy ACT-style batchSize override for the current round has no bearing on the next round batchSize', () => {
  const gameState = createInitialGameState()
  gameState.market.batchSize = 20
  // Simulate an old ACT UI still somehow sending a one-off batchSize override for the current round.
  const forecast = calculateRoundForecast(
    gameState,
    { market: { productionQuantity: 150, batchSize: 15 } },
    DEFAULT_FACTORY_SETTINGS,
  )

  const result = advanceRoundState({
    gameState,
    forecast,
    totalRounds: 12,
    checkProductionDecision: { round: gameState.round, productionQuantity: 150, batchSize: 5 },
  })

  // advanceRoundState only ever reads batchSize from checkProductionDecision; a current-round-only
  // override cannot leak into the canonical next-round batchSize decided by CHECK.
  assert.equal(result.nextGameState.market.batchSize, 5)
})

test('CHECK batchSize decision does not touch this round\'s own physical closing FG or inventoryChange', () => {
  const gameState = createInitialGameState()
  gameState.market.batchSize = 20
  const forecast = calculateRoundForecast(gameState, { market: { productionQuantity: 150 } }, DEFAULT_FACTORY_SETTINGS)
  const roundNClosingFg = forecast.forecast.inventory.closingFinishedGoodsInventory
  const roundNInventoryChange = forecast.forecast.inventory.inventoryChange

  advanceRoundState({
    gameState,
    forecast,
    totalRounds: 12,
    checkProductionDecision: { round: gameState.round, productionQuantity: 150, batchSize: 5 },
  })

  assert.equal(forecast.forecast.inventory.closingFinishedGoodsInventory, roundNClosingFg)
  assert.equal(forecast.forecast.inventory.inventoryChange, roundNInventoryChange)
})

// Phase 3: CHECK's read-only "next round preview". This mirrors exactly what CheckPage.jsx does:
// build an in-memory nextGameState via advanceRoundState (no persistence), then run the shared
// calculateRoundForecast on it using the CHECK input values.
function buildPreview(gameState, currentForecast, productionQuantity, batchSize) {
  const { nextGameState } = advanceRoundState({
    gameState,
    forecast: currentForecast,
    totalRounds: 12,
    checkProductionDecision: { round: gameState.round, productionQuantity, batchSize },
  })

  return calculateRoundForecast(nextGameState, {}, DEFAULT_FACTORY_SETTINGS)
}

test('preview A: current minimumFG stays on current batchSize while preview uses the next-round batchSize', () => {
  const gameState = createInitialGameState()
  gameState.market.batchSize = 5
  const currentForecast = calculateRoundForecast(gameState, { market: { productionQuantity: 150 } }, DEFAULT_FACTORY_SETTINGS)

  const preview = buildPreview(gameState, currentForecast, 150, 10)

  assert.equal(currentForecast.decisions.market.batchSize, 5)
  assert.equal(
    currentForecast.forecast.inventory.minimumFinishedGoodsInventory,
    (currentForecast.decisions.market.totalVariations * 5) / (2 * 2),
  )
  assert.equal(preview.decisions.market.batchSize, 10)
  assert.equal(
    preview.forecast.inventory.minimumFinishedGoodsInventory,
    (preview.decisions.market.totalVariations * 10) / (2 * 2),
  )
})

test('preview B: current changeovers stay on current batchSize while preview uses the next-round batchSize', () => {
  const gameState = createInitialGameState()
  gameState.market.batchSize = 5
  const currentForecast = calculateRoundForecast(gameState, { market: { productionQuantity: 150 } }, DEFAULT_FACTORY_SETTINGS)

  const preview = buildPreview(gameState, currentForecast, 150, 10)

  assert.equal(currentForecast.forecast.knl.machining.batchSize, 5)
  assert.equal(preview.forecast.knl.machining.batchSize, 10)
  assert.notEqual(
    currentForecast.forecast.knl.machining.changeoversPerMachine,
    preview.forecast.knl.machining.changeoversPerMachine,
  )
})

test('CHECK preview changes total factory changeovers from 9 to 18 when batch size changes from 20 to 10', () => {
  const gameState = createInitialGameState()
  gameState.production.machiningMachines = 3
  const currentForecast = calculateRoundForecast(gameState, { market: { productionQuantity: 180 } }, DEFAULT_FACTORY_SETTINGS)

  const previewQ20 = buildPreview(gameState, currentForecast, 180, 20)
  const previewQ10 = buildPreview(gameState, currentForecast, 180, 10)

  assert.equal(previewQ20.forecast.actualProduction, 180)
  assert.equal(previewQ20.forecast.knl.machining.totalChangeovers, 9)
  assert.equal(previewQ10.forecast.actualProduction, 180)
  assert.equal(previewQ10.forecast.knl.machining.totalChangeovers, 18)
  assert.notEqual(
    previewQ20.forecast.capacityByDepartment.machining,
    previewQ10.forecast.capacityByDepartment.machining,
  )
})

test('preview C: current round capacity does not change while building different previews', () => {
  const gameState = createInitialGameState()
  gameState.market.batchSize = 5
  const currentForecast = calculateRoundForecast(gameState, { market: { productionQuantity: 150 } }, DEFAULT_FACTORY_SETTINGS)
  const capacityBefore = { ...currentForecast.forecast.capacityByDepartment }

  buildPreview(gameState, currentForecast, 150, 10)
  buildPreview(gameState, currentForecast, 220, 20)
  buildPreview(gameState, currentForecast, 50, 1)

  assert.deepEqual(currentForecast.forecast.capacityByDepartment, capacityBefore)
})

test('preview D: preview machining capacity changes with the batchSize input', () => {
  const gameState = createInitialGameState()
  gameState.market.batchSize = 5
  const currentForecast = calculateRoundForecast(gameState, { market: { productionQuantity: 150 } }, DEFAULT_FACTORY_SETTINGS)

  const previewQ5 = buildPreview(gameState, currentForecast, 150, 5)
  const previewQ20 = buildPreview(gameState, currentForecast, 150, 20)

  assert.notEqual(
    previewQ5.forecast.capacityByDepartment.machining,
    previewQ20.forecast.capacityByDepartment.machining,
  )
})

test('preview E: productionQuantity input changes preview actualProduction but not current actualProduction', () => {
  const gameState = createInitialGameState()
  gameState.market.batchSize = 10
  const currentForecast = calculateRoundForecast(gameState, { market: { productionQuantity: 150 } }, DEFAULT_FACTORY_SETTINGS)
  const currentActualProduction = currentForecast.forecast.actualProduction

  const previewLow = buildPreview(gameState, currentForecast, 50, 10)
  const previewHigh = buildPreview(gameState, currentForecast, 220, 10)

  assert.equal(currentForecast.forecast.actualProduction, currentActualProduction)
  assert.notEqual(previewLow.forecast.actualProduction, previewHigh.forecast.actualProduction)
})

test('preview F: preview physical FG uses round N closing FG + preview actualProduction - preview deliveries', () => {
  const gameState = createInitialGameState()
  gameState.market.batchSize = 10
  const currentForecast = calculateRoundForecast(gameState, { market: { productionQuantity: 150 } }, DEFAULT_FACTORY_SETTINGS)
  const roundNClosingFg = currentForecast.forecast.inventory.closingFinishedGoodsInventory

  const preview = buildPreview(gameState, currentForecast, 220, 10)

  assert.equal(preview.forecast.inventory.openingFinishedGoodsInventory, roundNClosingFg)
  assert.equal(
    preview.forecast.inventory.closingFinishedGoodsInventory,
    roundNClosingFg + preview.forecast.actualProduction - preview.forecast.deliveries,
  )
})

test('preview batch-size changes do not alter the physical opening finished-goods inventory', () => {
  const gameState = createInitialGameState()
  gameState.inventory.finishedGoodsContainers = 75
  const currentForecast = calculateRoundForecast(gameState, { market: { productionQuantity: 150 } }, DEFAULT_FACTORY_SETTINGS)

  const previewQ5 = buildPreview(gameState, currentForecast, 150, 5)
  const previewQ20 = buildPreview(gameState, currentForecast, 150, 20)

  assert.equal(
    previewQ5.forecast.inventory.openingFinishedGoodsInventory,
    previewQ20.forecast.inventory.openingFinishedGoodsInventory,
  )
})

test('preview G: building a preview does not mutate gameState or the current forecast', () => {
  const gameState = createInitialGameState()
  gameState.market.batchSize = 10
  const currentForecast = calculateRoundForecast(gameState, { market: { productionQuantity: 150 } }, DEFAULT_FACTORY_SETTINGS)
  const gameStateSnapshot = JSON.stringify(gameState)
  const forecastSnapshot = JSON.stringify(currentForecast)

  buildPreview(gameState, currentForecast, 220, 5)

  assert.equal(JSON.stringify(gameState), gameStateSnapshot)
  assert.equal(JSON.stringify(currentForecast), forecastSnapshot)
})

test('preview H: preview matches the real round N+1 forecast built from the same advanceRound decision', () => {
  const gameState = createInitialGameState()
  gameState.market.batchSize = 5
  const currentForecast = calculateRoundForecast(gameState, { market: { productionQuantity: 150 } }, DEFAULT_FACTORY_SETTINGS)

  const preview = buildPreview(gameState, currentForecast, 220, 10)

  const { nextGameState: realNextGameState } = advanceRoundState({
    gameState,
    forecast: currentForecast,
    totalRounds: 12,
    checkProductionDecision: { round: gameState.round, productionQuantity: 220, batchSize: 10 },
  })
  const realNextRoundForecast = calculateRoundForecast(realNextGameState, {}, DEFAULT_FACTORY_SETTINGS)

  assert.equal(preview.forecast.actualProduction, realNextRoundForecast.forecast.actualProduction)
  assert.equal(preview.forecast.deliveries, realNextRoundForecast.forecast.deliveries)
  assert.equal(
    preview.forecast.inventory.closingFinishedGoodsInventory,
    realNextRoundForecast.forecast.inventory.closingFinishedGoodsInventory,
  )
  assert.equal(preview.forecast.capacityByDepartment.machining, realNextRoundForecast.forecast.capacityByDepartment.machining)
  assert.equal(preview.forecast.finance.result, realNextRoundForecast.forecast.finance.result)
})
