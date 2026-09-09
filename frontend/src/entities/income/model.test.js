import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_FACTORY_SETTINGS } from '../factory-settings/defaultFactorySettings.js'
import { createInitialGameState } from '../factory-settings/initialGameState.js'
import { buildInitialIncomeHistory } from '../factory-settings/financialHistory.js'
import { getInitialIncomeHistory } from '../../shared/api/incomeApi.js'
import { buildIncomeHistoryView, buildIncomeStatementRows } from './model.js'
import { calculateRoundForecast } from '../forecast/model.js'
import { advanceRoundState } from '../game-round/advanceRound.js'

function runtimeEntry(round, result, deliveries) {
  return {
    round,
    incomeStatement: {
      revenue: 6440000,
      materials: 1320000,
      labor: 1500000,
      fixedCosts: 750000,
      inventoryChange: 50000,
      depreciation: 103125,
      interest: 17500,
      result,
    },
    production: {
      deliveries,
      actualProduction: deliveries,
      demand: deliveries,
      lostSalesUnits: 0,
    },
  }
}

test('income history starts with canonical rounds -1 and 0', () => {
  const baseline = buildInitialIncomeHistory(createInitialGameState(), DEFAULT_FACTORY_SETTINGS)
  const view = buildIncomeHistoryView({ baselineHistory: baseline, runtimeHistory: [] })
  const rows = buildIncomeStatementRows(view)
  const result = rows.find((row) => row.key === 'result')
  const financing = rows.find((row) => row.key === 'financingCosts')

  assert.equal(view.previousRound, -1)
  assert.equal(view.round, 0)
  assert.equal(rows.find((row) => row.key === 'sales').currentAmount, 134)
  assert.equal(result.currentAmount, 648135.625)
  assert.equal(financing.currentAmount, -36973.75)
})

test('actual income API baseline pipeline preserves round zero values', async () => {
  const baseline = await getInitialIncomeHistory(createInitialGameState(), DEFAULT_FACTORY_SETTINGS)
  const view = buildIncomeHistoryView({ baselineHistory: baseline, runtimeHistory: [] })
  const rows = buildIncomeStatementRows(view)
  const values = Object.fromEntries(rows.map((row) => [row.key, row.currentAmount]))

  assert.equal(values.sales, 134)
  assert.equal(values.revenue, 3350000)
  assert.equal(values.inventoryChange, 25000)
  assert.equal(values.materials, -1340000)
  assert.equal(values.labor, -500000)
  assert.equal(values.grossMargin, 1535000)
  assert.equal(values.fixedCosts, -750000)
  assert.equal(values.depreciation, -99890.625)
  assert.equal(values.financingCosts, -36973.75)
  assert.equal(values.result, 648135.625)
})

test('income history selects rounds zero and one after first confirmation', () => {
  const baseline = buildInitialIncomeHistory(createInitialGameState(), DEFAULT_FACTORY_SETTINGS)
  const view = buildIncomeHistoryView({
    baselineHistory: baseline,
    runtimeHistory: [runtimeEntry(1, 100, 250)],
  })

  assert.equal(view.previousRound, 0)
  assert.equal(view.round, 1)
  assert.equal(view.rows.sales.amount, 250)
})

test('income history selects the two latest confirmed runtime rounds', () => {
  const baseline = buildInitialIncomeHistory(createInitialGameState(), DEFAULT_FACTORY_SETTINGS)
  const view = buildIncomeHistoryView({
    baselineHistory: baseline,
    runtimeHistory: [runtimeEntry(1, 100, 200), runtimeEntry(2, 500, 240), runtimeEntry(3, 1726956, 280)],
  })
  const rows = buildIncomeStatementRows(view)

  assert.equal(view.previousRound, 2)
  assert.equal(view.round, 3)
  assert.equal(rows.find((row) => row.key === 'result').currentAmount, 1726956)
  assert.equal(rows.find((row) => row.key === 'sales').currentAmount, 280)
  assert.equal(rows.find((row) => row.key === 'financingCosts').currentAmount, -17500)
})

test('zero previous values produce finite change values', () => {
  const baseline = buildInitialIncomeHistory(createInitialGameState(), DEFAULT_FACTORY_SETTINGS)
  const view = buildIncomeHistoryView({
    baselineHistory: baseline,
    runtimeHistory: [runtimeEntry(1, 100, 0), runtimeEntry(2, 200, 10)],
  })
  const rows = buildIncomeStatementRows(view)

  rows.forEach((row) => {
    assert.equal(row.deltaText.includes('Infinity'), false)
    assert.equal(row.deltaText.includes('NaN'), false)
  })
})

test('real round-one confirmation selects canonical round zero and runtime round one', async () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const forecast = calculateRoundForecast(
    gameState,
    { market: { price: 25500, addedVariations: 1, productionQuantity: 100 } },
    DEFAULT_FACTORY_SETTINGS,
  )
  const advanced = advanceRoundState({ gameState, forecast, totalRounds: 12 })
  const baseline = await getInitialIncomeHistory(advanced.nextGameState, DEFAULT_FACTORY_SETTINGS)
  const view = buildIncomeHistoryView({
    baselineHistory: baseline,
    runtimeHistory: advanced.nextGameState.history,
  })
  const rows = buildIncomeStatementRows(view)

  assert.equal(view.previousRound, 0)
  assert.equal(view.round, 1)
  assert.equal(rows.find((row) => row.key === 'result').currentAmount, forecast.forecast.finance.result)
})
