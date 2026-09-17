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

test('default generated history uses effective production 124, 129, 134', () => {
  const entries = generated()

  assert.deepEqual(entries.map((entry) => entry.round), [-2, -1, 0])
  assert.deepEqual(entries.map((entry) => entry.incomeStatement.salesUnits), [124, 129, 134])
  assert.deepEqual(entries.map((entry) => entry.incomeStatement.labor), [1391250, 1391250, 1391250])
  assert.deepEqual(entries.map((entry) => entry.incomeStatement.materials), [1488000, 1548000, 1608000])
  assert.deepEqual(entries.map((entry) => entry.finance.rawMaterialInventoryBookValue), [595200, 619200, 643200])
  assert.deepEqual(entries.map((entry) => entry.finance.finishedGoodsInventoryBookValue), [620000, 645000, 670000])
  assert.deepEqual(entries.map((entry) => entry.incomeStatement.inventoryChange), [-1025000, 25000, 25000])
})

test('teacher production setting derives all historical production quantities', () => {
  assert.deepEqual(generated(134).map((entry) => entry.incomeStatement.salesUnits), [124, 129, 134])
  assert.deepEqual(generated(120).map((entry) => entry.incomeStatement.salesUnits), [110, 115, 120])
  assert.deepEqual(generated(150).map((entry) => entry.incomeStatement.salesUnits), [140, 145, 150])
  assert.deepEqual(generated(7).map((entry) => entry.incomeStatement.salesUnits), [0, 2, 7])
  assert.deepEqual(generated(3).map((entry) => entry.incomeStatement.salesUnits), [0, 0, 3])
})

test('generated finished-goods values preserve decimal container precision', () => {
  const entries = generated()

  assert.equal(entries[0].finance.finishedGoodsInventoryBookValue, 620000)
  assert.equal(entries[1].finance.finishedGoodsInventoryBookValue, 645000)
  assert.equal(entries[2].finance.finishedGoodsInventoryBookValue, 670000)
  assert.equal(entries[1].incomeStatement.inventoryChange, 25000)
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

test('round-zero finance remains anchored while round-minus-one closes to the same anchor', () => {
  const entries = generated()
  const opening = createInitialGameState(DEFAULT_FACTORY_SETTINGS).finance
  const roundMinusOne = entries[1]
  const roundZero = entries[2]

  for (const field of ['cash', 'bankLoans', 'equity', 'machineryBookValue', 'buildingsBookValue']) {
    assert.equal(roundZero.finance[field], opening[field])
    assert.equal(roundMinusOne.finance[field], opening[field])
  }

  assert.equal(roundMinusOne.incomeStatement.labor, 1391250)
  assert.equal(roundMinusOne.incomeStatement.materials, 1548000)
  assert.equal(roundMinusOne.incomeStatement.inventoryChange, 25000)
})

test('historical depreciation and interest use runtime opening values and rates', () => {
  const entries = generated()
  const settings = DEFAULT_FACTORY_SETTINGS
  const roundMinusOne = entries[1]
  const roundZero = entries[2]
  const roundRate = settings.finance.annualInterestRate * settings.game.monthsPerRound / 12

  assert.equal(roundMinusOne.incomeStatement.depreciation, 26250 + 76875)
  assert.ok(Math.abs(roundMinusOne.incomeStatement.financingCosts - 2957900 * roundRate) < 1e-9)
  assert.equal(roundZero.incomeStatement.depreciation, 498750 * 0.05 + 2998125 * 0.025)
  assert.ok(Math.abs(roundZero.incomeStatement.financingCosts - 2957900 * roundRate) < 1e-9)
})