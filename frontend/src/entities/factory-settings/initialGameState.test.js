import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_FACTORY_SETTINGS } from './defaultFactorySettings.js'
import { createInitialGameState } from './initialGameState.js'
import { calculateRoundForecast } from '../forecast/model.js'

function cloneSettings(overrides = {}) {
  return {
    ...structuredClone(DEFAULT_FACTORY_SETTINGS),
    ...overrides,
  }
}

test('createInitialGameState clones the default initial state', () => {
  const initialGameState = createInitialGameState()

  assert.notStrictEqual(initialGameState, DEFAULT_FACTORY_SETTINGS.initialState)
  assert.equal(initialGameState.round, 1)
  assert.deepStrictEqual(initialGameState.market, {
    price: 25000,
    activeVariations: 20,
    productionRunsPerVariation: 2,
  })
  assert.deepStrictEqual(initialGameState.production, {
    machiningMachines: 2,
  })
  assert.equal(initialGameState.staffing.machining, 10)
  assert.equal(initialGameState.staffing.assembly, 38)
  assert.equal(initialGameState.staffing.shipping, 5)
  assert.equal(initialGameState.factory.totalAreaM2, 4000)
  assert.equal(initialGameState.finance.cash, 50000)
  assert.equal(initialGameState.finance.bankLoans, 2957900)
  assert.equal(initialGameState.finance.equity, 2073975)
  assert.equal(initialGameState.finance.otherLiabilities, 660000)
  assert.equal(initialGameState.finance.machineryBookValue, 498750)
  assert.equal(initialGameState.finance.buildingsBookValue, 2998125)
  assert.equal(initialGameState.finance.finishedGoodsInventoryBookValue, 1645000)
  assert.equal(initialGameState.finance.rawMaterialInventoryBookValue, 500000)
  assert.equal(initialGameState.finance.inventoryBookValue, 2145000)
  assert.equal(initialGameState.finance.incomeStatement.depreciation, 103125)
})

test('createInitialGameState respects settings overrides', () => {
  const customSettings = cloneSettings({
    initialState: {
      ...structuredClone(DEFAULT_FACTORY_SETTINGS.initialState),
      round: 3,
      market: {
        price: 28000,
        activeVariations: 24,
        productionRunsPerVariation: 3,
      },
      production: {
        machiningMachines: 3,
      },
      staffing: {
        assembly: 20,
        shipping: 6,
      },
      factory: {
        ...structuredClone(DEFAULT_FACTORY_SETTINGS.initialState.factory),
        totalAreaM2: 5000,
      },
    },
  })

  const initialGameState = createInitialGameState(customSettings)

  assert.equal(initialGameState.round, 3)
  assert.equal(initialGameState.market.price, 28000)
  assert.equal(initialGameState.market.activeVariations, 24)
  assert.equal(initialGameState.market.productionRunsPerVariation, 3)
  assert.equal(initialGameState.production.machiningMachines, 3)
  assert.equal(initialGameState.staffing.machining, 15)
  assert.equal(initialGameState.staffing.assembly, 20)
  assert.equal(initialGameState.staffing.shipping, 6)
  assert.equal(initialGameState.factory.totalAreaM2, 5000)
})

test('createInitialGameState returns deep immutable clones per call', () => {
  const stateA = createInitialGameState()
  const stateB = createInitialGameState()

  stateA.market.price = 99999
  stateA.staffing.assembly = 99
  stateA.lean.fiveS.departments.machining.effectiveHours = 1
  stateA.investments.setupAutomation.installedMachineIds.push(77)

  assert.equal(DEFAULT_FACTORY_SETTINGS.initialState.market.price, 25000)
  assert.equal(DEFAULT_FACTORY_SETTINGS.initialState.staffing.assembly, 38)
  assert.equal(
    DEFAULT_FACTORY_SETTINGS.initialState.lean.fiveS.departments.machining.effectiveHours,
    569,
  )
  assert.deepStrictEqual(
    DEFAULT_FACTORY_SETTINGS.initialState.investments.setupAutomation.installedMachineIds,
    [],
  )

  assert.equal(stateB.market.price, 25000)
  assert.equal(stateB.staffing.assembly, 38)
  assert.equal(stateB.lean.fiveS.departments.machining.effectiveHours, 569)
  assert.deepStrictEqual(stateB.investments.setupAutomation.installedMachineIds, [])
})

test('createInitialGameState does not add derived forecast values', () => {
  const initialGameState = createInitialGameState()

  const derivedKeys = [
    'demand',
    'plantCapacity',
    'bottleneck',
    'knl',
    'actualProduction',
    'revenue',
    'operatingProfit',
    'solvency',
    'debtCapacity',
    'freeFactorySpace',
  ]

  derivedKeys.forEach((key) => {
    assert.equal(Object.prototype.hasOwnProperty.call(initialGameState, key), false)
  })

  assert.equal(Object.prototype.hasOwnProperty.call(initialGameState, 'productionSnapshot'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(initialGameState, 'investmentsSnapshot'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(initialGameState, 'balanceSheetSnapshot'), false)
})

test('createInitialGameState works with calculateRoundForecast without attached snapshots', () => {
  const gameState = createInitialGameState()

  const forecast = calculateRoundForecast(gameState, {}, DEFAULT_FACTORY_SETTINGS)

  assert.equal(forecast.round, 1)
  assert.equal(forecast.decisions.market.activeVariationCount, 20)
  assert.equal(forecast.decisions.market.runsPerVariation, 2)
  assert.equal(forecast.forecast.staffing.machining, 10)
  assert.equal(forecast.forecast.staffing.assembly, 38)
  assert.equal(forecast.forecast.staffing.shipping, 5)
  assert.equal(forecast.forecast.space.totalArea, 4000)
})

test('round-1 forecast has no NaN or undefined in essential outputs', () => {
  const gameState = createInitialGameState()
  const forecast = calculateRoundForecast(gameState, {}, DEFAULT_FACTORY_SETTINGS)

  const essentialValues = {
    demand: forecast.summary.demand,
    machiningK: forecast.forecast.knl.machining.kPct,
    machiningN: forecast.forecast.knl.machining.nPct,
    machiningL: forecast.forecast.knl.machining.lPct,
    machiningKNL: forecast.forecast.knl.machining.knl,
    machiningCapacity: forecast.forecast.capacityByDepartment.machining,
    assemblyCapacity: forecast.forecast.capacityByDepartment.assembly,
    shippingCapacity: forecast.forecast.capacityByDepartment.shipping,
    plantCapacity: forecast.summary.plantCapacity,
    avgFinishedGoodsInventory: forecast.forecast.inventory.averageFinishedGoodsInventory,
    finishedGoodsValue: forecast.forecast.inventory.finishedGoodsValue,
    freeFactorySpace: forecast.summary.freeFactorySpace,
    result: forecast.summary.result,
  }

  Object.entries(essentialValues).forEach(([key, value]) => {
    assert.notEqual(value, undefined, `${key} is undefined`)
    assert.equal(Number.isFinite(Number(value)), true, `${key} is not finite`)
  })
})

test('custom initial state values affect forecast inputs and capacities', () => {
  const customSettings = cloneSettings({
    initialState: {
      ...structuredClone(DEFAULT_FACTORY_SETTINGS.initialState),
      market: {
        ...structuredClone(DEFAULT_FACTORY_SETTINGS.initialState.market),
        activeVariations: 25,
      },
      production: {
        ...structuredClone(DEFAULT_FACTORY_SETTINGS.initialState.production),
        machiningMachines: 3,
      },
      staffing: {
        assembly: 30,
        shipping: 5,
      },
      factory: {
        ...structuredClone(DEFAULT_FACTORY_SETTINGS.initialState.factory),
        totalAreaM2: 5000,
      },
    },
  })

  const baselineForecast = calculateRoundForecast(createInitialGameState(), {}, DEFAULT_FACTORY_SETTINGS)
  const customGameState = createInitialGameState(customSettings)
  const customForecast = calculateRoundForecast(customGameState, {}, customSettings)

  assert.equal(customForecast.decisions.market.activeVariationCount, 25)
  assert.equal(customForecast.forecast.staffing.machining, 15)
  assert.equal(customForecast.forecast.staffing.assembly, 30)
  assert.equal(customForecast.forecast.space.totalArea, 5000)
  assert.equal(
    customForecast.forecast.capacityByDepartment.machining >
      baselineForecast.forecast.capacityByDepartment.machining,
    true,
  )
})