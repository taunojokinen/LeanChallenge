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
