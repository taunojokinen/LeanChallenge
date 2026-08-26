import test from 'node:test'
import assert from 'node:assert/strict'
import fiveSSnapshot from '../../mocks/fiveSSnapshot.json' with { type: 'json' }
import projectsSnapshot from '../../mocks/projectsSnapshot.json' with { type: 'json' }
import investmentsSnapshot from '../../mocks/investmentsSnapshot.json' with { type: 'json' }
import balanceSheetSnapshot from '../../mocks/balanceSheetSnapshot.json' with { type: 'json' }
import productionSnapshot from '../../mocks/productionSnapshot.json' with { type: 'json' }
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
        { type: 'new-machine', quantity: 1, cost: 500000 },
        { type: 'factory-expansion', quantity: 1, cost: 1000000 },
      ],
    },
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

test('deliveries equal min(demand, capacity)', () => {
  const forecast = calculateRoundForecast(createGameState())
  assert.equal(forecast.forecast.deliveries, Math.min(forecast.forecast.demand, forecast.forecast.plantCapacity))
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

  assert.equal(Math.round(inv.finishedGoodsValue), Math.round(inv.averageFinishedGoodsInventory * 20000))
  assert.equal(Math.round(inv.finishedGoodsArea), Math.round(inv.averageFinishedGoodsInventory * 15))
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

  assert.equal(forecast.summary.actualProduction <= forecast.summary.demand, true)
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

  assert.equal(forecast.summary.lostSalesUnits, forecast.summary.demand - forecast.summary.actualProduction)
  assert.equal(forecast.summary.lostSalesUnits > 0, true)
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
