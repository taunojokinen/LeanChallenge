import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_FACTORY_SETTINGS } from './defaultFactorySettings.js'
import { createInitialGameState } from './initialGameState.js'
import { calculateRoundForecast } from '../forecast/model.js'

function assertFinite(value, label) {
  assert.equal(Number.isFinite(Number(value)), true, `${label} should be finite`)
}

test('new game starts from round 1 canonical state', () => {
  const gameState = createInitialGameState()

  assert.equal(gameState.round, 1)
  assert.equal(gameState.market.activeVariations, 20)
  assert.equal(gameState.production.machiningMachines, 2)
  assert.equal(gameState.staffing.machining, 10)
  assert.equal(gameState.staffing.assembly, 25)
  assert.equal(gameState.staffing.shipping, 5)
  assert.equal(gameState.factory.totalAreaM2, 4000)
})

test('CHECK forecast can be created from round 1 game state', () => {
  const gameState = createInitialGameState()
  const checkStaffing = {
    assembly: 26,
    shipping: 6,
  }

  const forecast = calculateRoundForecast(
    {
      ...gameState,
      checkStaffingDecision: {
        round: gameState.round,
        staffing: checkStaffing,
      },
    },
    {
      staffing: checkStaffing,
    },
    DEFAULT_FACTORY_SETTINGS,
  )

  assert.equal(forecast.round, 1)
  assert.equal(forecast.decisions.market.activeVariationCount, 20)
  assert.equal(forecast.forecast.staffing.machining, 10)
  assert.equal(forecast.forecast.staffing.assembly, 26)
  assert.equal(forecast.forecast.staffing.shipping, 6)
  assertFinite(forecast.summary.demand, 'check demand')
  assertFinite(forecast.summary.plantCapacity, 'check plant capacity')
  assertFinite(forecast.summary.result, 'check result')
})

test('ACT forecast can be created from same round 1 game state', () => {
  const gameState = createInitialGameState()
  const decisions = {
    market: {
      price: 25500,
      addedVariations: 1,
      productionQuantity: 150,
    },
  }

  const forecast = calculateRoundForecast(gameState, decisions, DEFAULT_FACTORY_SETTINGS)

  assert.equal(forecast.round, 1)
  assert.equal(forecast.decisions.market.activeVariationCount, 20)
  assertFinite(forecast.summary.demand, 'act demand')
  assertFinite(forecast.summary.plantCapacity, 'act plant capacity')
  assertFinite(forecast.summary.productionQuantity, 'act production quantity')
  assertFinite(forecast.summary.finishedGoodsInventory, 'act inventory')
  assertFinite(forecast.summary.revenue, 'act revenue')
  assertFinite(forecast.summary.result, 'act result')
})

test('forecast flow does not mutate DEFAULT_FACTORY_SETTINGS', () => {
  const baselineSettings = structuredClone(DEFAULT_FACTORY_SETTINGS)
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)

  calculateRoundForecast(
    {
      ...gameState,
      fiveSDecision: {
        round: 1,
        investedHours: { machining: 100, assembly: 80, shipping: 60 },
      },
    },
    {
      staffing: {
        assembly: 28,
        shipping: 7,
      },
      market: {
        price: 26000,
        addedVariations: 1,
      },
    },
    DEFAULT_FACTORY_SETTINGS,
  )

  assert.deepStrictEqual(DEFAULT_FACTORY_SETTINGS, baselineSettings)
})
