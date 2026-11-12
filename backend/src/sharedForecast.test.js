import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateKNL } from '../../shared/forecast/knl.js'
import { calculateFactoryKnl } from '../../shared/forecast/factoryKnl.js'
import { calculateDevelopedKnlValue } from '../../shared/forecast/knlDevelopment.js'
import { DEFAULT_FACTORY_SETTINGS } from '../../shared/factory-settings/defaultFactorySettings.js'
import { calculateFinancingStructure } from '../../shared/factory-settings/financingStructure.js'
import { calculateNextFiveSState } from '../../shared/five-s/model.js'
import { calculateFactorySpace, calculateMinimumFinishedGoodsContainers } from '../../shared/factory-space/model.js'
import { calculateRoundForecast, calculateKNL as calculateForecastKNL } from '../../shared/forecast/model.js'
import forecastInitialState from '../../shared/test-fixtures/forecastInitialState.json' with { type: 'json' }

const forecastDecisions = {
  market: { price: 25500, addedVariations: 1, productionQuantity: 200 },
}

test('backend imports shared KNL calculations as ES modules', () => {
  assert.equal(calculateKNL(80, 90, 95), 0.684)
  assert.equal(calculateForecastKNL(80, 90, 95), 0.684)
  assert.deepEqual(calculateFactoryKnl({
    machining: { kPct: 80, nPct: 90, lPct: 95, capacityContainers: 100 },
  }), { kPct: 80, nPct: 90, lPct: 95, knl: 0.684 })
  assert.equal(calculateDevelopedKnlValue({
    x0: 0.65,
    cumulativeHours: 400,
    knlMaximum: 0.95,
    knlHalfLifeHours: 400,
  }), 0.8)
})

test('backend forecast matches the frontend baseline regression reference', () => {
  const forecast = calculateRoundForecast(
    globalThis.structuredClone(forecastInitialState),
    forecastDecisions,
    DEFAULT_FACTORY_SETTINGS,
  )

  assert.deepEqual({
    demand: forecast.summary.demand,
    actualProduction: forecast.summary.actualProduction,
    deliveries: forecast.summary.deliveries,
    machiningKnl: forecast.forecast.knl.machining.knl,
    result: forecast.summary.result,
    market: forecast.closingState.canonical.market,
    production: forecast.closingState.canonical.production,
    inventory: forecast.closingState.canonical.inventory,
    bankLoans: forecast.closingState.canonical.finance.bankLoans,
    equity: forecast.closingState.canonical.finance.equity,
  }, {
    demand: 180,
    actualProduction: 150,
    deliveries: 150,
    machiningKnl: 0.4327615384615385,
    result: -257132.8087158203,
    market: {
      price: 25500,
      activeVariations: 20,
      productionRunsPerVariation: 2,
      batchSize: 20,
    },
    production: { machiningMachines: 4 },
    inventory: { finishedGoodsContainers: 100 },
    bankLoans: 3168762.0579833975,
    equity: 1816842.1912841806,
  })
})

test('backend forecast matches the frontend investment and Lean regression reference', () => {
  const gameState = globalThis.structuredClone(forecastInitialState)
  gameState.fiveSDecision = {
    round: 1,
    investedHours: { machining: 100, assembly: 80, shipping: 60 },
  }
  gameState.projectsDecision = {
    round: 1,
    selections: [{ department: 'machining', method: 'smed', investedHours: 20 }],
  }
  gameState.investmentsDecision = {
    round: 1,
    investments: [
      { type: 'new-machine', quantity: 1, cost: 500000 },
      { type: 'factory-expansion', quantity: 1, cost: 1000000 },
    ],
  }
  const forecast = calculateRoundForecast(gameState, forecastDecisions, DEFAULT_FACTORY_SETTINGS)
  const canonical = forecast.closingState.canonical

  assert.deepEqual({
    newMachines: forecast.forecast.investments.newMachines,
    machiningCapacity: forecast.forecast.capacityByDepartment.machining,
    result: forecast.summary.result,
    machiningFiveSHours: canonical.lean.fiveS.departments.machining.effectiveHours,
    assemblyFiveSHours: canonical.lean.fiveS.departments.assembly.effectiveHours,
    shippingFiveSHours: canonical.lean.fiveS.departments.shipping.effectiveHours,
    machiningSmedHours: canonical.lean.methods.machining.smed,
    machines: canonical.production.machiningMachines,
    totalAreaM2: canonical.factory.totalAreaM2,
    equity: canonical.finance.equity,
    bankLoans: canonical.finance.bankLoans,
  }, {
    newMachines: 1,
    machiningCapacity: 199,
    result: -330382.8087158203,
    machiningFiveSHours: 100,
    assemblyFiveSHours: 80,
    shippingFiveSHours: 60,
    machiningSmedHours: 20,
    machines: 5,
    totalAreaM2: 5250,
    equity: 1743592.1912841806,
    bankLoans: 4682412.0579833975,
  })
})

test('backend calculates financing with shared default settings', () => {
  const result = calculateFinancingStructure({
    nonCashAssets: 5641875,
    equity: 2073975,
    rawMaterialCosts: 1320000,
  })

  assert.equal(result.targetCash, DEFAULT_FACTORY_SETTINGS.finance.targetCash)
  assert.equal(result.otherLiabilities, 660000)
  assert.equal(result.cash, 50000)
  assert.equal(result.interestBearingDebt, 2957900)
  assert.equal(result.totalAssets, 5691875)
  assert.equal(result.totalEquityAndLiabilities, 5691875)
})

test('backend calculates debt-free financing with shared settings', () => {
  const result = calculateFinancingStructure({
    nonCashAssets: 1000000,
    equity: 1700000,
    rawMaterialCosts: 200000,
    factorySettings: DEFAULT_FACTORY_SETTINGS,
  })

  assert.equal(result.financingNeed, -750000)
  assert.equal(result.interestBearingDebt, 0)
  assert.equal(result.cash, 800000)
  assert.equal(result.otherLiabilities, 100000)
  assert.equal(result.totalAssets, 1800000)
  assert.equal(result.totalEquityAndLiabilities, 1800000)
})

test('backend calculates shared 5S investment and decay', () => {
  assert.deepEqual(calculateNextFiveSState(474, 237), {
    currentEffectiveHours: 474,
    investedHours: 237,
    nextEffectiveHours: 711,
    currentLevel: 2,
    nextLevel: 3,
  })
  assert.equal(calculateNextFiveSState(600, 0).nextEffectiveHours, 570)
  assert.equal(calculateNextFiveSState(1599, 50).nextEffectiveHours, 1600)
})

test('backend calculates shared factory space and minimum inventory', () => {
  const minimum = calculateMinimumFinishedGoodsContainers({
    variations: 20,
    batchSize: 20,
    machineCount: 4,
  })
  assert.equal(minimum, 50)
  assert.deepEqual(calculateFactorySpace({
    machineCount: 4,
    assemblyWorkers: 10,
    shippingWorkers: 2,
    dispatchM2: 250,
    officeAndSocialM2: 200,
    finishedGoodsContainers: 40,
    minimumFinishedGoodsContainers: minimum,
    totalAreaM2: 3000,
  }), {
    totalArea: 3000,
    machiningArea: 1000,
    assemblyArea: 250,
    shippingWorkerArea: 50,
    shippingArea: 250,
    dispatchArea: 250,
    officeAndSocialArea: 200,
    officeArea: 200,
    finishedGoodsContainers: 50,
    finishedGoodsArea: 750,
    totalUsed: 2500,
    freeArea: 500,
  })
})
