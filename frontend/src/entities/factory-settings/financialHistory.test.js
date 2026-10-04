import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_FACTORY_SETTINGS } from './defaultFactorySettings.js'
import { createInitialGameState } from './initialGameState.js'
import {
  assertCanonicalFinancialHistoryEntry,
  buildCanonicalFinancialHistory,
  buildInitialBalanceSheetHistory,
  buildInitialIncomeHistory,
} from './financialHistory.js'
import { buildIncomeHistoryView } from '../income/model.js'
import { buildBalanceSheetHistoryView } from '../balance-sheet/model.js'

function settingsWithProduction(quantity) {
  return {
    ...structuredClone(DEFAULT_FACTORY_SETTINGS),
    production: {
      ...structuredClone(DEFAULT_FACTORY_SETTINGS.production),
      initialProductionQuantity: quantity,
    },
  }
}

function generated(quantity = 134) {
  return buildCanonicalFinancialHistory(undefined, settingsWithProduction(quantity))
}

test('initial game state keeps canonical gameplay opening anchors', () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)

  assert.equal(gameState.round, 1)
  assert.equal(gameState.finance.cash, 50000)
  assert.equal(gameState.finance.bankLoans, 2957900)
  assert.equal(gameState.finance.equity, 2073975)
  assert.equal(gameState.finance.otherLiabilities, 660000)
  assert.equal(gameState.finance.machineryBookValue, 498750)
  assert.equal(gameState.finance.buildingsBookValue, 2998125)
  assert.equal(gameState.finance.finishedGoodsInventoryBookValue, 1645000)
  assert.equal(gameState.finance.rawMaterialInventoryBookValue, 500000)
})

test('generated history uses canonical finished-goods valuation and inventory change', () => {
  const entries = generated()

  assert.deepEqual(entries.map((entry) => entry.round), [-2, -1, 0])
  assert.deepEqual(entries.map((entry) => entry.incomeStatement.salesUnits), [124, 129, 134])
  assert.deepEqual(entries.map((entry) => entry.incomeStatement.labor), [1391250, 1391250, 1391250])
  assert.deepEqual(entries.map((entry) => entry.incomeStatement.materials), [1488000, 1548000, 1608000])
  assert.deepEqual(entries.map((entry) => entry.finance.rawMaterialInventoryBookValue), [595200, 619200, 643200])
  assert.deepEqual(entries.map((entry) => entry.finance.finishedGoodsInventoryBookValue), [2000000, 2000000, 2000000])
  assert.deepEqual(entries.map((entry) => entry.incomeStatement.inventoryChange), [0, 0, 0])
})

test('teacher production setting derives all historical production quantities', () => {
  assert.deepEqual(generated(134).map((entry) => entry.incomeStatement.salesUnits), [124, 129, 134])
  assert.deepEqual(generated(120).map((entry) => entry.incomeStatement.salesUnits), [110, 115, 120])
  assert.deepEqual(generated(150).map((entry) => entry.incomeStatement.salesUnits), [140, 145, 150])
  assert.deepEqual(generated(7).map((entry) => entry.incomeStatement.salesUnits), [0, 2, 7])
  assert.deepEqual(generated(3).map((entry) => entry.incomeStatement.salesUnits), [0, 0, 3])
})

test('rounds -1 and 0 derive revenue, materials, FG and payables from canonical settings', () => {
  const entries = buildCanonicalFinancialHistory()
  const [roundMinusTwo, roundMinusOne, roundZero] = entries
  const settings = DEFAULT_FACTORY_SETTINGS
  const { materialCostPerContainer } = settings.costs
  const { referencePrice } = settings.market
  const { finishedGoodsValuePerContainer, rawMaterialInventoryShare } = settings.inventory
  const { otherLiabilitiesRawMaterialShare } = settings.finance

  assert.equal(roundMinusOne.incomeStatement.salesUnits, 145)
  assert.equal(roundZero.incomeStatement.salesUnits, 150)
  assert.equal(roundMinusOne.incomeStatement.revenue, 145 * referencePrice)
  assert.equal(roundZero.incomeStatement.revenue, 150 * referencePrice)
  assert.equal(roundMinusOne.incomeStatement.materials, 145 * materialCostPerContainer)
  assert.equal(roundZero.incomeStatement.materials, 150 * materialCostPerContainer)
  assert.equal(roundMinusOne.finance.finishedGoodsInventoryBookValue, 100 * finishedGoodsValuePerContainer)
  assert.equal(roundZero.finance.finishedGoodsInventoryBookValue, 100 * finishedGoodsValuePerContainer)
  assert.equal(roundMinusOne.incomeStatement.inventoryChange, 0)
  assert.equal(roundZero.incomeStatement.inventoryChange, 0)

  for (const entry of [roundMinusTwo, roundMinusOne, roundZero]) {
    assert.equal(
      entry.finance.rawMaterialInventoryBookValue,
      Math.round(entry.incomeStatement.materials * rawMaterialInventoryShare),
    )
    assert.equal(
      entry.finance.otherLiabilities,
      Math.round(entry.incomeStatement.materials * otherLiabilitiesRawMaterialShare),
    )
  }
})

test('presentation baseline exposes only rounds -1 and 0 while retaining technical round -2', () => {
  const income = buildInitialIncomeHistory(undefined, settingsWithProduction(134))
  const balance = buildInitialBalanceSheetHistory(undefined, settingsWithProduction(134))
  const incomeView = buildIncomeHistoryView({ baselineHistory: income })
  const balanceView = buildBalanceSheetHistoryView({ baselineHistory: balance })

  assert.deepEqual(income.entries.map((entry) => entry.round), [-2, -1, 0])
  assert.equal(incomeView.previousRound, -1)
  assert.equal(incomeView.round, 0)
  assert.equal(balanceView.previousRound, -1)
  assert.equal(balanceView.round, 0)
})

test('canonical generated entries reject missing required fields', () => {
  const incomplete = structuredClone(generated()[2])
  delete incomplete.incomeStatement.revenue

  assert.throws(
    () => assertCanonicalFinancialHistoryEntry(incomplete),
    /incomeStatement\.revenue/,
  )
})

test('generated historical balance sheets are balanced without a balancing line', () => {
  const entries = buildCanonicalFinancialHistory()

  entries.forEach((entry) => {
    assert.equal(entry.finance.totalAssets, entry.finance.totalLiabilitiesAndEquity)
  })
})

test('historical depreciation and interest use the same opening-balance runtime rules', () => {
  const entries = buildCanonicalFinancialHistory()
  const settings = DEFAULT_FACTORY_SETTINGS
  let openingFinance = createInitialGameState(settings).finance
  const roundRate = settings.finance.annualInterestRate * settings.game.monthsPerRound / 12

  entries.forEach((entry) => {
    const expectedDepreciation =
      openingFinance.machineryBookValue * settings.finance.machineryDepreciationPerRound +
      openingFinance.buildingsBookValue * settings.finance.buildingDepreciationPerRound

    assert.equal(entry.incomeStatement.depreciation, expectedDepreciation)
    assert.ok(
      Math.abs(entry.incomeStatement.financingCosts - openingFinance.bankLoans * roundRate) < 1e-9,
    )
    openingFinance = entry.finance
  })
})