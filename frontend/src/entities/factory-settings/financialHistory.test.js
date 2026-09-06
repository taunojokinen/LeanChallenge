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
  assert.equal(gameState.finance.bankLoans, 2957900)
  assert.equal(gameState.finance.equity, 2073975)
  assert.equal(gameState.finance.otherLiabilities, 660000)
  assert.equal(gameState.finance.machineryBookValue, 498750)
  assert.equal(gameState.finance.buildingsBookValue, 2998125)
})

test('initial inventory split and total book value are canonical', () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)

  assert.equal(gameState.finance.finishedGoodsInventoryBookValue, 1645000)
  assert.equal(gameState.finance.rawMaterialInventoryBookValue, 500000)
  assert.equal(gameState.finance.inventoryBookValue, 2145000)
})

test('round-0 balance sheet balances to 5 691 875', () => {
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

  assert.equal(assetsTotal, 5691875)
  assert.equal(liabilitiesTotal, 5691875)
})

test('round-0 income statement result is -340 625', () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const history = buildInitialIncomeHistory(gameState, DEFAULT_FACTORY_SETTINGS)
  const rows = buildIncomeStatementRows(history)
  const resultRow = rows.find((row) => row.key === 'result')
  const depreciationRow = rows.find((row) => row.key === 'depreciation')
  const financingCostsRow = rows.find((row) => row.key === 'financingCosts')

  assert.ok(resultRow)
  assert.ok(depreciationRow)
  assert.ok(financingCostsRow)
  assert.equal(resultRow.previousAmountText.replace(/\s/g, ' '), '-343 000 €')
  assert.equal(resultRow.currentAmountText.replace(/\s/g, ' ').replace(/−/g, '-'), '-340 625 €')
  assert.equal(resultRow.amountText.replace(/\s/g, ' ').replace(/−/g, '-'), '-340 625 €')
  assert.equal(depreciationRow.currentAmountText.replace(/\s/g, ' ').replace(/−/g, '-'), '-103 125 €')
  assert.equal(financingCostsRow.previousAmountText.replace(/\s/g, ' ').replace(/−/g, '-'), '-16 000 €')
})

test('round -1 to 0 depreciation and fixed-asset continuity use canonical rates', () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const incomeHistory = buildInitialIncomeHistory(gameState, DEFAULT_FACTORY_SETTINGS)
  const balanceHistory = buildInitialBalanceSheetHistory(gameState, DEFAULT_FACTORY_SETTINGS)

  const previousMachinery = balanceHistory.previousAssets.machinery
  const previousBuildings = balanceHistory.previousAssets.buildings

  const machineryDepreciation = Math.round(
    previousMachinery * DEFAULT_FACTORY_SETTINGS.finance.machineryDepreciationPerRound,
  )
  const buildingDepreciation = Math.round(
    previousBuildings * DEFAULT_FACTORY_SETTINGS.finance.buildingDepreciationPerRound,
  )
  const totalDepreciation = machineryDepreciation + buildingDepreciation

  assert.equal(machineryDepreciation, 26250)
  assert.equal(buildingDepreciation, 76875)
  assert.equal(totalDepreciation, 103125)

  assert.equal(balanceHistory.assets.machinery, 498750)
  assert.equal(balanceHistory.assets.buildings, 2998125)

  const result =
    incomeHistory.rows.revenue.amount +
    incomeHistory.rows.inventoryChange.amount -
    incomeHistory.rows.materials.amount -
    incomeHistory.rows.labor.amount -
    incomeHistory.rows.fixedCosts.amount -
    incomeHistory.rows.depreciation.amount -
    incomeHistory.rows.financingCosts.amount

  assert.equal(incomeHistory.rows.depreciation.amount, 103125)
  assert.equal(result, -340625)

  const expectedEquity =
    balanceHistory.previousLiabilities.equity +
    result

  assert.equal(expectedEquity, 2073975)
  assert.equal(balanceHistory.liabilities.equity, 2073975)
  assert.equal(balanceHistory.liabilities.otherLiabilities, 660000)
  assert.equal(balanceHistory.liabilities.bankLoans, 2957900)
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

  assert.equal(balanceHistory.previousAssets.cash, 50000)
  assert.equal(balanceHistory.previousLiabilities.equity, 2414600)
  assert.equal(balanceHistory.previousLiabilities.bankLoans, 2706400)
  assert.equal(balanceHistory.previousLiabilities.otherLiabilities, 659000)

  const revenueRow = buildIncomeStatementRows(incomeHistory).find((row) => row.key === 'revenue')
  assert.ok(revenueRow)
  assert.equal(revenueRow.previousAmountText.replace(/\s/g, ' '), '3 310 000 €')
  assert.equal(revenueRow.currentAmountText.replace(/\s/g, ' '), '3 300 000 €')

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

  assert.equal(previousAssetsTotal, 5780000)
  assert.equal(previousLiabilitiesTotal, 5780000)
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
  assert.equal(debtRow.previousValue.replace(/\s/g, ' '), '2 706 400 €')
  assert.equal(debtRow.currentValue.replace(/\s/g, ' '), '2 957 900 €')

  const liabilitiesTotalRow = balanceView.liabilitiesRows.find((row) => row.key === 'liabilitiesTotal')
  assert.ok(liabilitiesTotalRow)
  assert.equal(liabilitiesTotalRow.previousValue.replace(/\s/g, ' '), '5 780 000 €')
  assert.equal(liabilitiesTotalRow.currentValue.replace(/\s/g, ' '), '5 691 875 €')
})

test('balance sheet subtotal rows show fixed assets and inventory without changing total assets', () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const balanceHistory = buildInitialBalanceSheetHistory(gameState, DEFAULT_FACTORY_SETTINGS)
  const balanceView = buildBalanceSheetViewModel(balanceHistory, 1.5)

  const fixedAssetsRow = balanceView.assetsRows.find((row) => row.key === 'fixedAssets')
  const inventoryRow = balanceView.assetsRows.find((row) => row.key === 'inventory')
  const assetsTotalRow = balanceView.assetsRows.find((row) => row.key === 'assetsTotal')

  assert.ok(fixedAssetsRow)
  assert.ok(inventoryRow)
  assert.ok(assetsTotalRow)

  assert.equal(fixedAssetsRow.kind, 'subtotal')
  assert.equal(inventoryRow.kind, 'subtotal')
  assert.equal(fixedAssetsRow.previousValue.replace(/\s/g, ' '), '3 600 000 €')
  assert.equal(fixedAssetsRow.currentValue.replace(/\s/g, ' '), '3 496 875 €')
  assert.equal(inventoryRow.previousValue.replace(/\s/g, ' '), '2 130 000 €')
  assert.equal(inventoryRow.currentValue.replace(/\s/g, ' '), '2 145 000 €')
  assert.equal(assetsTotalRow.currentValue.replace(/\s/g, ' '), '5 691 875 €')
})

test('round-0 financing structure follows target cash and raw-material liability share', () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const balanceHistory = buildInitialBalanceSheetHistory(gameState, DEFAULT_FACTORY_SETTINGS)

  assert.equal(balanceHistory.assets.cash, 50000)
  assert.equal(balanceHistory.liabilities.equity, 2073975)
  assert.equal(balanceHistory.liabilities.bankLoans, 2957900)
  assert.equal(balanceHistory.liabilities.otherLiabilities, 660000)

  const totalAssets =
    balanceHistory.assets.buildings +
    balanceHistory.assets.machinery +
    balanceHistory.assets.finishedGoodsInventory +
    balanceHistory.assets.rawMaterialInventory +
    balanceHistory.assets.cash
  const totalEquityAndLiabilities =
    balanceHistory.liabilities.equity +
    balanceHistory.liabilities.bankLoans +
    balanceHistory.liabilities.otherLiabilities +
    balanceHistory.liabilities.overdraft

  assert.equal(totalAssets, 5691875)
  assert.equal(totalEquityAndLiabilities, 5691875)
  assert.equal(totalAssets - totalEquityAndLiabilities, 0)
})

test('income result row marks both comparison values as negative for current canonical baseline', () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const incomeHistory = buildInitialIncomeHistory(gameState, DEFAULT_FACTORY_SETTINGS)
  const resultRow = buildIncomeStatementRows(incomeHistory).find((row) => row.key === 'result')

  assert.ok(resultRow)
  assert.equal(resultRow.previousAmount < 0, true)
  assert.equal(resultRow.currentAmount < 0, true)
  assert.equal(resultRow.previousAmount, -343000)
  assert.equal(resultRow.currentAmount, -340625)
})
