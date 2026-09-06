import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_FACTORY_SETTINGS } from './defaultFactorySettings.js'
import { calculateFinancingStructure } from './financingStructure.js'

test('financing structure round-0 case uses target cash and raw-material share', () => {
  const result = calculateFinancingStructure({
    nonCashAssets: 5641875,
    equity: 2073975,
    rawMaterialCosts: 1320000,
    factorySettings: DEFAULT_FACTORY_SETTINGS,
  })

  assert.equal(result.otherLiabilities, 660000)
  assert.equal(result.cash, 50000)
  assert.equal(result.interestBearingDebt, 2957900)
  assert.equal(result.totalAssets, 5691875)
  assert.equal(result.totalEquityAndLiabilities, 5691875)
})

test('financing structure with surplus keeps debt at zero and grows cash', () => {
  const result = calculateFinancingStructure({
    nonCashAssets: 1000000,
    equity: 1700000,
    rawMaterialCosts: 200000,
    factorySettings: DEFAULT_FACTORY_SETTINGS,
  })

  assert.equal(result.financingNeed < 0, true)
  assert.equal(result.interestBearingDebt, 0)
  assert.equal(result.cash > 50000, true)
  assert.equal(result.totalAssets, result.totalEquityAndLiabilities)
})

test('financing structure boundary with zero financing need keeps target cash and zero debt', () => {
  const result = calculateFinancingStructure({
    nonCashAssets: 1000000,
    equity: 950000,
    rawMaterialCosts: 200000,
    factorySettings: DEFAULT_FACTORY_SETTINGS,
  })

  assert.equal(result.financingNeed, 0)
  assert.equal(result.interestBearingDebt, 0)
  assert.equal(result.cash, 50000)
})

test('other liabilities follow raw-material cost share', () => {
  const result = calculateFinancingStructure({
    nonCashAssets: 0,
    equity: 0,
    rawMaterialCosts: 1000000,
    factorySettings: DEFAULT_FACTORY_SETTINGS,
  })

  assert.equal(result.otherLiabilities, 500000)
})

test('negative raw-material sign does not change other liabilities', () => {
  const result = calculateFinancingStructure({
    nonCashAssets: 0,
    equity: 0,
    rawMaterialCosts: -1000000,
    factorySettings: DEFAULT_FACTORY_SETTINGS,
  })

  assert.equal(result.otherLiabilities, 500000)
})

test('interest-bearing debt is never negative', () => {
  const result = calculateFinancingStructure({
    nonCashAssets: 1000000,
    equity: 2000000,
    rawMaterialCosts: 100000,
    factorySettings: DEFAULT_FACTORY_SETTINGS,
  })

  assert.equal(result.interestBearingDebt >= 0, true)
})