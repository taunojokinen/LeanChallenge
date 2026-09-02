import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_FACTORY_SETTINGS } from './defaultFactorySettings.js'
import { createInitialGameState } from './initialGameState.js'
import {
  buildInitialIncomeHistory,
  buildInitialBalanceSheetHistory,
} from './financialHistory.js'
import { buildIncomeStatementRows } from '../income/model.js'
import { buildBalanceSheetViewModel } from '../balance-sheet/model.js'

test('createInitialGameState has canonical round-0 finance anchors', () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)

  assert.equal(gameState.finance.cash, 50000)
  assert.equal(gameState.finance.bankLoans, 420000)
  assert.equal(gameState.finance.equity, 2407600)
})

test('initial inventory split and total book value are canonical', () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)

  assert.equal(gameState.finance.finishedGoodsInventoryBookValue, 1645000)
  assert.equal(gameState.finance.rawMaterialInventoryBookValue, 500000)
  assert.equal(gameState.finance.inventoryBookValue, 2145000)
})

test('round-0 balance sheet balances to 5 695 000', () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const history = buildInitialBalanceSheetHistory(gameState, DEFAULT_FACTORY_SETTINGS)

  const assetsTotal =
    history.assets.buildings +
    history.assets.machinery +
    history.assets.finishedGoodsInventory +
    history.assets.rawMaterialInventory +
    history.assets.cash

  const liabilitiesTotal =
    history.liabilities.equity +
    history.liabilities.interestBearingDebt +
    history.liabilities.otherLiabilities +
    history.liabilities.overdraft

  assert.equal(assetsTotal, 5695000)
  assert.equal(liabilitiesTotal, 5695000)
})

test('round-0 income statement result is -350 000', () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const history = buildInitialIncomeHistory(gameState, DEFAULT_FACTORY_SETTINGS)
  const rows = buildIncomeStatementRows(history)
  const resultRow = rows.find((row) => row.key === 'result')

  assert.ok(resultRow)
  assert.equal(resultRow.amountText.replace(/\s/g, ' '), '-350 000 €')
})

test('round-minus-one comparison is present and sums correctly', () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const incomeHistory = buildInitialIncomeHistory(gameState, DEFAULT_FACTORY_SETTINGS)
  const balanceHistory = buildInitialBalanceSheetHistory(gameState, DEFAULT_FACTORY_SETTINGS)

  assert.equal(incomeHistory.previousRound, -1)
  assert.equal(incomeHistory.round, 0)
  assert.equal(balanceHistory.previousRound, -1)
  assert.equal(balanceHistory.round, 0)

  const previousIncome = incomeHistory.previousRows
  const previousResult =
    previousIncome.revenue.amount -
    previousIncome.materials.amount -
    previousIncome.labor.amount -
    previousIncome.fixedCosts.amount +
    previousIncome.inventoryChange.amount -
    previousIncome.depreciation.amount -
    previousIncome.financingCosts.amount

  assert.equal(previousResult, -343000)

  const previousAssetsTotal =
    balanceHistory.previousAssets.buildings +
    balanceHistory.previousAssets.machinery +
    balanceHistory.previousAssets.finishedGoodsInventory +
    balanceHistory.previousAssets.rawMaterialInventory +
    balanceHistory.previousAssets.cash

  const previousLiabilitiesTotal =
    balanceHistory.previousLiabilities.equity +
    balanceHistory.previousLiabilities.interestBearingDebt +
    balanceHistory.previousLiabilities.otherLiabilities +
    balanceHistory.previousLiabilities.overdraft

  assert.equal(previousAssetsTotal, previousLiabilitiesTotal)
})

test('financial pages initial comparison model is not round 3/4', () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const incomeHistory = buildInitialIncomeHistory(gameState, DEFAULT_FACTORY_SETTINGS)
  const balanceHistory = buildInitialBalanceSheetHistory(gameState, DEFAULT_FACTORY_SETTINGS)

  assert.equal(incomeHistory.previousRound, -1)
  assert.equal(incomeHistory.round, 0)
  assert.equal(balanceHistory.previousRound, -1)
  assert.equal(balanceHistory.round, 0)

  const balanceView = buildBalanceSheetViewModel(balanceHistory, 1.5)
  assert.equal(balanceView.round, 0)
  assert.equal(balanceView.previousRound, -1)
  const debtRow = balanceView.liabilitiesRows.find((row) => row.key === 'bankLoans')
  assert.ok(debtRow)
  assert.equal(debtRow.currentValue.replace(/\s/g, ' '), '420 000 €')

  const liabilitiesTotalRow = balanceView.liabilitiesRows.find((row) => row.key === 'liabilitiesTotal')
  assert.ok(liabilitiesTotalRow)
  assert.equal(liabilitiesTotalRow.currentValue.replace(/\s/g, ' '), '5 695 000 €')
})
