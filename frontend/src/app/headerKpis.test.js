import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_FACTORY_SETTINGS } from '../entities/factory-settings/defaultFactorySettings.js'
import { createInitialGameState } from '../entities/factory-settings/initialGameState.js'
import { buildGameHeaderKpis } from './headerKpis.js'
import { buildConfirmedCockpitViewModel } from '../pages/plan/cockpitModel.js'
import { calculateRoundForecast } from '../entities/forecast/model.js'
import { advanceRoundState } from '../entities/game-round/advanceRound.js'
import { buildCanonicalFinancialHistory, buildInitialIncomeHistory } from '../entities/factory-settings/financialHistory.js'
import { buildIncomeHistoryView, buildIncomeStatementRows } from '../entities/income/model.js'
import { buildInitialBalanceSheetHistory } from '../entities/factory-settings/financialHistory.js'
import { buildBalanceSheetHistoryView, buildBalanceSheetViewModel } from '../entities/balance-sheet/model.js'
import { buildBalanceInterpretation } from '../entities/balance-sheet/interpretation.js'
import { buildFactorySettingsSnapshot, createDefaultTeacherPreferences } from '../entities/factory-settings/teacherGameSettings.js'

test('header KPIs come from persisted round-0 state, not forecast output', () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const kpis = buildGameHeaderKpis(gameState, DEFAULT_FACTORY_SETTINGS)

  const revenue = kpis.find((kpi) => kpi.key === 'revenue')
  const result = kpis.find((kpi) => kpi.key === 'result')
  const production = kpis.find((kpi) => kpi.key === 'production')

  assert.ok(revenue)
  assert.ok(result)
  assert.ok(production)

  assert.equal(revenue.value.replace(/\s/g, ' '), '3 750 000 €')
  assert.equal(result.value.replace(/\s/g, ' ').replace(/−/g, '-'), '-825 962 €')
  assert.equal(production.value.replace(/\s/g, ' '), '150 kpl')
})

test('header KNL matches Cockpit confirmed factory KNL', () => {
  const gameState = {
    ...createInitialGameState(DEFAULT_FACTORY_SETTINGS),
    round: 2,
    history: [{
      round: 1,
      knl: {
        machining: { kPct: 70, nPct: 70, lPct: 70, knl: 0.343 },
        assembly: { kPct: 70, nPct: 70, lPct: 70, knl: 0.343 },
        shipping: { kPct: 70, nPct: 70, lPct: 70, knl: 0.343 },
      },
      factoryKnl: { kPct: 88, nPct: 91, lPct: 76 },
    }],
  }
  const headerKnl = buildGameHeaderKpis(gameState, DEFAULT_FACTORY_SETTINGS)
    .find((kpi) => kpi.key === 'oee')
  const cockpit = buildConfirmedCockpitViewModel(gameState, DEFAULT_FACTORY_SETTINGS)

  assert.equal(headerKnl.value, '61 %')
  assert.equal(Math.round(cockpit.factory.KNL.current), 61)
})

test('header result uses the same confirmed round-one finance as PLAN income', () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const forecast = calculateRoundForecast(
    gameState,
    { market: { price: 25500, addedVariations: 1, productionQuantity: 100 } },
    DEFAULT_FACTORY_SETTINGS,
  )
  const advanced = advanceRoundState({ gameState, forecast, totalRounds: 12 })
  const kpis = buildGameHeaderKpis(advanced.nextGameState, DEFAULT_FACTORY_SETTINGS)
  const baseline = buildInitialIncomeHistory(gameState, DEFAULT_FACTORY_SETTINGS)
  const view = buildIncomeHistoryView({
    baselineHistory: baseline,
    runtimeHistory: advanced.nextGameState.history,
  })
  const result = buildIncomeStatementRows(view).find((row) => row.key === 'result')
  const headerResult = kpis.find((kpi) => kpi.key === 'result')

  assert.equal(headerResult.value.replace(/−/g, '-'), result.currentAmountText)
})

function kpisByKey(state) {
  return Object.fromEntries(buildGameHeaderKpis(state).map((kpi) => [kpi.key, kpi]))
}

test('header compares actual production, revenue, result and physical inventory from the last confirmed rounds', () => {
  const state = createInitialGameState()
  state.history = [
    {
      round: 1,
      production: { actualProduction: 100, deliveries: 10, demand: 999 },
      inventory: { finishedGoodsContainers: 50 },
      incomeStatement: { salesUnits: 10, revenue: 100, result: -100 },
      factoryKnl: { kPct: 60, nPct: 60, lPct: 60 },
    },
    {
      round: 2,
      production: { actualProduction: 120, deliveries: 20, demand: 999 },
      inventory: { finishedGoodsContainers: 50 },
      incomeStatement: { salesUnits: 20, revenue: 120, result: -50 },
      factoryKnl: { kPct: 66, nPct: 66, lPct: 66 },
    },
  ]
  const kpis = kpisByKey(state)
  assert.equal(kpis.production.value, '120 kpl')
  assert.equal(kpis.production.delta, '+20,0 %')
  assert.equal(kpis.revenue.delta, '+20,0 %')
  assert.equal(kpis.result.delta, '+50,0 %')
  assert.equal(kpis.inventoryTurnover.value, '1,6x/vuosi')
  assert.equal(kpis.inventoryTurnover.delta, '+0,8x/vuosi')
  assert.equal(kpis.oee.delta, '+33,1 %')

  state.market.price = 999999
  state.inventory.finishedGoodsContainers = 999999
  assert.deepEqual(kpisByKey(state), kpis)
})

test('baseline header uses the canonical round -1 and 0 actual production and finance', () => {
  const state = createInitialGameState(DEFAULT_FACTORY_SETTINGS, { historySeed: 123 })
  const [previous, current] = buildCanonicalFinancialHistory(state).slice(-2)
  const kpis = kpisByKey(state)
  const expected = (now, before) => {
    const delta = (now - before) / Math.abs(before) * 100
    return `${delta > 0 ? '+' : ''}${delta.toLocaleString('fi-FI', {
      minimumFractionDigits: 1, maximumFractionDigits: 1,
    }).replace('−', '-')} %`
  }
  assert.equal(kpis.production.delta, expected(current.production.actualProduction, previous.production.actualProduction))
  assert.equal(kpis.revenue.delta, expected(current.incomeStatement.revenue, previous.incomeStatement.revenue))
  assert.equal(kpis.result.delta, expected(current.incomeStatement.result, previous.incomeStatement.result))
  const cockpit = buildConfirmedCockpitViewModel(state)
  assert.equal(kpis.oee.delta, `${cockpit.factory.KNL.change > 0 ? '+' : ''}${cockpit.factory.KNL.change.toLocaleString('fi-FI', {
    minimumFractionDigits: 1, maximumFractionDigits: 1,
  }).replace('−', '-')} %`)
})

test('zero, missing and nonfinite comparisons show unavailable instead of fake zero changes', () => {
  const state = createInitialGameState()
  state.history = [
    {
      round: 1,
      incomeStatement: { revenue: 0, result: 0 },
      production: { actualProduction: 0, deliveries: 0 },
      inventory: { finishedGoodsContainers: 0 },
      factoryKnl: { kPct: 0, nPct: 0, lPct: 0 },
    },
    {
      round: 2,
      incomeStatement: { revenue: 100, result: -100 },
      production: { actualProduction: 120, deliveries: 10 },
      inventory: { finishedGoodsContainers: 0 },
      factoryKnl: { kPct: 60, nPct: 60, lPct: 60 },
    },
  ]
  for (const kpi of Object.values(kpisByKey(state))) assert.equal(kpi.delta, '—')
  assert.equal(kpisByKey(state).inventoryTurnover.value, '—')
  for (const invalid of [undefined, null, Number.NaN, Number.POSITIVE_INFINITY]) {
    state.history[0].incomeStatement.result = invalid
    assert.equal(kpisByKey(state).result.delta, '—')
  }
  delete state.history[0].production
  delete state.history[1].inventory
  assert.equal(kpisByKey(state).production.delta, '—')
  assert.equal(kpisByKey(state).inventoryTurnover.delta, '—')
})

test('negative results use the absolute denominator including crossing zero', () => {
  const state = createInitialGameState()
  state.history = [
    { round: 1, incomeStatement: { result: -100 } },
    { round: 2, incomeStatement: { result: 50 } },
  ]
  assert.equal(kpisByKey(state).result.delta, '+150,0 %')
  state.history[1].incomeStatement.result = -150
  assert.equal(kpisByKey(state).result.delta, '-50,0 %')
})

for (const mode of ['quest', 'teacher']) {
  test(`${mode} header and balance use the same annual turnover before and after round confirmation`, () => {
    const settings = mode === 'quest'
      ? DEFAULT_FACTORY_SETTINGS
      : buildFactorySettingsSnapshot(createDefaultTeacherPreferences())
    const state = createInitialGameState(settings)
    const originalState = structuredClone(state)
    const baselineHistory = buildInitialBalanceSheetHistory(state, settings)
    const turnover = (gameState) => buildGameHeaderKpis(gameState, settings)
      .find((kpi) => kpi.key === 'inventoryTurnover')
    const verifyBalance = (gameState) => {
      const view = buildBalanceSheetHistoryView({ baselineHistory, runtimeHistory: gameState.history })
      const balanceSheet = buildBalanceSheetViewModel(view, 999)
      const interpretation = buildBalanceInterpretation({ balanceSheet, confirmedEntry: view.confirmedEntry, factorySettings: settings })
      assert.equal(turnover(gameState).value, interpretation.inventory.value.replace(' kertaa vuodessa', 'x/vuosi'))
    }
    assert.equal(turnover(state).value, '6,0x/vuosi')
    assert.equal(turnover(state).delta, '+0,2x/vuosi')
    verifyBalance(state)
    const before = buildGameHeaderKpis(state, settings)
    const forecast = calculateRoundForecast(state, { market: { price: 25500, productionQuantity: 100 } }, settings)
    assert.deepEqual(buildGameHeaderKpis(state, settings), before)
    assert.deepEqual(state, originalState)
    const advanced = advanceRoundState({ gameState: state, forecast, totalRounds: 12 })
    const entry = advanced.historyEntry
    const annualTurnover = entry.production.deliveries / entry.inventory.finishedGoodsContainers * 4
    assert.equal(turnover(advanced.nextGameState).value, `${annualTurnover.toLocaleString('fi-FI', {
      minimumFractionDigits: 1, maximumFractionDigits: 1,
    })}x/vuosi`)
    assert.notEqual(turnover(advanced.nextGameState).value, turnover(state).value)
    const delta = annualTurnover - 6
    assert.equal(turnover(advanced.nextGameState).delta, `${delta > 0 ? '+' : ''}${delta.toLocaleString('fi-FI', {
      minimumFractionDigits: 1, maximumFractionDigits: 1,
    }).replace('−', '-')}x/vuosi`)
    verifyBalance(advanced.nextGameState)
  })
}