import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_FACTORY_SETTINGS } from '../../shared/factory-settings/defaultFactorySettings.js'
import { createInitialGameState } from '../../shared/factory-settings/initialGameState.js'
import forecastInitialState from '../../shared/test-fixtures/forecastInitialState.json' with { type: 'json' }

test('backend initial game state matches the complete fixed-seed frontend fixture', () => {
  const state = createInitialGameState(DEFAULT_FACTORY_SETTINGS, { historySeed: 123456789 })

  assert.deepEqual(state, forecastInitialState)
  assert.equal(state.historySeed, 123456789)
  assert.deepEqual(state.initialFinancialHistory.map((entry) => entry.round), [-2, -1, 0])
  assert.deepEqual(state.initialFinancialHistory.map((entry) => entry.incomeStatement.salesUnits), [140, 145, 150])
  assert.deepEqual(state.initialFinancialHistory.map((entry) => entry.incomeStatement.materials), [1680000, 1740000, 1800000])
  assert.equal(state.finance.cash, 50000)
  assert.ok(Math.abs(state.finance.bankLoans - 3002481.044921875) < 1e-7)
  assert.ok(Math.abs(state.finance.equity - 2073975) < 1e-7)
  assert.deepEqual(state.finance, state.initialFinancialHistory.at(-1).finance)
})

test('custom factory settings and a zero history seed are preserved', () => {
  const settings = structuredClone(DEFAULT_FACTORY_SETTINGS)
  settings.initialState.round = 3
  settings.initialState.market = {
    price: 28000,
    activeVariations: 24,
    productionRunsPerVariation: 3,
  }
  settings.initialState.production.machiningMachines = 3
  settings.initialState.staffing = { assembly: 20, shipping: 6 }
  settings.initialState.factory.totalAreaM2 = 5000
  const originalSettings = structuredClone(settings)

  const state = createInitialGameState(settings, { historySeed: 0 })

  assert.equal(state.historySeed, 0)
  assert.equal(state.round, 3)
  assert.deepEqual(state.market, {
    price: 28000,
    activeVariations: 24,
    productionRunsPerVariation: 3,
  })
  assert.equal(state.production.machiningMachines, 3)
  assert.deepEqual(state.staffing, { machining: 15, assembly: 20, shipping: 6 })
  assert.equal(state.factory.totalAreaM2, 5000)
  assert.deepEqual(settings, originalSettings)
  state.market.price = 1
  assert.equal(settings.initialState.market.price, 28000)
})

test('configured production changes the known initial financial history', () => {
  const settings = structuredClone(DEFAULT_FACTORY_SETTINGS)
  settings.production.initialProductionQuantity = 134

  const state = createInitialGameState(settings, { historySeed: 123456789 })

  assert.equal(state.historySeed, 123456789)
  assert.deepEqual(state.initialFinancialHistory.map((entry) => entry.incomeStatement.salesUnits), [124, 129, 134])
  assert.deepEqual(state.initialFinancialHistory.map((entry) => entry.incomeStatement.materials), [1488000, 1548000, 1608000])
})

test('Node globals support cloning and generating an unspecified history seed', () => {
  assert.equal(typeof globalThis.structuredClone, 'function')
  assert.equal(typeof globalThis.crypto?.getRandomValues, 'function')

  const state = createInitialGameState()
  assert.ok(Number.isInteger(state.historySeed))
  assert.ok(state.historySeed >= 0 && state.historySeed <= 0xffffffff)
  assert.notStrictEqual(state.market, DEFAULT_FACTORY_SETTINGS.initialState.market)
  assert.deepEqual(
    createInitialGameState(DEFAULT_FACTORY_SETTINGS, { historySeed: state.historySeed }),
    state,
  )
})
