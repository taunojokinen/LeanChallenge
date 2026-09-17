import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_FACTORY_SETTINGS } from '../entities/factory-settings/defaultFactorySettings.js'
import { createInitialGameState } from '../entities/factory-settings/initialGameState.js'
import { buildGameHeaderKpis } from './headerKpis.js'
import { buildConfirmedCockpitViewModel } from '../pages/plan/cockpitModel.js'
import { calculateRoundForecast } from '../entities/forecast/model.js'
import { advanceRoundState } from '../entities/game-round/advanceRound.js'
import { buildInitialIncomeHistory } from '../entities/factory-settings/financialHistory.js'
import { buildIncomeHistoryView, buildIncomeStatementRows } from '../entities/income/model.js'

test('header KPIs come from persisted round-0 state, not forecast output', () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const kpis = buildGameHeaderKpis(gameState, DEFAULT_FACTORY_SETTINGS)

  const revenue = kpis.find((kpi) => kpi.key === 'revenue')
  const result = kpis.find((kpi) => kpi.key === 'result')
  const production = kpis.find((kpi) => kpi.key === 'production')

  assert.ok(revenue)
  assert.ok(result)
  assert.ok(production)

  assert.equal(revenue.value.replace(/\s/g, ' '), '2 906 250 €')
  assert.equal(result.value.replace(/\s/g, ' ').replace(/−/g, '-'), '-1 684 864 €')
  assert.equal(production.value.replace(/\s/g, ' '), '174 kpl')
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