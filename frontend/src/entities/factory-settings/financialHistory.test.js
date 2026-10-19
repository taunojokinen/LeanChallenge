import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_FACTORY_SETTINGS } from './defaultFactorySettings.js'
import { createInitialGameState } from './initialGameState.js'
import { createInitialFactoryState } from './initialFactoryState.js'
import { calculateFinancingStructure } from './financingStructure.js'
import { calculateRoundForecast } from '../forecast/model.js'
import {
  assertCanonicalFinancialHistoryEntry,
  buildCanonicalFinancialHistory,
  buildInitialBalanceSheetHistory,
  buildInitialIncomeHistory,
} from './financialHistory.js'
import { buildIncomeHistoryView } from '../income/model.js'
import { buildBalanceSheetHistoryView } from '../balance-sheet/model.js'
import { buildFactorySettingsSnapshot, createDefaultTeacherPreferences, getTeacherSliderStepCount } from './teacherGameSettings.js'

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

test('initial game finance is the confirmed round-zero closing balance', () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const history = buildCanonicalFinancialHistory(gameState, DEFAULT_FACTORY_SETTINGS)
  assert.equal(gameState.round, 1)
  assert.deepEqual(gameState.finance, history.at(-1).finance)
  assert.ok(Math.abs(gameState.finance.equity - DEFAULT_FACTORY_SETTINGS.initialState.finance.equity) < 1e-7)
  assert.equal(gameState.finance.cash, 50000)
  assert.equal(gameState.finance.totalAssets, gameState.finance.totalLiabilitiesAndEquity)
})

test('generated history uses canonical finished-goods valuation and inventory change', () => {
  const entries = generated()

  assert.deepEqual(entries.map((entry) => entry.round), [-2, -1, 0])
  assert.deepEqual(entries.map((entry) => entry.incomeStatement.salesUnits), [124, 129, 134])
  assert.deepEqual(entries.map((entry) => entry.incomeStatement.labor), [1653750, 1653750, 1653750])
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
  const initialFinance = createInitialFactoryState(settings).finance
  let openingFinance = initialFinance
  const roundRate = settings.finance.annualInterestRate * settings.game.monthsPerRound / 12

  entries.forEach((entry, index) => {
    const expectedDepreciation =
      openingFinance.machineryBookValue * settings.finance.machineryDepreciationPerRound +
      openingFinance.buildingsBookValue * settings.finance.buildingDepreciationPerRound

    assert.equal(entry.incomeStatement.depreciation, expectedDepreciation)
    if (index > 0) {
      assert.ok(Math.abs(entry.incomeStatement.financingCosts - openingFinance.bankLoans * roundRate) < 1e-9)
    } else {
      const openingEquity = entry.finance.equity - entry.incomeStatement.result
      const financing = calculateFinancingStructure({
        nonCashAssets: initialFinance.machineryBookValue + initialFinance.buildingsBookValue +
          initialFinance.finishedGoodsInventoryBookValue + initialFinance.rawMaterialInventoryBookValue,
        equity: openingEquity,
        rawMaterialCosts: initialFinance.incomeStatement.materials,
        factorySettings: settings,
      })
      assert.ok(Math.abs(entry.incomeStatement.financingCosts - financing.interestBearingDebt * roundRate) < 1e-7)
    }
    openingFinance = entry.finance
  })
})

for (const startingEquity of [2000000, 3000000, DEFAULT_FACTORY_SETTINGS.initialState.finance.equity]) {
  test(`teacher starting equity ${startingEquity} flows through historical results and balanced financing`, () => {
    const preferences = createDefaultTeacherPreferences()
    preferences.equity.position = (startingEquity - preferences.equity.easy) / 25
    const settings = buildFactorySettingsSnapshot(preferences)
    const state = createInitialGameState(settings)
    const history = buildCanonicalFinancialHistory(state, settings)
    assert.ok(Math.abs(state.finance.equity - startingEquity) < 1e-7)
    assert.deepEqual(history.map((entry) => entry.round), [-2, -1, 0])
    let openingEquity = history[0].finance.equity - history[0].incomeStatement.result
    for (const entry of history) {
      const finance = entry.finance
      assert.ok(Math.abs(finance.equity - openingEquity - entry.incomeStatement.result) < 1e-7)
      assert.ok(entry.incomeStatement.result < 0)
      assert.equal(finance.totalAssets, finance.totalLiabilitiesAndEquity)
      assert.equal(finance.totalAssets, finance.equity + finance.bankLoans + finance.otherLiabilities)
      openingEquity = finance.equity
    }
    const view = buildBalanceSheetHistoryView({
      baselineHistory: buildInitialBalanceSheetHistory(state, settings),
      runtimeHistory: state.history,
    })
    assert.equal(view.previousLiabilities.equity, history[1].finance.equity)
    assert.equal(view.liabilities.equity, history[2].finance.equity)
    assert.equal(view.previousRound, -1)
    assert.equal(view.round, 0)
    assert.ok(Math.abs(view.liabilities.equity - startingEquity) < 1e-7)
    const firstRound = calculateRoundForecast(state, {}, settings)
    assert.equal(firstRound.forecast.finance.openingInterestBearingDebt, history[2].finance.bankLoans)
    assert.equal(firstRound.closingState.finance.equity, state.finance.equity + firstRound.forecast.finance.result)
    assert.equal(firstRound.closingState.finance.totalAssets, firstRound.closingState.finance.totalLiabilitiesAndEquity)
  })
}

test('capital targeting also supports debt-free histories with excess cash and zero interest', () => {
  const settings = structuredClone(DEFAULT_FACTORY_SETTINGS)
  settings.initialState.finance.equity = 10000000
  const history = buildCanonicalFinancialHistory(undefined, settings)
  assert.ok(Math.abs(history.at(-1).finance.equity - 10000000) < 1e-7)
  for (const entry of history) {
    assert.equal(entry.finance.bankLoans, 0)
    assert.equal(entry.incomeStatement.financingCosts, 0)
    assert.ok(entry.finance.cash > settings.finance.targetCash)
    assert.equal(entry.finance.totalAssets, entry.finance.totalLiabilitiesAndEquity)
  }
})

test('targeting retains production, operating income and KNL inputs across teacher range boundaries', () => {
  for (const useMaximum of [false, true]) {
    const preferences = createDefaultTeacherPreferences()
    for (const [id, preference] of Object.entries(preferences)) {
      preference.position = useMaximum ? getTeacherSliderStepCount(id, preferences) : 0
    }
    const settings = buildFactorySettingsSnapshot(preferences)
    let referenceState = createInitialFactoryState(settings)
    const history = buildCanonicalFinancialHistory(undefined, settings)
    assert.ok(Math.abs(history.at(-1).finance.equity - settings.initialState.finance.equity) < 1e-7)
    for (const entry of history) {
      referenceState.inventory.finishedGoodsContainers = settings.initialState.inventory.finishedGoodsContainers
      const forecast = calculateRoundForecast(
        referenceState, { market: { productionQuantity: entry.production.actualProduction } }, settings,
      )
      assert.equal(entry.production.actualProduction, forecast.forecast.actualProduction)
      for (const key of ['revenue', 'inventoryChange', 'materials', 'labor', 'fixedCosts', 'depreciation']) {
        assert.equal(entry.incomeStatement[key], forecast.closingState.finance.incomeStatement[key])
      }
      referenceState = forecast.closingState
    }
    const initialState = createInitialGameState(settings)
    assert.deepEqual(initialState.lean, settings.initialState.lean)
    assert.deepEqual(initialState.production, settings.initialState.production)
    assert.deepEqual(
      calculateRoundForecast(initialState, {}, settings).current.knl,
      calculateRoundForecast(createInitialFactoryState(settings), {}, settings).current.knl,
    )
  }
})

test('higher teacher starting equity reduces historical debt and subsequent interest without changing assets', () => {
  const historyFor = (equity) => {
    const settings = structuredClone(DEFAULT_FACTORY_SETTINGS)
    settings.initialState.finance.equity = equity
    return buildCanonicalFinancialHistory(createInitialGameState(settings), settings)
  }
  const lower = historyFor(2000000)
  const higher = historyFor(3000000)
  for (const [index, entry] of higher.entries()) {
    assert.equal(entry.finance.totalAssets, lower[index].finance.totalAssets)
    assert.ok(entry.finance.equity > lower[index].finance.equity)
    assert.ok(entry.finance.bankLoans < lower[index].finance.bankLoans)
    if (index > 0) {
      assert.ok(entry.incomeStatement.financingCosts < lower[index].incomeStatement.financingCosts)
    }
  }
})

test('capital targeting accounts for zero and higher interest rates without changing the target', () => {
  for (const annualInterestRate of [0, 0.08, 1]) {
    const settings = structuredClone(DEFAULT_FACTORY_SETTINGS)
    settings.finance.annualInterestRate = annualInterestRate
    const history = buildCanonicalFinancialHistory(undefined, settings)
    assert.ok(Math.abs(history.at(-1).finance.equity - settings.initialState.finance.equity) < 1e-7)
    for (const [index, entry] of history.entries()) {
      assert.equal(entry.finance.totalAssets, entry.finance.totalLiabilitiesAndEquity)
      if (index > 0) {
        assert.ok(Math.abs(entry.incomeStatement.financingCosts -
          history[index - 1].finance.bankLoans * annualInterestRate * settings.game.monthsPerRound / 12) < 1e-7)
      }
    }
  }
})

test('invalid capital targets and incomplete persisted history are reported explicitly', () => {
  const settings = structuredClone(DEFAULT_FACTORY_SETTINGS)
  settings.initialState.finance.equity = NaN
  assert.throws(() => buildCanonicalFinancialHistory(undefined, settings), /tavoitepääoman/)
  assert.throws(() => buildCanonicalFinancialHistory({ initialFinancialHistory: [] }), /lähtöhistoria/)
})