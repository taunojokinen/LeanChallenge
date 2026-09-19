import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_FACTORY_SETTINGS } from '../factory-settings/defaultFactorySettings.js'
import { createInitialGameState } from '../factory-settings/initialGameState.js'
import { buildInitialIncomeHistory } from '../factory-settings/financialHistory.js'
import { getInitialIncomeHistory } from '../../shared/api/incomeApi.js'
import { buildIncomeForecastView, buildIncomeHistoryView, buildIncomeStatementRows } from './model.js'
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
  // Fresh-game 5S baseline is 0h (2026-09 fix), so machining is again the round-0 bottleneck.
  assert.equal(rows.find((row) => row.key === 'sales').currentAmount, 179)
  assert.equal(result.currentAmount, -1588614.375)
  assert.equal(financing.currentAmount, -36973.75)
})

test('actual income API baseline pipeline preserves round zero values', async () => {
  const baseline = await getInitialIncomeHistory(createInitialGameState(), DEFAULT_FACTORY_SETTINGS)
  const view = buildIncomeHistoryView({ baselineHistory: baseline, runtimeHistory: [] })
  const rows = buildIncomeStatementRows(view)
  const values = Object.fromEntries(rows.map((row) => [row.key, row.currentAmount]))

  assert.equal(values.sales, 179)
  assert.equal(values.revenue, 3062500)
  assert.equal(values.inventoryChange, 25000)
  assert.equal(values.materials, -2148000)
  assert.equal(values.labor, -1391250)
  assert.equal(values.grossMargin, -451750)
  assert.equal(values.fixedCosts, -1000000)
  assert.equal(values.depreciation, -99890.625)
  assert.equal(values.financingCosts, -36973.75)
  assert.equal(values.result, -1588614.375)
})

test('PLAN income forecast view exposes the same canonical output used by CHECK preview', () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  gameState.investmentsDecision = {
    round: gameState.round,
    investments: [{ type: 'new-machine', quantity: 1 }],
  }
  const currentForecast = calculateRoundForecast(gameState, {}, DEFAULT_FACTORY_SETTINGS)
  const checkDecision = {
    round: gameState.round,
    productionQuantity: 181,
    batchSize: 10,
    targetFinishedGoodsInventory: 60,
  }
  const { nextGameState } = advanceRoundState({
    gameState,
    forecast: currentForecast,
    totalRounds: 12,
    checkProductionDecision: checkDecision,
  })
  const checkPreview = calculateRoundForecast(nextGameState, {}, DEFAULT_FACTORY_SETTINGS)
  const planForecast = calculateRoundForecast(nextGameState, {}, DEFAULT_FACTORY_SETTINGS)
  const planView = buildIncomeForecastView({
    baselineHistory: buildInitialIncomeHistory(gameState, DEFAULT_FACTORY_SETTINGS),
    runtimeHistory: nextGameState.history,
    forecast: planForecast,
  })
  const rows = buildIncomeStatementRows(planView)

  assert.equal(checkPreview.forecast.actualProduction, planForecast.forecast.actualProduction)
  assert.equal(checkPreview.forecast.deliveries, planForecast.forecast.deliveries)
  assert.equal(nextGameState.production.machiningMachines, 3)
  assert.equal(nextGameState.production.machiningMachines, planForecast.closingState.production.machiningMachines)
  assert.equal(
    checkPreview.forecast.inventory.openingFinishedGoodsInventory,
    planForecast.forecast.inventory.openingFinishedGoodsInventory,
  )
  assert.equal(
    checkPreview.forecast.inventory.closingFinishedGoodsInventory,
    planForecast.forecast.inventory.closingFinishedGoodsInventory,
  )
  assert.equal(checkPreview.forecast.finance.revenue, planForecast.forecast.finance.revenue)
  assert.equal(rows.find((row) => row.key === 'sales').currentAmount, planForecast.forecast.deliveries)
  assert.equal(rows.find((row) => row.key === 'revenue').currentAmount, planForecast.forecast.finance.revenue)
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

// Regression: PLAN/Tulos must compare the two latest CONFIRMED rounds, exactly like PLAN/Tase -
// it must never show gameState.round's own live (unconfirmed) forecast as "confirmed".
// General rule: rightRound = max(0, gameState.round - 1); leftRound = rightRound - 1.
test('PLAN/Tulos with gameState.round=3 compares confirmed rounds 1 and 2, not 2 and 3', () => {
  const baseline = buildInitialIncomeHistory(createInitialGameState(), DEFAULT_FACTORY_SETTINGS)
  const view = buildIncomeHistoryView({
    baselineHistory: baseline,
    runtimeHistory: [runtimeEntry(1, 111, 210), runtimeEntry(2, 222, 220)],
  })
  const rows = buildIncomeStatementRows(view)

  assert.equal(view.previousRound, 1)
  assert.equal(view.round, 2)
  // The "current" column's data must come from round 2's own confirmed entry, not a round-3 preview.
  assert.equal(rows.find((row) => row.key === 'result').currentAmount, 222)
  assert.equal(rows.find((row) => row.key === 'sales').currentAmount, 220)
  assert.equal(rows.find((row) => row.key === 'result').previousAmount, 111)
  assert.equal(rows.find((row) => row.key === 'sales').previousAmount, 210)
})

