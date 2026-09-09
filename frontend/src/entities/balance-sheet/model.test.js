import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_FACTORY_SETTINGS } from '../factory-settings/defaultFactorySettings.js'
import { createInitialGameState } from '../factory-settings/initialGameState.js'
import { buildInitialBalanceSheetHistory } from '../factory-settings/financialHistory.js'
import { buildBalanceSheetHistoryView, buildBalanceSheetViewModel } from './model.js'
import { calculateRoundForecast } from '../forecast/model.js'
import { advanceRoundState } from '../game-round/advanceRound.js'

function runtimeEntry(round, equity) {
  return {
    round,
    finance: {
      cash: 50000,
      bankLoans: 2000000,
      equity,
      otherLiabilities: 600000,
      machineryBookValue: 500000,
      buildingsBookValue: 3000000,
      finishedGoodsInventoryBookValue: 1700000,
      rawMaterialInventoryBookValue: 550000,
    },
  }
}

test('balance history preserves canonical baseline rounds', () => {
  const baseline = buildInitialBalanceSheetHistory(createInitialGameState(), DEFAULT_FACTORY_SETTINGS)
  const view = buildBalanceSheetHistoryView({ baselineHistory: baseline, runtimeHistory: [] })

  assert.equal(view.previousRound, -1)
  assert.equal(view.round, 0)
  assert.equal(view.liabilities.equity, 2073975)
  assert.equal(view.liabilities.bankLoans, 2957900)
})

test('balance history selects latest confirmed runtime rounds', () => {
  const baseline = buildInitialBalanceSheetHistory(createInitialGameState(), DEFAULT_FACTORY_SETTINGS)
  const view = buildBalanceSheetHistoryView({
    baselineHistory: baseline,
    runtimeHistory: [runtimeEntry(1, 1000000), runtimeEntry(2, 1200000), runtimeEntry(3, 1500000)],
  })
  const model = buildBalanceSheetViewModel(view, 1)

  assert.equal(view.previousRound, 2)
  assert.equal(view.round, 3)
  assert.equal(model.liabilitiesRows.find((row) => row.key === 'equity').currentValue.replace(/\s/g, ' '), '1 500 000 €')
  assert.equal(model.liabilitiesRows.find((row) => row.key === 'bankLoans').currentValue.replace(/\s/g, ' '), '2 000 000 €')
  assert.equal(model.assetsRows.find((row) => row.key === 'finishedGoodsInventory').currentValue.replace(/\s/g, ' '), '1 700 000 €')
  assert.equal(model.assetsRows.find((row) => row.key === 'rawMaterialInventory').currentValue.replace(/\s/g, ' '), '550 000 €')
  assert.equal(model.assetsRows.find((row) => row.key === 'fixedAssets').currentValue.replace(/\s/g, ' '), '3 500 000 €')
  assert.equal(model.assetsRows.find((row) => row.key === 'inventory').currentValue.replace(/\s/g, ' '), '2 250 000 €')
})

test('runtime balance equity is read directly from history finance', () => {
  const baseline = buildInitialBalanceSheetHistory(createInitialGameState(), DEFAULT_FACTORY_SETTINGS)
  const entry = runtimeEntry(1, 1234567)
  const view = buildBalanceSheetHistoryView({ baselineHistory: baseline, runtimeHistory: [entry] })

  assert.equal(view.liabilities.equity, entry.finance.equity)
})

test('real round-one confirmation selects canonical round zero and runtime round one', async () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const forecast = calculateRoundForecast(
    gameState,
    { market: { price: 25500, addedVariations: 1, productionQuantity: 100 } },
    DEFAULT_FACTORY_SETTINGS,
  )
  const advanced = advanceRoundState({ gameState, forecast, totalRounds: 12 })
  const baseline = buildInitialBalanceSheetHistory(advanced.nextGameState, DEFAULT_FACTORY_SETTINGS)
  const view = buildBalanceSheetHistoryView({
    baselineHistory: baseline,
    runtimeHistory: advanced.nextGameState.history,
  })

  assert.equal(view.previousRound, 0)
  assert.equal(view.round, 1)
  assert.equal(view.liabilities.equity, advanced.historyEntry.finance.equity)
})
