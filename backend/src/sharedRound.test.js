import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_FACTORY_SETTINGS } from '../../shared/factory-settings/defaultFactorySettings.js'
import { calculateRoundForecast } from '../../shared/forecast/model.js'
import { advanceRoundState } from '../../shared/game-round/advanceRound.js'
import initialState from '../../shared/test-fixtures/forecastInitialState.json' with { type: 'json' }

const decisions = {
  market: { price: 25500, addedVariations: 1, productionQuantity: 200 },
}

function forecastRound(gameState) {
  return calculateRoundForecast(gameState, decisions, DEFAULT_FACTORY_SETTINGS)
}

test('backend advances a known round with canonical state and confirmed history', () => {
  const gameState = globalThis.structuredClone(initialState)
  const result = advanceRoundState({
    gameState,
    forecast: forecastRound(gameState),
    totalRounds: 12,
  })
  const next = result.nextGameState

  assert.equal(result.confirmedRound, 1)
  assert.equal(result.isGameOver, false)
  assert.equal(result.isGameComplete, false)
  assert.deepEqual({
    round: next.round,
    market: next.market,
    production: next.production,
    staffing: next.staffing,
    factory: next.factory,
    inventory: next.inventory,
    finance: next.finance,
    historySeed: next.historySeed,
  }, {
    round: 2,
    market: { price: 25500, activeVariations: 20, productionRunsPerVariation: 2, batchSize: 20 },
    production: { machiningMachines: 4 },
    staffing: { assembly: 38, shipping: 5 },
    factory: { totalAreaM2: 4250, dispatchM2: 250, officeAndSocialM2: 200, expansionsCount: 0 },
    inventory: { finishedGoodsContainers: 100 },
    finance: {
      cash: 50000,
      bankLoans: 3168762.0579833975,
      equity: 1816842.1912841806,
      otherLiabilities: 900000,
      machineryBookValue: 406234.9921875,
      buildingsBookValue: 2709369.257080078,
      finishedGoodsInventoryBookValue: 2000000,
      rawMaterialInventoryBookValue: 720000,
    },
    historySeed: 123456789,
  })
  assert.equal(next.lean.fiveS.departments.machining.effectiveHours, 0)
  assert.equal(next.lean.methods.machining.smed, 0)
  assert.deepEqual(next.initialFinancialHistory.map((entry) => entry.round), [-2, -1, 0])
  assert.equal(next.initialFinancialHistory[2].finance.equity, 2073975.000000001)
  assert.equal(next.history.length, 1)
  assert.deepEqual({
    round: next.history[0].round,
    incomeStatement: next.history[0].incomeStatement,
    market: next.history[0].market,
    production: next.history[0].production,
    inventory: next.history[0].inventory,
    equity: next.history[0].finance.equity,
  }, {
    round: 1,
    incomeStatement: {
      revenue: 3825000,
      materials: 1800000,
      labor: 1653750,
      fixedCosts: 500000,
      inventoryChange: 0,
      depreciation: 90851.79565429688,
      interest: 37531.01306152343,
      result: -257132.8087158203,
    },
    market: { price: 25500, activeVariations: 20 },
    production: { actualProduction: 150, deliveries: 150, demand: 180, lostSalesUnits: 30 },
    inventory: { finishedGoodsContainers: 100 },
    equity: 1816842.1912841806,
  })
})

test('CHECK batch decision affects the next round but not confirmed history', () => {
  const gameState = globalThis.structuredClone(initialState)
  const result = advanceRoundState({
    gameState,
    forecast: forecastRound(gameState),
    totalRounds: 12,
    checkProductionDecision: { round: 1, batchSize: 5 },
  })

  assert.equal(result.nextGameState.round, 2)
  assert.equal(result.nextGameState.market.batchSize, 5)
  assert.deepEqual(result.nextGameState.history[0].production, {
    actualProduction: 150, deliveries: 150, demand: 180, lostSalesUnits: 30,
  })
  assert.equal(result.nextGameState.history[0].incomeStatement.result, -257132.8087158203)
})

test('calculated bankruptcy prevents another confirmation', () => {
  const gameState = globalThis.structuredClone(initialState)
  gameState.finance.equity = 1
  const forecast = forecastRound(gameState)
  const result = advanceRoundState({ gameState, forecast, totalRounds: 12 })

  assert.equal(result.nextGameState.finance.equity, -257131.8087158203)
  assert.equal(result.nextGameState.round, 1)
  assert.equal(result.isGameOver, true)
  assert.equal(result.isGameComplete, true)
  assert.deepEqual(result.nextGameState.completion, { reason: 'bankruptcy', confirmedRound: 1 })
  assert.throws(() => advanceRoundState({
    gameState: result.nextGameState, forecast, totalRounds: 12,
  }), /completed game/)
})

test('round limit prevents round thirteen and another confirmation', () => {
  const gameState = globalThis.structuredClone(initialState)
  gameState.round = 12
  const forecast = forecastRound(gameState)
  const result = advanceRoundState({
    gameState,
    forecast,
    totalRounds: 12,
    checkProductionDecision: { round: 12, batchSize: 5 },
  })

  assert.equal(result.nextGameState.round, 12)
  assert.equal(result.nextGameState.market.batchSize, 20)
  assert.equal(result.nextGameState.finance.equity, 1816842.1912841806)
  assert.equal(result.nextGameState.history.length, 1)
  assert.equal(result.nextGameState.history[0].round, 12)
  assert.equal(result.isGameOver, false)
  assert.equal(result.isGameComplete, true)
  assert.deepEqual(result.nextGameState.completion, { reason: 'round-limit', confirmedRound: 12 })
  assert.throws(() => advanceRoundState({
    gameState: result.nextGameState, forecast, totalRounds: 12,
  }), /completed game/)
})
