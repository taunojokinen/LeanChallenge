import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateKNL } from '../../shared/forecast/knl.js'
import { calculateFactoryKnl } from '../../shared/forecast/factoryKnl.js'
import { calculateDevelopedKnlValue } from '../../shared/forecast/knlDevelopment.js'
import { DEFAULT_FACTORY_SETTINGS } from '../../shared/factory-settings/defaultFactorySettings.js'
import { calculateFinancingStructure } from '../../shared/factory-settings/financingStructure.js'
import { calculateNextFiveSState } from '../../shared/five-s/model.js'
import { calculateFactorySpace, calculateMinimumFinishedGoodsContainers } from '../../shared/factory-space/model.js'

test('backend imports shared KNL calculations as ES modules', () => {
  assert.equal(calculateKNL(80, 90, 95), 0.684)
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
