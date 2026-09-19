import test from 'node:test'
import assert from 'node:assert/strict'
import fiveSSnapshot from '../../mocks/fiveSSnapshot.json' with { type: 'json' }
import projectsSnapshot from '../../mocks/projectsSnapshot.json' with { type: 'json' }
import investmentsSnapshot from '../../mocks/investmentsSnapshot.json' with { type: 'json' }
import balanceSheetSnapshot from '../../mocks/balanceSheetSnapshot.json' with { type: 'json' }
import productionSnapshot from '../../mocks/productionSnapshot.json' with { type: 'json' }
import { DEFAULT_FACTORY_SETTINGS } from '../factory-settings/defaultFactorySettings.js'
import { createInitialGameState } from '../factory-settings/initialGameState.js'
import {
  calculateAllowedNewVariations,
  calculateDemandPerVariation,
  calculateKNL,
  calculateRoundForecast,
} from './model.js'

function createGameState(overrides = {}) {
  return {
    round: 4,
    fiveSSnapshot,
    projectsSnapshot,
    investmentsSnapshot,
    balanceSheetSnapshot,
    productionSnapshot,
    fiveSDecision: {
      round: 4,
      investedHours: { machining: 100, assembly: 80, shipping: 70 },
    },
    projectsDecision: {
      round: 4,
      selections: [
        { department: 'machining', method: 'smed', investedHours: 200, cost: 20000 },
        { department: 'assembly', method: 'method-development', investedHours: 50, cost: 5000 },
      ],
    },
    investmentsDecision: {
      round: 4,
       investments: [
         { type: 'new-machine', quantity: 1, cost: 1 },
         { type: 'factory-expansion', quantity: 1, cost: 2 },
       ],
    },
    ...overrides,
  }
}

function cloneSettings(overrides = {}) {
  return {
    ...structuredClone(DEFAULT_FACTORY_SETTINGS),
    ...overrides,
  }
}

test('KNL equals K x N x L', () => {
  const knl = calculateKNL(80, 90, 95)
  assert.equal(knl, 0.684)
})

test('KNL identity case 70 x 90 x 70 equals 44.1 percent', () => {
  const knl = calculateKNL(70, 90, 70)
  assert.ok(Math.abs(knl - 0.441) < 1e-12)
})

test('bottleneck equals the smallest department capacity', () => {
  const forecast = calculateRoundForecast(createGameState())
  const capacities = forecast.forecast.capacityByDepartment
  const min = Math.min(capacities.machining, capacities.assembly, capacities.shipping)
  assert.equal(forecast.forecast.plantCapacity, min)
})

test('deliveries preserve the default minimum finished-goods target', () => {
  const forecast = calculateRoundForecast(createGameState())
  const inventory = forecast.forecast.inventory
  assert.equal(
    forecast.forecast.deliveries,
    Math.max(0, Math.min(forecast.forecast.demand, inventory.openingFinishedGoodsInventory + forecast.forecast.actualProduction - inventory.targetFinishedGoodsInventory)),
  )
})

test('capacity gap creates lost sales', () => {
  const forecast = calculateRoundForecast(
    createGameState({
      projectsDecision: { round: 4, selections: [] },
    }),
    {
      staffing: {
        assembly: 1,
        shipping: 1,
      },
      market: {
        price: 15000,
        newVariations: 2,
      },
    },
  )

  assert.equal(forecast.forecast.lostSalesUnits > 0, true)
})

test('assembly staffing increases assembly capacity', () => {
  const gameState = createGameState()
  const lowStaff = calculateRoundForecast(gameState, {
    staffing: {
      assembly: 5,
      shipping: 10,
    },
  })
  const highStaff = calculateRoundForecast(gameState, {
    staffing: {
      assembly: 15,
      shipping: 10,
    },
  })

  assert.equal(
    highStaff.forecast.capacityByDepartment.assembly > lowStaff.forecast.capacityByDepartment.assembly,
    true,
  )
})

test('assembly staffing increases labor cost and area usage', () => {
  const gameState = createGameState()
  const lowStaff = calculateRoundForecast(gameState, {
    staffing: {
      assembly: 5,
      shipping: 10,
    },
  })
  const highStaff = calculateRoundForecast(gameState, {
    staffing: {
      assembly: 15,
      shipping: 10,
    },
  })

  assert.equal(highStaff.forecast.finance.labor > lowStaff.forecast.finance.labor, true)
  assert.equal(highStaff.forecast.space.assemblyArea > lowStaff.forecast.space.assemblyArea, true)
})

test('shipping staffing affects shipping capacity', () => {
  const gameState = createGameState()
  const lowStaff = calculateRoundForecast(gameState, {
    staffing: {
      assembly: 10,
      shipping: 2,
    },
  })
  const highStaff = calculateRoundForecast(gameState, {
    staffing: {
      assembly: 10,
      shipping: 12,
    },
  })

  assert.equal(
    highStaff.forecast.capacityByDepartment.shipping > lowStaff.forecast.capacityByDepartment.shipping,
    true,
  )
})

test('machining staffing equals 5 x machines', () => {
  const forecast = calculateRoundForecast(createGameState())
  const machineCount =
    investmentsSnapshot.factory.machiningMachineCount +
    forecast.forecast.investments.newMachines

  assert.equal(forecast.forecast.staffing.machining, machineCount * 5)
})

test('staffing can be zero', () => {
  const forecast = calculateRoundForecast(createGameState(), {
    staffing: {
      assembly: 0,
      shipping: 0,
    },
  })

  assert.equal(forecast.forecast.staffing.assembly, 0)
  assert.equal(forecast.forecast.staffing.shipping, 0)
})

test('price elasticity formula lowers demand when price increases', () => {
  const demandAtReference = calculateDemandPerVariation(25000)
  const demandAtHigherPrice = calculateDemandPerVariation(30000)

  assert.equal(demandAtReference > demandAtHigherPrice, true)
})

test('reference price 25000 yields 10 containers per variation', () => {
  assert.equal(calculateDemandPerVariation(25000), 10)
})

test('ACT price change follows exponential elasticity', () => {
  const referenceDemand = calculateDemandPerVariation(25000)
  const lowerPriceDemand = calculateDemandPerVariation(20000)
  const expectedLower = Math.round(10 * (20000 / 25000) ** -4)

  assert.equal(referenceDemand, 10)
  assert.equal(lowerPriceDemand, expectedLower)
})

test('demand is rounded to nearest whole container', () => {
  const demand = calculateDemandPerVariation(24750)
  assert.equal(Number.isInteger(demand), true)
})

test('variation quality thresholds return expected caps', () => {
  assert.equal(calculateAllowedNewVariations(74.9), 0)
  assert.equal(calculateAllowedNewVariations(75), 1)
  assert.equal(calculateAllowedNewVariations(79.9), 1)
  assert.equal(calculateAllowedNewVariations(80), 2)
})

test('inventory value and area use configured unit constants', () => {
  const forecast = calculateRoundForecast(createGameState())
  const inv = forecast.forecast.inventory

  // finishedGoodsValue is now the physical closing balance's value, not the Lean minimum metric.
  assert.equal(Math.round(inv.finishedGoodsValue), Math.round(inv.closingFinishedGoodsInventory * 20000))
  assert.equal(Math.round(inv.finishedGoodsArea), Math.round(inv.minimumFinishedGoodsInventory * 15))
})

test('new machine increases machining capacity', () => {
  const withoutMachine = calculateRoundForecast(
    createGameState({
      investmentsDecision: {
        round: 4,
        investments: [],
      },
    }),
  )
  const withMachine = calculateRoundForecast(createGameState())

  assert.equal(
    withMachine.forecast.capacityByDepartment.machining > withoutMachine.forecast.capacityByDepartment.machining,
    true,
  )
})

test('factory expansion increases total factory area', () => {
  const withoutExpansion = calculateRoundForecast(
    createGameState({
      investmentsDecision: {
        round: 4,
        investments: [],
      },
    }),
  )
  const withExpansion = calculateRoundForecast(createGameState())

  assert.equal(withExpansion.forecast.space.totalArea > withoutExpansion.forecast.space.totalArea, true)
})

test('baseline demand uses 20 active variations at reference price', () => {
  const forecast = calculateRoundForecast(
    createGameState({
      fiveSDecision: null,
      projectsDecision: null,
      investmentsDecision: null,
      marketDecision: {
        price: 25000,
      },
    }),
  )

  assert.equal(forecast.forecast.market.activeVariationCount, 20)
  assert.equal(forecast.forecast.market.demandPerVariation, 10)
  assert.equal(forecast.forecast.demand, 200)
})

test('default factory settings keep the baseline forecast unchanged', () => {
  const gameState = createGameState()
  const forecastWithoutSettings = calculateRoundForecast(gameState)
  const forecastWithSettings = calculateRoundForecast(gameState, {}, DEFAULT_FACTORY_SETTINGS)

  assert.equal(forecastWithSettings.forecast.demand, forecastWithoutSettings.forecast.demand)
  assert.equal(forecastWithSettings.forecast.capacityByDepartment.machining, forecastWithoutSettings.forecast.capacityByDepartment.machining)
  assert.equal(forecastWithSettings.forecast.capacityByDepartment.assembly, forecastWithoutSettings.forecast.capacityByDepartment.assembly)
  assert.equal(forecastWithSettings.forecast.capacityByDepartment.shipping, forecastWithoutSettings.forecast.capacityByDepartment.shipping)
  assert.equal(forecastWithSettings.forecast.plantCapacity, forecastWithoutSettings.forecast.plantCapacity)
  assert.equal(forecastWithSettings.forecast.bottleneckKey, forecastWithoutSettings.forecast.bottleneckKey)
  assert.equal(forecastWithSettings.forecast.actualProduction, forecastWithoutSettings.forecast.actualProduction)
  assert.equal(forecastWithSettings.forecast.inventory.averageFinishedGoodsInventory, forecastWithoutSettings.forecast.inventory.averageFinishedGoodsInventory)
  assert.equal(forecastWithSettings.forecast.inventory.finishedGoodsValue, forecastWithoutSettings.forecast.inventory.finishedGoodsValue)
  assert.equal(forecastWithSettings.forecast.inventory.finishedGoodsArea, forecastWithoutSettings.forecast.inventory.finishedGoodsArea)
  assert.equal(forecastWithSettings.forecast.space.freeFactorySpace, forecastWithoutSettings.forecast.space.freeFactorySpace)
  assert.equal(forecastWithSettings.forecast.finance.labor, forecastWithoutSettings.forecast.finance.labor)
  assert.equal(forecastWithSettings.forecast.finance.fixedCosts, forecastWithoutSettings.forecast.finance.fixedCosts)
  assert.equal(forecastWithSettings.forecast.finance.depreciation, forecastWithoutSettings.forecast.finance.depreciation)
  assert.equal(forecastWithSettings.forecast.finance.interest, forecastWithoutSettings.forecast.finance.interest)
  assert.equal(forecastWithSettings.summary.result, forecastWithoutSettings.summary.result)
})

test('5S divisor override changes forecast KNL without changing demand inputs directly', () => {
  const gameState = createGameState()
  const customSettings = cloneSettings({
    lean: {
      ...DEFAULT_FACTORY_SETTINGS.lean,
      fiveS: {
        ...DEFAULT_FACTORY_SETTINGS.lean.fiveS,
        contributionDivisor: 2,
      },
    },
  })

  const forecast = calculateRoundForecast(gameState, {}, customSettings)
  const defaultForecast = calculateRoundForecast(gameState)

  // 2026-09 KNL rework: 5S hours are now split into exact thirds across K/N/L (spec-mandated,
  // not configurable), so contributionDivisor no longer feeds the canonical KNL calculation.
  // It still affects the (separate, out-of-scope) allowed-new-variations quality average.
  assert.equal(forecast.forecast.knl.machining.knl, defaultForecast.forecast.knl.machining.knl)
  assert.notEqual(forecast.forecast.knl.totalQualityAverage, defaultForecast.forecast.knl.totalQualityAverage)
  assert.equal(forecast.forecast.demand, defaultForecast.forecast.demand)
})

test('SMED minimum setup override changes changeover time but not changeover count', () => {
  const gameState = createGameState()
  const customSettings = cloneSettings({
    lean: {
      ...DEFAULT_FACTORY_SETTINGS.lean,
      smed: {
        ...DEFAULT_FACTORY_SETTINGS.lean.smed,
        minimumSetupTimeHours: 1,
      },
    },
  })

  const forecast = calculateRoundForecast(gameState, {}, customSettings)
  const defaultForecast = calculateRoundForecast(gameState)

  assert.notEqual(forecast.forecast.knl.machining.changeoverHours, defaultForecast.forecast.knl.machining.changeoverHours)
  assert.equal(forecast.forecast.switches, defaultForecast.forecast.switches)
  assert.equal(forecast.forecast.demand, defaultForecast.forecast.demand)
})

test('TPM initial downtime rate no longer double-counts against the explicit machining otherDowntimeRate', () => {
  const gameState = createGameState()
  const customSettings = cloneSettings({
    lean: {
      ...DEFAULT_FACTORY_SETTINGS.lean,
      tpm: {
        ...DEFAULT_FACTORY_SETTINGS.lean.tpm,
        initialDowntimeRate: 0.2,
      },
    },
  })

  const forecast = calculateRoundForecast(gameState, {}, customSettings)
  const defaultForecast = calculateRoundForecast(gameState)

  // Machining K is now driven only by production.departments.machining.otherDowntimeRate and
  // the batch-size-driven changeover loss; lean.tpm.initialDowntimeRate no longer feeds machining K.
  assert.equal(forecast.forecast.knl.machining.kPct, defaultForecast.forecast.knl.machining.kPct)
  assert.equal(forecast.forecast.knl.machining.nPct, defaultForecast.forecast.knl.machining.nPct)
  assert.equal(forecast.forecast.knl.machining.lPct, defaultForecast.forecast.knl.machining.lPct)
})

test('machining otherDowntimeRate override no longer affects K (removed in the 2026-09 KNL rework)', () => {
  const gameState = createGameState()
  const customSettings = cloneSettings({
    production: {
      ...DEFAULT_FACTORY_SETTINGS.production,
      departments: {
        ...DEFAULT_FACTORY_SETTINGS.production.departments,
        machining: {
          ...DEFAULT_FACTORY_SETTINGS.production.departments.machining,
          otherDowntimeRate: 0.34,
        },
      },
    },
  })

  const forecast = calculateRoundForecast(gameState, {}, customSettings)
  const defaultForecast = calculateRoundForecast(gameState)

  // K_machining is now derived from cumulative development hours (knl.baseline.K_machining +
  // knl.knlMaximum/knlHalfLifeHours), not from production.departments.machining.otherDowntimeRate.
  assert.equal(forecast.forecast.knl.machining.kPct, defaultForecast.forecast.knl.machining.kPct)
  assert.equal(forecast.forecast.knl.machining.nPct, defaultForecast.forecast.knl.machining.nPct)
  assert.equal(forecast.forecast.knl.machining.lPct, defaultForecast.forecast.knl.machining.lPct)
})

// Reference scenarios for batch size -> changeovers -> availability -> KNL -> capacity.
// Uses a zero SMED/5S baseline (no prior lean investment) so setupTimeHours equals the
// canonical initialSetupTimeHours (10h) exactly, isolating the batch-size effect being tested.
function createZeroLeanMachiningGameState(machineCount) {
  const gameState = createInitialGameState()
  gameState.lean.methods.machining = { smed: 0, tpm: 0, spc: 0 }
  gameState.lean.fiveS.departments.machining.effectiveHours = 0
  if (machineCount != null) {
    gameState.production.machiningMachines = machineCount
  }
  return gameState
}

function runBatchScenario(batchSize, machineCount) {
  const gameState = createZeroLeanMachiningGameState(machineCount)
  return calculateRoundForecast(
    gameState,
    { market: { price: 25000, productionQuantity: 200, batchSize } },
    DEFAULT_FACTORY_SETTINGS,
  )
}

function approx(actual, expected, tolerance = 0.05) {
  assert.equal(Math.abs(actual - expected) <= tolerance, true, `expected ${actual} to be within ${tolerance} of ${expected}`)
}

test('scenario A: production 200, batchSize 20, 2 machines gives ~72.3% K', () => {
  const forecast = runBatchScenario(20)
  const m = forecast.forecast.knl.machining

  assert.equal(m.totalChangeovers, 10)
  assert.equal(m.changeoversPerMachine, 5)
  assert.equal(m.changeoverHoursPerMachine, 50)
  approx(m.kPct, 72.346, 0.01)
})

test('scenario B: production 200, batchSize 10, 2 machines gives ~68.7% K', () => {
  const forecast = runBatchScenario(10)
  const m = forecast.forecast.knl.machining

  assert.equal(m.totalChangeovers, 20)
  assert.equal(m.changeoversPerMachine, 10)
  assert.equal(m.changeoverHoursPerMachine, 100)
  approx(m.kPct, 68.692, 0.01)
})

test('scenario C: production 200, batchSize 5, 2 machines gives ~61.4% K', () => {
  const forecast = runBatchScenario(5)
  const m = forecast.forecast.knl.machining

  assert.equal(m.totalChangeovers, 40)
  assert.equal(m.changeoversPerMachine, 20)
  assert.equal(m.changeoverHoursPerMachine, 200)
  approx(m.kPct, 61.385, 0.01)
})

test('scenario D: a third machine keeps total changeovers the same but shares them across more machines', () => {
  const twoMachines = runBatchScenario(20, 2)
  const threeMachines = runBatchScenario(20, 3)
  const twoMetrics = twoMachines.forecast.knl.machining
  const threeMetrics = threeMachines.forecast.knl.machining

  assert.equal(threeMetrics.totalChangeovers, twoMetrics.totalChangeovers)
  approx(threeMetrics.changeoversPerMachine, 10 / 3, 0.001)
  approx(threeMetrics.changeoverHoursPerMachine, (10 / 3) * 10, 0.01)
  assert.equal(threeMetrics.kPct > twoMetrics.kPct, true)
})

test('total factory changeovers use production quantity and batch size, not machine count', () => {
  const q20 = runBatchScenario(20)
  const q10 = runBatchScenario(10)
  const q5 = runBatchScenario(5)
  const q10WithThreeMachines = runBatchScenario(10, 3)

  assert.equal(q20.forecast.knl.machining.totalChangeovers, 10)
  assert.equal(q10.forecast.knl.machining.totalChangeovers, 20)
  assert.equal(q5.forecast.knl.machining.totalChangeovers, 40)
  assert.equal(q10WithThreeMachines.forecast.knl.machining.totalChangeovers, 20)
  assert.equal(q10WithThreeMachines.forecast.knl.machining.changeoversPerMachine, 20 / 3)
})

test('capacity changes with K and changeover loss is not subtracted twice', () => {
  const q20 = runBatchScenario(20)
  const q5 = runBatchScenario(5)

  // Smaller batches -> more changeovers -> lower K -> lower capacity, driven purely through KNL.
  assert.equal(q5.forecast.knl.machining.kPct < q20.forecast.knl.machining.kPct, true)
  assert.equal(q5.forecast.knl.machining.capacityContainers < q20.forecast.knl.machining.capacityContainers, true)

  const expectedCapacity = Math.floor(
    (2 * 1040 * q20.forecast.knl.machining.knl) / 6,
  )
  assert.equal(q20.forecast.knl.machining.capacityContainers, expectedCapacity)
})

// K) changeover loss must only ever be applied once: kPct is exactly kChangeoverPct * kMachiningDevelopedPct,
// with no other field (e.g. a removed otherDowntimeHoursPerMachine) subtracting it again.
test('K) K_changeover loss is applied exactly once in kPct, no leftover double counting', () => {
  const forecast = runBatchScenario(10)
  const m = forecast.forecast.knl.machining

  assert.equal(m.otherDowntimeHoursPerMachine, undefined)
  assert.equal(
    Math.abs(m.kPct - (m.kChangeoverPct / 100) * m.kMachiningDevelopedPct) < 1e-9,
    true,
  )
})

test('variation threshold override changes allowed new variations', () => {
  const gameState = createGameState({
    fiveSDecision: null,
    projectsDecision: null,
    investmentsDecision: null,
    marketDecision: {
      price: 25000,
    },
  })
  const customSettings = cloneSettings({
    variationRules: {
      ...DEFAULT_FACTORY_SETTINGS.variationRules,
      minimumQualityForZeroAdditionalVariations: 0.99,
      oneVariationMinQuality: 1,
      twoVariationMinQuality: 1,
    },
  })

  const forecast = calculateRoundForecast(gameState, {}, customSettings)
  const defaultForecast = calculateRoundForecast(gameState)

  assert.notEqual(forecast.decisions.market.allowedNewVariations, defaultForecast.decisions.market.allowedNewVariations)
  assert.equal(forecast.decisions.market.allowedNewVariations, 0)
})

test('machining norm hours override changes machining capacity only', () => {
  const gameState = createGameState()
  const customSettings = cloneSettings({
    production: {
      ...DEFAULT_FACTORY_SETTINGS.production,
      departments: {
        ...DEFAULT_FACTORY_SETTINGS.production.departments,
        machining: {
          ...DEFAULT_FACTORY_SETTINGS.production.departments.machining,
          normHoursPerContainer: 5,
        },
      },
    },
  })

  const forecast = calculateRoundForecast(gameState, {}, customSettings)
  const defaultForecast = calculateRoundForecast(gameState)

  assert.notEqual(forecast.forecast.capacityByDepartment.machining, defaultForecast.forecast.capacityByDepartment.machining)
  assert.equal(forecast.forecast.capacityByDepartment.assembly, defaultForecast.forecast.capacityByDepartment.assembly)
  assert.equal(forecast.forecast.capacityByDepartment.shipping, defaultForecast.forecast.capacityByDepartment.shipping)
})

test('assembly norm hours override changes assembly capacity', () => {
  const gameState = createGameState()
  const customSettings = cloneSettings({
    production: {
      ...DEFAULT_FACTORY_SETTINGS.production,
      departments: {
        ...DEFAULT_FACTORY_SETTINGS.production.departments,
        assembly: {
          ...DEFAULT_FACTORY_SETTINGS.production.departments.assembly,
          normHoursPerContainer: 100,
        },
      },
    },
  })

  const forecast = calculateRoundForecast(gameState, {}, customSettings)
  const defaultForecast = calculateRoundForecast(gameState)

  assert.notEqual(forecast.forecast.capacityByDepartment.assembly, defaultForecast.forecast.capacityByDepartment.assembly)
  assert.equal(forecast.forecast.capacityByDepartment.machining, defaultForecast.forecast.capacityByDepartment.machining)
  assert.equal(forecast.forecast.capacityByDepartment.shipping, defaultForecast.forecast.capacityByDepartment.shipping)
})

test('shipping norm hours override changes shipping capacity', () => {
  const gameState = createGameState()
  const customSettings = cloneSettings({
    production: {
      ...DEFAULT_FACTORY_SETTINGS.production,
      departments: {
        ...DEFAULT_FACTORY_SETTINGS.production.departments,
        shipping: {
          ...DEFAULT_FACTORY_SETTINGS.production.departments.shipping,
          normHoursPerContainer: 8,
        },
      },
    },
  })

  const forecast = calculateRoundForecast(gameState, {}, customSettings)
  const defaultForecast = calculateRoundForecast(gameState)

  assert.notEqual(forecast.forecast.capacityByDepartment.shipping, defaultForecast.forecast.capacityByDepartment.shipping)
  assert.equal(forecast.forecast.capacityByDepartment.machining, defaultForecast.forecast.capacityByDepartment.machining)
  assert.equal(forecast.forecast.capacityByDepartment.assembly, defaultForecast.forecast.capacityByDepartment.assembly)
})

test('available hours override changes capacity scale', () => {
  const gameState = createGameState()
  const customSettings = cloneSettings({
    production: {
      ...DEFAULT_FACTORY_SETTINGS.production,
      hoursPerMachinePerRound: 960,
      hoursPerWorkerPerRound: 960,
    },
  })

  const forecast = calculateRoundForecast(gameState, {}, customSettings)
  const defaultForecast = calculateRoundForecast(gameState)

  assert.notEqual(forecast.forecast.capacityByDepartment.machining, defaultForecast.forecast.capacityByDepartment.machining)
})

test('inventory value override changes inventory value only', () => {
  const gameState = createGameState()
  const customSettings = cloneSettings({
    inventory: {
      ...DEFAULT_FACTORY_SETTINGS.inventory,
      finishedGoodsValuePerContainer: 25000,
    },
  })

  const forecast = calculateRoundForecast(gameState, {}, customSettings)
  const defaultForecast = calculateRoundForecast(gameState)

  assert.equal(forecast.forecast.inventory.averageFinishedGoodsInventory, defaultForecast.forecast.inventory.averageFinishedGoodsInventory)
  assert.notEqual(forecast.forecast.inventory.finishedGoodsValue, defaultForecast.forecast.inventory.finishedGoodsValue)
  assert.equal(forecast.forecast.inventory.finishedGoodsArea, defaultForecast.forecast.inventory.finishedGoodsArea)
})

test('inventory space override changes inventory space only', () => {
  const gameState = createGameState()
  const customSettings = cloneSettings({
    inventory: {
      ...DEFAULT_FACTORY_SETTINGS.inventory,
      finishedGoodsSpacePerContainerM2: 20,
    },
  })

  const forecast = calculateRoundForecast(gameState, {}, customSettings)
  const defaultForecast = calculateRoundForecast(gameState)

  assert.equal(forecast.forecast.inventory.averageFinishedGoodsInventory, defaultForecast.forecast.inventory.averageFinishedGoodsInventory)
  assert.equal(forecast.forecast.inventory.finishedGoodsValue, defaultForecast.forecast.inventory.finishedGoodsValue)
  assert.notEqual(forecast.forecast.inventory.finishedGoodsArea, defaultForecast.forecast.inventory.finishedGoodsArea)
})

test('machine space override changes free factory space without changing capacity', () => {
  const gameState = createGameState()
  const customSettings = cloneSettings({
    factory: {
      ...DEFAULT_FACTORY_SETTINGS.factory,
      machineSpaceM2: 300,
    },
  })

  const forecast = calculateRoundForecast(gameState, {}, customSettings)
  const defaultForecast = calculateRoundForecast(gameState)

  assert.equal(forecast.forecast.capacityByDepartment.machining, defaultForecast.forecast.capacityByDepartment.machining)
  assert.notEqual(forecast.forecast.space.machineArea, defaultForecast.forecast.space.machineArea)
  assert.notEqual(forecast.forecast.space.freeFactorySpace, defaultForecast.forecast.space.freeFactorySpace)
})

test('worker space override changes free factory space without changing capacity', () => {
  const gameState = createGameState()
  const customSettings = cloneSettings({
    factory: {
      ...DEFAULT_FACTORY_SETTINGS.factory,
      workerSpaceM2: 30,
    },
  })

  const forecast = calculateRoundForecast(gameState, {}, customSettings)
  const defaultForecast = calculateRoundForecast(gameState)

  assert.equal(forecast.forecast.capacityByDepartment.assembly, defaultForecast.forecast.capacityByDepartment.assembly)
  assert.equal(forecast.forecast.capacityByDepartment.shipping, defaultForecast.forecast.capacityByDepartment.shipping)
  assert.notEqual(forecast.forecast.space.assemblyArea, defaultForecast.forecast.space.assemblyArea)
  assert.notEqual(forecast.forecast.space.freeFactorySpace, defaultForecast.forecast.space.freeFactorySpace)
})

test('market settings override demand while keeping capacity unchanged', () => {
  const customSettings = cloneSettings({
    market: {
      ...DEFAULT_FACTORY_SETTINGS.market,
      referencePrice: 20000,
      baseDemandPerVariation: 12,
      priceElasticity: -2,
    },
  })
  // Pin an explicit production quantity so machining capacity (now batch/changeover driven)
  // is not indirectly coupled to the demand figure this test intentionally varies.
  const customGameState = createGameState({
    marketDecision: {
      price: 20000,
      productionQuantity: 150,
    },
  })

  const forecast = calculateRoundForecast(customGameState, {}, customSettings)
  const defaultForecast = calculateRoundForecast(customGameState)

    assert.equal(forecast.forecast.capacityByDepartment.machining, defaultForecast.forecast.capacityByDepartment.machining)
    assert.equal(forecast.forecast.market.demandPerVariation, 12)
  assert.equal(forecast.forecast.demand, 240)
})

test('annual employee cost override changes labor but not capacity', () => {
  const gameState = createGameState()
  const customSettings = cloneSettings({
    costs: {
      ...DEFAULT_FACTORY_SETTINGS.costs,
      annualEmployeeCost: 60000,
    },
  })

  const forecast = calculateRoundForecast(gameState, {}, customSettings)
  const defaultForecast = calculateRoundForecast(gameState)

    assert.equal(forecast.forecast.capacityByDepartment.assembly, defaultForecast.forecast.capacityByDepartment.assembly)
    assert.equal(forecast.forecast.capacityByDepartment.shipping, defaultForecast.forecast.capacityByDepartment.shipping)
    assert.equal(forecast.forecast.finance.labor, 675000)
  assert.equal(forecast.forecast.finance.labor < defaultForecast.forecast.finance.labor, true)
})

test('annual fixed cost override changes result by the round fraction amount', () => {
  const gameState = createGameState()
  const customSettings = cloneSettings({
    costs: {
      ...DEFAULT_FACTORY_SETTINGS.costs,
      annualFixedCosts: 3600000,
    },
  })

  const forecast = calculateRoundForecast(gameState, {}, customSettings)
  const defaultForecast = calculateRoundForecast(gameState)

  assert.equal(forecast.forecast.finance.fixedCosts, 900000)
  assert.equal(forecast.summary.result, defaultForecast.summary.result + 100000)
})

test('annual interest rate override changes interest without changing debt logic', () => {
  const gameState = createGameState()
  const customSettings = cloneSettings({
    finance: {
      ...DEFAULT_FACTORY_SETTINGS.finance,
      annualInterestRate: 0.08,
    },
  })

  const forecast = calculateRoundForecast(gameState, {}, customSettings)
  const defaultForecast = calculateRoundForecast(gameState)

  assert.equal(forecast.forecast.finance.interest, 8400)
  assert.equal(defaultForecast.forecast.finance.interest, 5250)
  assert.equal(forecast.forecast.finance.interest > defaultForecast.forecast.finance.interest, true)
})

test('interest uses opening debt and settings-derived round rate on first playable round', () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const forecast = calculateRoundForecast(gameState)

  assert.equal(forecast.forecast.finance.openingInterestBearingDebt, 2957900)
  assert.equal(forecast.forecast.finance.roundInterestRate, 0.0125)
  assert.equal(forecast.forecast.finance.interest, 36973.75)
  assert.equal(Math.round(forecast.forecast.finance.interest), 36974)
})

test('same-round investments do not change interest when opening debt is the same', () => {
  const baseState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const withoutInvestment = calculateRoundForecast({
    ...baseState,
    investmentsDecision: {
      round: 1,
      investments: [],
    },
  })
  const withInvestment = calculateRoundForecast({
    ...baseState,
    investmentsDecision: {
      round: 1,
      investments: [
        { type: 'new-machine', quantity: 1, cost: 500000 },
        { type: 'factory-expansion', quantity: 1, cost: 1000000 },
      ],
    },
  })

  assert.equal(withoutInvestment.forecast.finance.openingInterestBearingDebt, 2957900)
  assert.equal(withInvestment.forecast.finance.openingInterestBearingDebt, 2957900)
  assert.equal(withoutInvestment.forecast.finance.interest, withInvestment.forecast.finance.interest)
})

test('legacy decision costs cannot override canonical investment catalog prices', () => {
  const gameState = createGameState({
    investmentsDecision: {
      round: 1,
      investments: [
        { type: 'new-machine', quantity: 1, cost: 1 },
        { type: 'factory-expansion', quantity: 1, cost: 2 },
      ],
    },
  })
  const forecast = calculateRoundForecast(gameState)

  assert.equal(forecast.forecast.investments.totalCost, 1500000)
})

test('ACT market decisions do not change same-round interest when opening debt is unchanged', () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const scenarioA = calculateRoundForecast(gameState, {
    market: {
      price: 25000,
      productionQuantity: 132,
      addedVariations: 0,
    },
  })
  const scenarioB = calculateRoundForecast(gameState, {
    market: {
      price: 22000,
      productionQuantity: 90,
      addedVariations: 2,
    },
  })

  assert.equal(scenarioA.forecast.finance.openingInterestBearingDebt, 2957900)
  assert.equal(scenarioB.forecast.finance.openingInterestBearingDebt, 2957900)
  assert.equal(scenarioA.forecast.finance.interest, scenarioB.forecast.finance.interest)
})

test('zero opening debt yields zero interest even when same-round debtAfter grows from investments', () => {
  const baseState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const zeroDebtState = {
    ...baseState,
    finance: {
      ...baseState.finance,
      bankLoans: 0,
      cash: 0,
    },
    investmentsDecision: {
      round: 1,
      investments: [
        { type: 'new-machine', quantity: 1, cost: 500000 },
      ],
    },
  }

  const forecast = calculateRoundForecast(zeroDebtState)

  assert.equal(forecast.forecast.finance.openingInterestBearingDebt, 0)
  assert.equal(forecast.forecast.finance.interest, 0)
  assert.equal(forecast.forecast.investments.totalCost > 0, true)
})

test('round interest rate is derived from settings and not hardcoded', () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const customSettings = cloneSettings({
    finance: {
      ...DEFAULT_FACTORY_SETTINGS.finance,
      annualInterestRate: 0.08,
    },
  })

  const forecast = calculateRoundForecast(gameState, {}, customSettings)

  assert.equal(forecast.forecast.finance.roundInterestRate, 0.02)
  assert.equal(forecast.forecast.finance.interest, 59158)
})

test('depreciation override changes depreciation while leaving asset base intact', () => {
  const gameState = createGameState()
  const customSettings = cloneSettings({
    finance: {
      ...DEFAULT_FACTORY_SETTINGS.finance,
      machineryDepreciationPerRound: 0.1,
      buildingDepreciationPerRound: 0.05,
    },
  })

  const forecast = calculateRoundForecast(gameState, {}, customSettings)
  const defaultForecast = calculateRoundForecast(gameState)

  assert.equal(forecast.forecast.finance.depreciation > defaultForecast.forecast.finance.depreciation, true)
  assert.equal(forecast.forecast.finance.depreciation, 225000)
  assert.equal(forecast.forecast.space.totalArea, defaultForecast.forecast.space.totalArea)
})

test('without saved check staffing decision, defaults are assembly 25 and shipping 5', () => {
  const forecast = calculateRoundForecast(
    createGameState({
      checkStaffingDecision: null,
      fiveSDecision: null,
      projectsDecision: null,
      investmentsDecision: null,
    }),
  )

  assert.equal(forecast.forecast.staffing.assembly, 25)
  assert.equal(forecast.forecast.staffing.shipping, 5)
})

test('department capacities are reported in containers per round using norm hours', () => {
  const forecast = calculateRoundForecast(
    createGameState({
      fiveSDecision: null,
      projectsDecision: null,
      investmentsDecision: null,
    }),
  )

  const machiningBackToHours =
    forecast.forecast.capacityByDepartment.machining * 6
  const assemblyBackToHours =
    forecast.forecast.capacityByDepartment.assembly * 90
  const shippingBackToHours =
    forecast.forecast.capacityByDepartment.shipping * 10

  assert.equal(machiningBackToHours <= (2 * 1040), true)
  assert.equal(assemblyBackToHours <= (forecast.forecast.staffing.assembly * 1040), true)
  assert.equal(shippingBackToHours <= (forecast.forecast.staffing.shipping * 1040), true)
})

test('switch count uses active variations multiplied by runs per variation', () => {
  const forecast = calculateRoundForecast(
    createGameState({
      fiveSDecision: null,
      projectsDecision: null,
      investmentsDecision: null,
      marketDecision: {
        price: 25000,
        runsPerVariation: 2,
      },
    }),
  )

  assert.equal(forecast.forecast.market.activeVariationCount, 20)
  assert.equal(forecast.forecast.market.totalVariations, 20)
  assert.equal(forecast.forecast.productionRuns, 40)
  assert.equal(forecast.forecast.switches, 40)
})

test('new variation increases demand at reference price', () => {
  const withoutNewVariation = calculateRoundForecast(
    createGameState({
      marketDecision: {
        price: 25000,
      },
    }),
    {
      market: {
        addedVariations: 0,
      },
    },
  )

  const withNewVariation = calculateRoundForecast(
    createGameState({
      marketDecision: {
        price: 25000,
      },
    }),
    {
      market: {
        addedVariations: 1,
      },
    },
  )

  assert.equal(withNewVariation.forecast.demand > withoutNewVariation.forecast.demand, true)
})

test('new variation increases switch count', () => {
  const withoutNewVariation = calculateRoundForecast(
    createGameState({
      marketDecision: {
        price: 25000,
        runsPerVariation: 2,
      },
    }),
    {
      market: {
        addedVariations: 0,
      },
    },
  )

  const withNewVariation = calculateRoundForecast(
    createGameState({
      marketDecision: {
        price: 25000,
        runsPerVariation: 2,
      },
    }),
    {
      market: {
        addedVariations: 1,
      },
    },
  )

  assert.equal(withNewVariation.forecast.switches > withoutNewVariation.forecast.switches, true)
})

test('production quantity is clamped to capacity maximum', () => {
  const forecast = calculateRoundForecast(
    createGameState(),
    {
      market: {
        productionQuantity: 999999,
      },
    },
  )

  assert.equal(forecast.summary.productionQuantity, forecast.summary.plantCapacity)
})

test('batch size decision defaults to initialBatchSize and clamps to 1-20', () => {
  const defaultForecast = calculateRoundForecast(createGameState())
  assert.equal(defaultForecast.decisions.market.batchSize, 20)

  const tooLarge = calculateRoundForecast(createGameState(), { market: { batchSize: 999 } })
  assert.equal(tooLarge.decisions.market.batchSize, 20)

  const tooSmall = calculateRoundForecast(createGameState(), { market: { batchSize: -5 } })
  assert.equal(tooSmall.decisions.market.batchSize, 1)

  const midRange = calculateRoundForecast(createGameState(), { market: { batchSize: 8 } })
  assert.equal(midRange.decisions.market.batchSize, 8)
})

test('current round forecast uses only gameState.market.batchSize (no ACT-style decision override needed)', () => {
  // This mirrors exactly how CheckPage computes the current round's own forecast: no market
  // decision override at all, relying purely on the canonical carried-over batchSize.
  const gameStateQ20 = createInitialGameState()
  gameStateQ20.market.batchSize = 20
  const forecastQ20 = calculateRoundForecast(gameStateQ20, { staffing: { assembly: 25, shipping: 5 } }, DEFAULT_FACTORY_SETTINGS)

  const gameStateQ5 = createInitialGameState()
  gameStateQ5.market.batchSize = 5
  const forecastQ5 = calculateRoundForecast(gameStateQ5, { staffing: { assembly: 25, shipping: 5 } }, DEFAULT_FACTORY_SETTINGS)

  const totalVariations = forecastQ20.decisions.market.totalVariations

  assert.equal(forecastQ20.decisions.market.batchSize, 20)
  assert.equal(
    forecastQ20.forecast.inventory.minimumFinishedGoodsInventory,
    (totalVariations * 20) / (2 * 2),
  )

  assert.equal(forecastQ5.decisions.market.batchSize, 5)
  assert.equal(
    forecastQ5.forecast.inventory.minimumFinishedGoodsInventory,
    (totalVariations * 5) / (2 * 2),
  )

  assert.equal(
    forecastQ20.forecast.knl.machining.changeoversPerMachine < forecastQ5.forecast.knl.machining.changeoversPerMachine,
    true,
  )
})

test('average finished goods inventory uses the canonical batchSize decision (batchSize=10, 20 variations)', () => {
  const forecast = calculateRoundForecast(createGameState(), { market: { batchSize: 10 } })

  assert.equal(forecast.decisions.market.totalVariations, 20)
  assert.equal(forecast.decisions.market.batchSize, 10)
  assert.equal(forecast.forecast.inventory.averageFinishedGoodsInventory, 100 / 3)
})

test('average finished goods inventory uses the canonical batchSize decision (batchSize=5, 20 variations)', () => {
  const forecast = calculateRoundForecast(createGameState(), { market: { batchSize: 5 } })

  assert.equal(forecast.decisions.market.totalVariations, 20)
  assert.equal(forecast.decisions.market.batchSize, 5)
  assert.equal(forecast.forecast.inventory.averageFinishedGoodsInventory, 50 / 3)
})

test('forecast no longer exposes a second, actualProduction-derived batchSize concept', () => {
  const forecast = calculateRoundForecast(createGameState(), { market: { batchSize: 7 } })

  assert.equal(Object.prototype.hasOwnProperty.call(forecast.forecast, 'batchSize'), false)
  assert.equal(forecast.decisions.market.batchSize, 7)
  assert.equal(forecast.forecast.knl.machining.batchSize, 7)
  // FG averaging must move with the same canonical batchSize that drives machining changeovers.
  assert.equal(
    forecast.forecast.inventory.averageFinishedGoodsInventory,
    (forecast.decisions.market.totalVariations * forecast.decisions.market.batchSize) /
      (2 * 3),
  )
})

test('production may exceed demand when capacity allows (requested > demand)', () => {
  const customSettings = cloneSettings({
    market: {
      ...DEFAULT_FACTORY_SETTINGS.market,
      baseDemandPerVariation: 10,
    },
  })
  const gameState = createInitialGameState()
  gameState.production.machiningMachines = 10
  gameState.staffing = { assembly: 200, shipping: 200 }

  const forecast = calculateRoundForecast(
    gameState,
    { market: { price: 25000, productionQuantity: 220, activeVariationCount: 20 } },
    customSettings,
  )

  assert.equal(forecast.forecast.demand, 200)
  assert.equal(forecast.forecast.plantCapacity >= 220, true)
  assert.equal(forecast.forecast.actualProduction, 220)
})

test('capacity limits production regardless of demand', () => {
  const gameState = createInitialGameState()
  // Keep the default small machine count so machining capacity is well below 220.
  const forecast = calculateRoundForecast(
    gameState,
    { market: { price: 25000, productionQuantity: 220 } },
    DEFAULT_FACTORY_SETTINGS,
  )

  assert.equal(forecast.forecast.plantCapacity < 220, true)
  assert.equal(forecast.forecast.actualProduction, forecast.forecast.plantCapacity)
})

test('opening inventory above the minimum buffer supplements this round\'s production', () => {
  const customSettings = cloneSettings({
    market: {
      ...DEFAULT_FACTORY_SETTINGS.market,
      baseDemandPerVariation: 21,
    },
  })
  const gameState = createInitialGameState()
  gameState.inventory.finishedGoodsContainers = 150
  gameState.production.machiningMachines = 10
  gameState.staffing = { assembly: 200, shipping: 200 }

  const forecast = calculateRoundForecast(
    gameState,
    { market: { price: 25000, productionQuantity: 170, batchSize: 20, activeVariationCount: 10 } },
    customSettings,
  )
  const inv = forecast.forecast.inventory

  assert.equal(inv.minimumFinishedGoodsInventory, 10)
  assert.equal(inv.availableFinishedGoodsInventory, 310)
  assert.equal(forecast.forecast.actualProduction, 170)
  assert.equal(forecast.forecast.demand, 210)
  assert.equal(forecast.forecast.deliveries, 210)
  assert.equal(inv.closingFinishedGoodsInventory, 110)
})

test('the default target is the calculated minimum inventory buffer', () => {
  const gameState = createInitialGameState()
  gameState.inventory.finishedGoodsContainers = 150
  gameState.production.machiningMachines = 10
  gameState.staffing = { assembly: 200, shipping: 200 }

  const forecast = calculateRoundForecast(
    gameState,
    { market: { price: 25000, productionQuantity: 120, batchSize: 10 } },
    DEFAULT_FACTORY_SETTINGS,
  )
  const inv = forecast.forecast.inventory

  assert.equal(inv.minimumFinishedGoodsInventory, 10)
  assert.equal(inv.targetFinishedGoodsInventory, 10)
  assert.equal(inv.availableFinishedGoodsInventory, 260)
  assert.equal(forecast.forecast.actualProduction, 120)
  assert.equal(forecast.forecast.deliveries, 200)
  assert.equal(forecast.forecast.lostSalesUnits, 0)
  assert.equal(inv.closingFinishedGoodsInventory, 70)
})

test('production above demand builds physical inventory and drives inventoryChange from the physical balance', () => {
  const gameState = createInitialGameState()
  gameState.inventory.finishedGoodsContainers = 100
  gameState.production.machiningMachines = 10
  gameState.staffing = { assembly: 200, shipping: 200 }

  const forecast = calculateRoundForecast(
    gameState,
    { market: { price: 25000, productionQuantity: 220, batchSize: 10 } },
    DEFAULT_FACTORY_SETTINGS,
  )
  const inv = forecast.forecast.inventory

  assert.equal(inv.availableFinishedGoodsInventory, 310)
  assert.equal(forecast.forecast.deliveries, 200)
  assert.equal(inv.closingFinishedGoodsInventory, 120)
  assert.equal(inv.inventoryChange, 400000)
})

test('batchSize alone does not rewrite the physical closing inventory when demand is the binding constraint', () => {
  function scenarioWithBatchSize(batchSize) {
    const gameState = createInitialGameState()
    gameState.inventory.finishedGoodsContainers = 100
    gameState.production.machiningMachines = 10
    gameState.staffing = { assembly: 200, shipping: 200 }

    return calculateRoundForecast(
      gameState,
      { market: { price: 25000, productionQuantity: 220, batchSize } },
      DEFAULT_FACTORY_SETTINGS,
    )
  }

  const withLargeBatch = scenarioWithBatchSize(20)
  const withSmallBatch = scenarioWithBatchSize(5)

  assert.notEqual(
    withLargeBatch.forecast.inventory.minimumFinishedGoodsInventory,
    withSmallBatch.forecast.inventory.minimumFinishedGoodsInventory,
  )
  assert.equal(
    withLargeBatch.forecast.inventory.closingFinishedGoodsInventory,
    withSmallBatch.forecast.inventory.closingFinishedGoodsInventory,
  )
})

test('overproduction is not performed above demand', () => {
  const baseline = calculateRoundForecast(createGameState({
    fiveSDecision: null,
    projectsDecision: null,
    investmentsDecision: null,
  }))

  const forecast = calculateRoundForecast(
    createGameState({
      fiveSDecision: null,
      projectsDecision: null,
      investmentsDecision: null,
    }),
    {
      market: {
        productionQuantity: baseline.summary.plantCapacity,
      },
    },
  )

  // Deliveries (sales) are still capped by demand; only production itself may exceed demand.
  assert.equal(forecast.summary.deliveries <= forecast.summary.demand, true)
})

test('production quantity below demand creates lost sales', () => {
  const forecast = calculateRoundForecast(
    createGameState({
      fiveSDecision: null,
      projectsDecision: null,
      investmentsDecision: null,
    }),
    {
      market: {
        productionQuantity: 50,
      },
    },
  )

  assert.equal(forecast.summary.lostSalesUnits, forecast.summary.demand - forecast.summary.deliveries)
  assert.equal(forecast.summary.lostSalesUnits > 0, true)
})

test('finished-goods target inventory controls deliveries and physical closing stock', () => {
  const customSettings = cloneSettings({
    market: { ...DEFAULT_FACTORY_SETTINGS.market, baseDemandPerVariation: 10 },
  })

  function forecastFor({ openingInventory, productionQuantity, targetFinishedGoodsInventory }) {
    const gameState = createInitialGameState()
    gameState.inventory.finishedGoodsContainers = openingInventory
    gameState.production.machiningMachines = 10
    gameState.staffing = { machining: 50, assembly: 200, shipping: 200 }

    return calculateRoundForecast(gameState, {
      market: {
        price: 25000,
        activeVariationCount: 20,
        batchSize: 10,
        productionQuantity,
        targetFinishedGoodsInventory,
      },
    }, customSettings)
  }

  const caseA = forecastFor({ openingInventory: 50, productionQuantity: 180, targetFinishedGoodsInventory: 30 })
  assert.equal(caseA.forecast.deliveries, 200)
  assert.equal(caseA.forecast.inventory.closingFinishedGoodsInventory, 30)

  const caseB = forecastFor({ openingInventory: 30, productionQuantity: 230, targetFinishedGoodsInventory: 60 })
  assert.equal(caseB.forecast.deliveries, 200)
  assert.equal(caseB.forecast.inventory.closingFinishedGoodsInventory, 60)

  const caseC = forecastFor({ openingInventory: 30, productionQuantity: 195, targetFinishedGoodsInventory: 60 })
  assert.equal(caseC.forecast.deliveries, 165)
  assert.equal(caseC.forecast.lostSalesUnits, 35)
  assert.equal(caseC.forecast.inventory.closingFinishedGoodsInventory, 60)
})

test('minimum finished-goods inventory is based on variations, batch size, and machine count', () => {
  const baseState = createInitialGameState()
  baseState.staffing = { machining: 15, assembly: 200, shipping: 200 }

  function minimumInventory(machineCount, batchSize) {
    const gameState = structuredClone(baseState)
    gameState.production.machiningMachines = machineCount
    return calculateRoundForecast(gameState, {
      market: { activeVariationCount: 20, batchSize, productionQuantity: 0 },
    }).forecast.inventory.minimumFinishedGoodsInventory
  }

  assert.equal(minimumInventory(2, 10), 50)
  assert.equal(minimumInventory(2, 5), 25)
  assert.equal(minimumInventory(3, 10), 100 / 3)
})

test('requested finished-goods target cannot be lower than the calculated minimum', () => {
  const gameState = createInitialGameState()
  gameState.production.machiningMachines = 2

  const forecast = calculateRoundForecast(gameState, {
    market: { activeVariationCount: 20, batchSize: 10, targetFinishedGoodsInventory: 10 },
  })

  assert.equal(forecast.forecast.inventory.minimumFinishedGoodsInventory, 50)
  assert.equal(forecast.forecast.inventory.targetFinishedGoodsInventory, 50)
})

test('ACT forecast uses saved CHECK staffing decision by default', () => {
  const forecast = calculateRoundForecast(
    createGameState({
      checkStaffingDecision: {
        round: 4,
        staffing: {
          assembly: 31,
          shipping: 7,
        },
        savedAt: new Date().toISOString(),
      },
    }),
  )

  assert.equal(forecast.forecast.staffing.assembly, 31)
  assert.equal(forecast.forecast.staffing.shipping, 7)
})

test('same forecast function provides deterministic ACT preview values', () => {
  const gameState = createGameState({
    checkStaffingDecision: {
      round: 4,
      staffing: {
        assembly: 28,
        shipping: 6,
      },
      savedAt: new Date().toISOString(),
    },
  })
  const actMarketDecision = {
    price: 26000,
    addedVariations: 1,
    productionQuantity: 140,
  }

  const previewOne = calculateRoundForecast(gameState, {
    market: actMarketDecision,
  })
  const previewTwo = calculateRoundForecast(gameState, {
    market: actMarketDecision,
  })

  assert.equal(previewOne.summary.result, previewTwo.summary.result)
  assert.equal(previewOne.summary.deliveries, previewTwo.summary.deliveries)
  assert.equal(previewOne.summary.productionQuantity, previewTwo.summary.productionQuantity)
})

test('baseline capacities are in expected scale with 6h/90h/10h norm times', () => {
  const forecast = calculateRoundForecast(
    createGameState({
      fiveSDecision: null,
      projectsDecision: null,
      investmentsDecision: null,
      marketDecision: {
        price: 25000,
        runsPerVariation: 2,
      },
    }),
  )

  const machiningIdeal = (2 * 1040) / 6
  const assemblyIdeal = (25 * 1040) / 90
  const shippingIdeal = (5 * 1040) / 10

  assert.equal(Math.round(machiningIdeal), 347)
  assert.equal(Math.round(assemblyIdeal), 289)
  assert.equal(Math.round(shippingIdeal), 520)

  assert.equal(forecast.forecast.capacityByDepartment.machining < machiningIdeal, true)
  assert.equal(forecast.forecast.capacityByDepartment.assembly < assemblyIdeal, true)
  assert.equal(forecast.forecast.capacityByDepartment.shipping < shippingIdeal, true)

  // Baseline should keep machining around demand scale, not single-digit or thousands.
  assert.equal(forecast.forecast.capacityByDepartment.machining > 100, true)
  assert.equal(forecast.forecast.capacityByDepartment.machining < 300, true)

  assert.equal(forecast.forecast.demand, 200)
})

test('closing market state carries total variations, not opening active variations', () => {
  const forecast = calculateRoundForecast(createInitialGameState(), {
    market: {
      price: 25000,
      addedVariations: 2,
    },
  }, cloneSettings({
    variationRules: {
      ...DEFAULT_FACTORY_SETTINGS.variationRules,
      minimumQualityForZeroAdditionalVariations: 0,
      oneVariationMinQuality: 0,
    },
  }))

  assert.equal(forecast.forecast.market.activeVariationCount, 20)
  assert.equal(forecast.forecast.market.totalVariations, 22)
  assert.equal(forecast.closingState.market.activeVariations, 22)
  assert.equal(forecast.closingState.market.price, forecast.forecast.market.price)
  assert.equal(
    forecast.closingState.market.productionRunsPerVariation,
    forecast.forecast.market.runsPerVariation,
  )
})

test('closing staffing uses CHECK assembly and shipping plus derived machining staffing', () => {
  const gameState = createInitialGameState()
  const forecast = calculateRoundForecast(
    {
      ...gameState,
      investmentsDecision: {
        round: gameState.round,
        investments: [{ type: 'new-machine', quantity: 1, cost: 500000 }],
      },
    },
    { staffing: { assembly: 31, shipping: 8 } },
  )

  assert.deepEqual(forecast.closingState.staffing, {
    machining: 15,
    assembly: 31,
    shipping: 8,
  })
})

test('closing 5S state uses the existing next-state calculation', () => {
  const gameState = createInitialGameState()
  const forecast = calculateRoundForecast({
    ...gameState,
    fiveSDecision: {
      round: gameState.round,
      investedHours: { machining: 100, assembly: 0, shipping: 0 },
    },
  })

  assert.equal(forecast.closingState.lean.fiveS.departments.machining.effectiveHours, 100)
  assert.equal(forecast.closingState.lean.fiveS.departments.assembly.effectiveHours, 0)
  assert.equal(forecast.closingState.lean.fiveS.departments.machining.weight, 0.42)
})

test('closing 5S state preserves decay when no investment is made', () => {
  const gameState = createInitialGameState()
  const forecast = calculateRoundForecast({
    ...gameState,
    fiveSDecision: {
      round: gameState.round,
      investedHours: { machining: 0, assembly: 0, shipping: 0 },
    },
  })

  assert.equal(forecast.closingState.lean.fiveS.departments.machining.effectiveHours, 0)
  assert.equal(forecast.closingState.lean.fiveS.departments.assembly.effectiveHours, 0)
})

test('closing project methods carry cumulative merged hours', () => {
  const gameState = createInitialGameState()
  const forecast = calculateRoundForecast({
    ...gameState,
    projectsDecision: {
      round: gameState.round,
      selections: [{ department: 'machining', method: 'smed', investedHours: 30, cost: 3000 }],
    },
  })

  assert.equal(forecast.closingState.lean.methods.machining.smed, 205)
  assert.equal(forecast.closingState.lean.methods.machining.tpm, 145)
})

test('closing production and factory state include current-round additions', () => {
  const gameState = createInitialGameState()
  const forecast = calculateRoundForecast({
    ...gameState,
    investmentsDecision: {
      round: gameState.round,
      investments: [
        { type: 'new-machine', quantity: 1, cost: 500000 },
        { type: 'factory-expansion', quantity: 1, cost: 1000000 },
      ],
    },
  })

  assert.equal(forecast.closingState.production.machiningMachines, 3)
  assert.equal(forecast.closingState.factory.totalAreaM2, 5000)
  assert.equal(forecast.closingState.factory.expansionsCount, 1)
  assert.equal(forecast.closingState.factory.dispatchM2, gameState.factory.dispatchM2)
  assert.equal(forecast.closingState.factory.officeAndSocialM2, gameState.factory.officeAndSocialM2)
})

test('setup automation is a factory-wide one-time state without a machine id', () => {
  const gameState = createInitialGameState()
  const automationType = DEFAULT_FACTORY_SETTINGS.investments.setupAutomation.type
  const withAutomation = calculateRoundForecast({
    ...gameState,
    investmentsDecision: {
      round: gameState.round,
      investments: [{ type: automationType, quantity: 1, machineId: null, cost: 250000 }],
    },
  })
  const nextRound = {
    ...gameState,
    investments: {
      ...gameState.investments,
      setupAutomation: { installed: true },
    },
    production: { machiningMachines: 3 },
    investmentsDecision: null,
  }
  const installedWithMoreMachines = calculateRoundForecast(nextRound)

  assert.equal(withAutomation.closingState.investments.setupAutomation.installed, true)
  assert.equal(installedWithMoreMachines.closingState.investments.setupAutomation.installed, true)
  assert.equal(
    installedWithMoreMachines.forecast.knl.machining.changeoverHours,
    withAutomation.forecast.knl.machining.changeoverHours,
  )
})

test('legacy installed machine ids migrate to factory-wide setup automation', () => {
  const gameState = createInitialGameState()
  const forecast = calculateRoundForecast({
    ...gameState,
    investments: {
      ...gameState.investments,
      setupAutomation: { installedMachineIds: [2] },
    },
  })

  assert.equal(forecast.closingState.investments.setupAutomation.installed, true)
})

test('legacy investment snapshots also migrate installed machine ids', () => {
  const forecast = calculateRoundForecast(createGameState({ investmentsDecision: null }))

  assert.equal(forecast.closingState.investments.setupAutomation.installed, true)
})

test('factory-wide systems and finished goods use existing forecast results', () => {
  const gameState = createInitialGameState()
  const forecast = calculateRoundForecast({
    ...gameState,
    investmentsDecision: {
      round: gameState.round,
      investments: [
        {
          type: DEFAULT_FACTORY_SETTINGS.investments.automaticProcessMeasurement.type,
          quantity: 1,
          cost: 250000,
        },
        {
          type: DEFAULT_FACTORY_SETTINGS.investments.conditionMonitoring.type,
          quantity: 1,
          cost: 200000,
        },
      ],
    },
  }, {
    market: { addedVariations: 1, runsPerVariation: 3 },
  })

  assert.equal(forecast.closingState.investments.automaticProcessMeasurement.installed, true)
  assert.equal(forecast.closingState.investments.conditionMonitoring.installed, true)
  assert.equal(
    forecast.closingState.inventory.finishedGoodsContainers,
    forecast.forecast.inventory.closingFinishedGoodsInventory,
  )
  assert.equal(
    forecast.closingState.inventory.finishedGoodsBookValue,
    forecast.forecast.inventory.finishedGoodsValue,
  )
})

test('closing equity equals opening equity plus current-round result', () => {
  const gameState = createInitialGameState()
  const forecast = calculateRoundForecast(gameState)

  assert.equal(
    forecast.closingState.finance.equity,
    gameState.finance.equity + forecast.forecast.finance.result,
  )
})

test('closing finance uses 40 percent of materials for raw material inventory', () => {
  const forecast = calculateRoundForecast(createInitialGameState())

  assert.equal(
    forecast.closingState.finance.rawMaterialInventoryBookValue,
    Math.round(Math.abs(forecast.forecast.finance.materials) * 0.4),
  )
})

test('closing finance keeps finished goods and inventory totals consistent', () => {
  const forecast = calculateRoundForecast(createInitialGameState())
  const closingFinance = forecast.closingState.finance

  assert.equal(
    closingFinance.finishedGoodsInventoryBookValue,
    forecast.closingState.inventory.finishedGoodsBookValue,
  )
  assert.equal(
    closingFinance.inventoryBookValue,
    closingFinance.finishedGoodsInventoryBookValue + closingFinance.rawMaterialInventoryBookValue,
  )
})

test('closing finance splits depreciation across machinery and buildings', () => {
  const forecast = calculateRoundForecast(createInitialGameState())
  const closingInputs = forecast.forecast

  assert.equal(
    closingInputs.finance.machineryDepreciation + closingInputs.finance.buildingDepreciation,
    closingInputs.finance.depreciation,
  )
  assert.equal(
    forecast.closingState.finance.machineryBookValue,
    createInitialGameState().finance.machineryBookValue - closingInputs.finance.machineryDepreciation,
  )
  assert.equal(
    forecast.closingState.finance.buildingsBookValue,
    createInitialGameState().finance.buildingsBookValue - closingInputs.finance.buildingDepreciation,
  )
})

test('machine and factory expansion investments use separate closing asset classes', () => {
  const gameState = createInitialGameState()
  const forecast = calculateRoundForecast({
    ...gameState,
    investmentsDecision: {
      round: gameState.round,
      investments: [
        { type: 'new-machine', quantity: 1, cost: 500000 },
        { type: 'factory-expansion', quantity: 1, cost: 1000000 },
      ],
    },
  })

  assert.equal(
    forecast.closingState.finance.machineryBookValue,
    gameState.finance.machineryBookValue + 500000 - forecast.forecast.finance.machineryDepreciation,
  )
  assert.equal(
    forecast.closingState.finance.buildingsBookValue,
    gameState.finance.buildingsBookValue + 1000000 - forecast.forecast.finance.buildingDepreciation,
  )
})

test('closing other liabilities use the canonical raw material share', () => {
  const forecast = calculateRoundForecast(createInitialGameState())
  const expected = Math.round(
    Math.abs(forecast.forecast.finance.materials) *
      DEFAULT_FACTORY_SETTINGS.finance.otherLiabilitiesRawMaterialShare,
  )

  assert.equal(forecast.closingState.finance.otherLiabilities, expected)
})

test('positive financing need keeps target cash and creates non-negative debt', () => {
  const forecast = calculateRoundForecast(createInitialGameState())
  const closingFinance = forecast.closingState.finance

  assert.equal(closingFinance.cash, DEFAULT_FACTORY_SETTINGS.finance.targetCash)
  assert.equal(closingFinance.bankLoans >= 0, true)
})

test('non-positive financing need pays off debt and retains excess cash', () => {
  const gameState = createInitialGameState()
  const forecast = calculateRoundForecast({
    ...gameState,
    finance: {
      ...gameState.finance,
      equity: 10000000,
      bankLoans: 0,
    },
  })

  assert.equal(forecast.closingState.finance.bankLoans, 0)
  assert.equal(forecast.closingState.finance.cash > DEFAULT_FACTORY_SETTINGS.finance.targetCash, true)
})

test('closing balance sheet identity holds for baseline and investment scenarios', () => {
  const scenarios = [
    createInitialGameState(),
    {
      ...createInitialGameState(),
      investmentsDecision: {
        round: 1,
        investments: [
          { type: 'new-machine', quantity: 1, cost: 500000 },
          { type: 'factory-expansion', quantity: 1, cost: 1000000 },
        ],
      },
    },
  ]

  scenarios.forEach((gameState) => {
    const closingFinance = calculateRoundForecast(gameState).closingState.finance
    assert.equal(closingFinance.totalAssets, closingFinance.totalLiabilitiesAndEquity)
  })
})

test('round two opening debt and interest use round one closing debt', () => {
  const roundOne = createInitialGameState()
  const roundOneForecast = calculateRoundForecast(roundOne)
  const roundOneClosingFinance = roundOneForecast.closingState.finance
  const roundTwo = {
    ...roundOne,
    round: 2,
    finance: {
      ...roundOne.finance,
      ...roundOneClosingFinance,
    },
  }
  const roundTwoForecast = calculateRoundForecast(roundTwo)

  assert.equal(
    roundTwoForecast.forecast.finance.openingInterestBearingDebt,
    roundOneClosingFinance.bankLoans,
  )
  assert.equal(
    roundTwoForecast.forecast.finance.interest,
    roundOneClosingFinance.bankLoans * roundTwoForecast.forecast.finance.roundInterestRate,
  )
})
