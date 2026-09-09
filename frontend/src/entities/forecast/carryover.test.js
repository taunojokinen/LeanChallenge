import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_FACTORY_SETTINGS } from '../factory-settings/defaultFactorySettings.js'
import { createInitialGameState } from '../factory-settings/initialGameState.js'
import { calculateRoundForecast } from './model.js'
import { buildCanonicalCarryoverState } from './carryover.js'

test('forecast exposes a minimal canonical carryover state', () => {
  const gameState = createInitialGameState()
  const forecast = calculateRoundForecast(gameState)
  const carryover = forecast.closingState.canonical

  assert.equal(carryover.round, gameState.round)
  assert.equal(carryover.market.activeVariations, forecast.closingState.market.activeVariations)
  assert.equal(carryover.production.machiningMachines, forecast.closingState.production.machiningMachines)
  assert.equal(carryover.staffing.assembly, forecast.closingState.staffing.assembly)
  assert.equal(carryover.staffing.shipping, forecast.closingState.staffing.shipping)
  assert.equal(carryover.finance.cash, forecast.closingState.finance.cash)
  assert.equal(carryover.finance.bankLoans, forecast.closingState.finance.bankLoans)
  assert.equal(carryover.inventory.finishedGoodsContainers, forecast.closingState.inventory.finishedGoodsContainers)

  assert.equal('machining' in carryover.staffing, false)
  assert.equal('finishedGoodsBookValue' in carryover.inventory, false)
  assert.equal('inventoryBookValue' in carryover.finance, false)
  assert.equal('fixedAssets' in carryover.finance, false)
  assert.equal('totalAssets' in carryover.finance, false)
  assert.equal('totalLiabilitiesAndEquity' in carryover.finance, false)
  assert.equal('incomeStatement' in carryover.finance, false)
  assert.equal('overdraft' in carryover.finance, false)
})

test('canonical carryover excludes forecast, decision, and snapshot fields', () => {
  const gameState = createInitialGameState()
  const forecast = calculateRoundForecast(gameState, {
    market: { productionQuantity: 100, addedVariations: 1 },
  })
  const carryover = buildCanonicalCarryoverState({
    round: gameState.round,
    closingState: forecast.closingState,
  })

  assert.equal('productionQuantity' in carryover, false)
  assert.equal('capacity' in carryover, false)
  assert.equal('demand' in carryover, false)
  assert.equal('knl' in carryover, false)
  assert.equal('usedArea' in carryover.factory, false)
  assert.equal('freeArea' in carryover.factory, false)
  assert.equal('forecast' in carryover, false)
  assert.equal('decisions' in carryover, false)
  assert.equal('investmentsSnapshot' in carryover, false)
  assert.equal('productionSnapshot' in carryover, false)
})

test('machining staffing remains derived from canonical machine count', () => {
  const gameState = createInitialGameState()
  const forecast = calculateRoundForecast({
    ...gameState,
    investmentsDecision: {
      round: gameState.round,
      investments: [{ type: 'new-machine', quantity: 1 }],
    },
  })
  const carryover = forecast.closingState.canonical

  assert.equal(
    forecast.closingState.staffing.machining,
    carryover.production.machiningMachines * DEFAULT_FACTORY_SETTINGS.production.workersPerMachine,
  )
})

test('canonical carryover does not change the current round', () => {
  const gameState = createInitialGameState()
  const forecast = calculateRoundForecast(gameState)

  assert.equal(forecast.closingState.canonical.round, 1)
})
