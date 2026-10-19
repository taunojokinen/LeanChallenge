import test from 'node:test'
import assert from 'node:assert/strict'
import { buildBalanceInterpretation } from './interpretation.js'
import { buildBalanceSheetHistoryView, buildBalanceSheetViewModel } from './model.js'
import { DEFAULT_FACTORY_SETTINGS } from '../factory-settings/defaultFactorySettings.js'
import { createInitialGameState } from '../factory-settings/initialGameState.js'
import { buildInitialBalanceSheetHistory } from '../factory-settings/financialHistory.js'
import { buildFactorySettingsSnapshot, createDefaultTeacherPreferences } from '../factory-settings/teacherGameSettings.js'
import { calculateRoundForecast } from '../forecast/model.js'
import { advanceRoundState } from '../game-round/advanceRound.js'
import { canFinanceInvestment } from '../investments/model.js'

function interpretationFor({
  equity = 1200,
  result = -100,
  assetsTotal = 10000,
  bankLoans = 500,
  deliveries = 150,
  inventory = 100,
} = {}) {
  const assets = { cash: assetsTotal - 1000, finishedGoodsInventory: 750, rawMaterialInventory: 250 }
  const liabilities = { equity, bankLoans, otherLiabilities: assetsTotal - equity - bankLoans }
  const balanceSheet = buildBalanceSheetViewModel({
    round: 0, previousRound: -1, assets, previousAssets: assets, liabilities, previousLiabilities: liabilities,
  }, 1.5)
  return buildBalanceInterpretation({
    balanceSheet,
    confirmedEntry: { incomeStatement: { result }, production: { deliveries }, inventory: { finishedGoodsContainers: inventory } },
  })
}

for (const [equity, years, status] of [
  [1199, 1199 / 400, 'danger'],
  [1200, 3, 'warning'],
  [1201, 1201 / 400, 'warning'],
]) {
  test(`capital runway uses quarterly loss: equity ${equity}, status ${status}`, () => {
    const { capital } = interpretationFor({ equity })
    assert.equal(capital.years, years)
    assert.equal(capital.status, status)
    assert.equal(capital.projection, equity - 1200)
    assert.match(capital.value, /^\d+,\d vuotta$/)
    assert.match(capital.text, status === 'danger' ? /alle kolmessa/ : /vähintään kolmeksi/)
  })
}

test('positive and zero quarterly results strengthen or preserve capital', () => {
  const positive = interpretationFor({ result: 100 }).capital
  assert.equal(positive.status, 'success')
  assert.equal(positive.years, null)
  assert.equal(positive.projection, 2400)
  assert.equal(positive.value, 'Oma pääoma vahvistuu')
  const zero = interpretationFor({ result: 0 }).capital
  assert.equal(zero.status, 'warning')
  assert.equal(zero.years, null)
  assert.equal(zero.projection, 1200)
  assert.equal(zero.value, 'Oma pääoma säilyy ennallaan')
})

for (const equity of [-100, 0]) {
  test(`depleted capital (${equity}) stays red for losses, zero result and profits`, () => {
    for (const result of [-100, 0, 100]) {
      const { capital } = interpretationFor({ equity, result })
      assert.equal(capital.status, 'danger')
      assert.equal(capital.projection, equity + 12 * result)
      assert.equal(capital.years, result < 0 ? 0 : null)
      assert.match(capital.text, /puskuria/)
      if (result < 0) assert.equal(capital.value, '0,0 vuotta')
    }
  })
}

for (const [percent, status] of [[32.99, 'danger'], [33, 'warning'], [50, 'warning'], [50.01, 'success']]) {
  test(`solvency ${percent}% has status ${status} including trade payables`, () => {
    const { solvency } = interpretationFor({ equity: percent * 100 })
    assert.equal(solvency.status, status)
    assert.equal(solvency.value, `${percent.toLocaleString('fi-FI', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`)
  })
}

test('borrowing room reuses investment headroom, excludes cash and never becomes negative', () => {
  for (const [equity, bankLoans, expected] of [[2000, 3000, 1000], [2000, 4000, 0], [2000, 5000, 0], [0, 0, 0], [-100, 500, 0]]) {
    const { solvency } = interpretationFor({ equity, bankLoans })
    const investment = canFinanceInvestment(0, { equity, bankLoanDebt: bankLoans, cashBalance: 999999 }, {
      maxDebtToEquity: DEFAULT_FACTORY_SETTINGS.finance.maxDebtToEquity,
    })
    assert.equal(solvency.debtHeadroom, expected)
    assert.equal(solvency.debtHeadroom, investment.debtHeadroom)
    assert.notEqual(solvency.debtHeadroom, investment.financingCapacity)
  }
})

for (const [annualTurnover, status] of [[6, 'danger'], [7.99, 'danger'], [8, 'warning'], [16, 'warning'], [16.01, 'success']]) {
  test(`annual inventory turnover ${annualTurnover} has status ${status}`, () => {
    const { inventory } = interpretationFor({ deliveries: annualTurnover * 25 })
    assert.equal(inventory.annualTurnover, annualTurnover)
    assert.equal(inventory.status, status)
    assert.equal(inventory.capitalText.replace(/\s/g, ' '), '1 000 €')
    assert.match(inventory.text, { danger: /heikko/, warning: /kohtalainen/, success: /tehokkaasti/ }[status])
  })
}

test('zero deliveries are red; zero, missing or invalid physical inventory is explicitly unavailable', () => {
  assert.equal(interpretationFor({ deliveries: 0 }).inventory.status, 'danger')
  for (const inventory of [0, -1, null, NaN]) {
    const card = interpretationFor({ inventory }).inventory
    assert.equal(card.annualTurnover, null)
    assert.equal(card.status, 'neutral')
    assert.equal(card.value, 'Ei laskettavissa')
  }
})

test('zero asset total has no calculable solvency instead of a fake ratio', () => {
  assert.equal(interpretationFor({ assetsTotal: 0, equity: 0 }).solvency.status, 'neutral')
  assert.equal(interpretationFor({ assetsTotal: 0, equity: 0 }).solvency.value, 'Ei laskettavissa')
})

test('missing and nonfinite quarterly results are rejected, not silently converted into zero', () => {
  for (const result of [null, NaN, Infinity]) {
    assert.throws(() => interpretationFor({ result }), /vahvistetut/)
  }
})

for (const mode of ['quest', 'teacher']) {
  test(`${mode} cards follow the same confirmed entries as balance and income, not pending forecasts`, () => {
    const settings = mode === 'quest'
      ? DEFAULT_FACTORY_SETTINGS
      : buildFactorySettingsSnapshot(createDefaultTeacherPreferences())
    const state = createInitialGameState(settings)
    const stateBefore = structuredClone(state)
    const baselineHistory = buildInitialBalanceSheetHistory(state, settings)
    const read = (gameState, liveTurnover = 1.5) => {
      const view = buildBalanceSheetHistoryView({ baselineHistory, runtimeHistory: gameState.history })
      const balanceSheet = buildBalanceSheetViewModel(view, liveTurnover)
      return buildBalanceInterpretation({ balanceSheet, confirmedEntry: view.confirmedEntry, factorySettings: settings })
    }
    const original = read(state)
    assert.equal(original.round, 0)
    assert.equal(original.inventory.annualTurnover, 6)
    assert.equal(original.inventory.status, 'danger')
    assert.equal(original.capital.projection, baselineHistory.entries.at(-1).finance.equity + 12 * baselineHistory.entries.at(-1).incomeStatement.result)
    const forecast = calculateRoundForecast(state, { market: { price: 25500, productionQuantity: 100 } }, settings)
    assert.deepEqual(read(state, 999), original)
    assert.deepEqual(state, stateBefore)
    const advanced = advanceRoundState({ gameState: state, forecast, totalRounds: 12 })
    const updated = read(advanced.nextGameState)
    const entry = advanced.historyEntry
    assert.equal(updated.round, 1)
    assert.equal(updated.capital.projection, entry.finance.equity + 12 * entry.incomeStatement.result)
    assert.equal(updated.inventory.annualTurnover, entry.production.deliveries / entry.inventory.finishedGoodsContainers * 4)
    assert.equal(updated.solvency.debtHeadroom, Math.max(0, 2 * entry.finance.equity - entry.finance.bankLoans))
    assert.notDeepEqual(updated, original)
  })
}
