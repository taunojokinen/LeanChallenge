import test from 'node:test'
import assert from 'node:assert/strict'
import investmentsSnapshot from '../../mocks/investmentsSnapshot.json' with { type: 'json' }
import balanceSheetSnapshot from '../../mocks/balanceSheetSnapshot.json' with { type: 'json' }
import { DEFAULT_FACTORY_SETTINGS } from '../factory-settings/defaultFactorySettings.js'
import { createInitialGameState } from '../factory-settings/initialGameState.js'
import { calculateRoundForecast } from '../forecast/model.js'
import {
  applyFactoryExpansion,
  applyNewMachineCount,
  calculateDebtLimit,
  calculateFactorySpaceUsage,
  calculateRoundDepreciation,
  canFinanceInvestment,
  buildDraftSelectionFromDecision,
  buildInvestmentsViewModel,
  getAdditionalPersonnelFromMachines,
} from './model.js'

test('factory expansion adds 1000 m2', () => {
  assert.equal(applyFactoryExpansion(4000, 1), 5000)
})

test('new machine adds one machine', () => {
  assert.equal(applyNewMachineCount(2, 1), 3)
})

test('new machine adds 250 m2 machining space', () => {
  const baseUsage = calculateFactorySpaceUsage(investmentsSnapshot.factory)
  const updatedUsage = calculateFactorySpaceUsage({
    ...investmentsSnapshot.factory,
    machiningMachineCount: investmentsSnapshot.factory.machiningMachineCount + 1,
  })
  assert.equal(updatedUsage.machiningArea - baseUsage.machiningArea, 250)
})

test('space breakdown sums to used space and free space completes total area', () => {
  const usage = calculateFactorySpaceUsage(investmentsSnapshot.factory)
  const sum = usage.machiningArea + usage.assemblyArea + usage.dispatchArea
    + usage.officeAndSocialArea + usage.finishedGoodsArea
  assert.equal(usage.totalUsed, sum)
  assert.equal(usage.totalUsed + usage.freeArea, usage.totalArea)
})

test('physical finished goods quantity changes warehouse area using configured space', () => {
  const first = calculateFactorySpaceUsage({ ...investmentsSnapshot.factory, finishedGoodsContainers: 10 })
  const second = calculateFactorySpaceUsage({ ...investmentsSnapshot.factory, finishedGoodsContainers: 14 })
  assert.equal(second.finishedGoodsArea - first.finishedGoodsArea, 60)
  assert.equal(first.freeArea - second.freeArea, 60)
})

test('new machine adds 5 personnel', () => {
  assert.equal(getAdditionalPersonnelFromMachines(1), 5)
})

test('new machine is prevented when free area is not enough', () => {
  const crampedFactory = {
    ...investmentsSnapshot.factory,
    totalAreaM2: 1000,
  }
  const usage = calculateFactorySpaceUsage(crampedFactory)
  assert.equal(usage.freeArea < 250, true)
})

test('debt limit is 2 x equity', () => {
  assert.equal(calculateDebtLimit(1000000), 2000000)
})

test('investment is blocked when debt limit would be exceeded', () => {
  const financing = canFinanceInvestment(2000000, {
    cashBalance: 100000,
    bankLoanDebt: 420000,
    equity: 500000,
  })

  assert.equal(financing.canFinance, false)
})

test('positive cash is used before debt', () => {
  const financing = canFinanceInvestment(500000, {
    cashBalance: 184000,
    bankLoanDebt: 420000,
    equity: 2407600,
  })

  assert.equal(financing.cashUsed, 184000)
  assert.equal(financing.financingNeed, 316000)
})

test('target cash is reserved from investment financing', () => {
  const financing = canFinanceInvestment(
    500000,
    { cashBalance: 50000, bankLoanDebt: 2957900, equity: 2073975 },
    { targetCash: 50000, maxDebtToEquity: 2 },
  )

  assert.equal(financing.availableCash, 0)
  assert.equal(financing.debtHeadroom, 1190050)
  assert.equal(financing.financingCapacity, 1190050)
  assert.equal(financing.cashUsed, 0)
  assert.equal(financing.newDebt, 500000)
  assert.equal(financing.debtAfter, 3457900)
  assert.equal(financing.remainingDebtHeadroom, 690050)
  assert.equal(financing.cashAfter, 50000)
})

test('cash above target can finance part of an investment', () => {
  const financing = canFinanceInvestment(
    500000,
    { cashBalance: 300000, bankLoanDebt: 3897950, equity: 2073975 },
    { targetCash: 50000, maxDebtToEquity: 2 },
  )

  assert.equal(financing.availableCash, 250000)
  assert.equal(financing.financingCapacity, 500000)
  assert.equal(financing.cashUsed, 250000)
  assert.equal(financing.newDebt, 250000)
  assert.equal(financing.canFinance, true)
  assert.equal(financing.cashAfter, 50000)

  assert.equal(
    canFinanceInvestment(
      250001,
      { cashBalance: 300000, bankLoanDebt: 4147950, equity: 2073975 },
      { targetCash: 50000, maxDebtToEquity: 2 },
    ).canFinance,
    false,
  )
})

test('canonical round-one investment costs use opening debt headroom', () => {
  const openingFinance = {
    cashBalance: 50000,
    bankLoanDebt: 2957900,
    equity: 2073975,
  }
  const options = { targetCash: 50000, maxDebtToEquity: 2 }

  const oneMachine = canFinanceInvestment(500000, openingFinance, options)
  const twoMachines = canFinanceInvestment(1000000, openingFinance, options)
  const machineAndExpansion = canFinanceInvestment(1500000, openingFinance, options)

  assert.equal(oneMachine.canFinance, true)
  assert.equal(oneMachine.debtAfter, 3457900)
  assert.equal(twoMachines.canFinance, true)
  assert.equal(twoMachines.debtAfter, 3957900)
  assert.equal(machineAndExpansion.canFinance, false)
})

test('installed debt at the limit leaves no financing capacity', () => {
  const financing = canFinanceInvestment(
    1,
    { cashBalance: 50000, bankLoanDebt: 4147950, equity: 2073975 },
    { targetCash: 50000, maxDebtToEquity: 2 },
  )

  assert.equal(financing.debtHeadroom, 0)
  assert.equal(financing.financingCapacity, 0)
  assert.equal(financing.canFinance, false)
})

test('machines depreciation is 5 percent per round', () => {
  assert.equal(calculateRoundDepreciation(500000, 0.05), 25000)
})

test('buildings depreciation is 2.5 percent per round', () => {
  assert.equal(calculateRoundDepreciation(1000000, 0.025), 25000)
})

test('displayed annual depreciation descriptions reflect the unchanged quarterly rates', () => {
  assert.equal(DEFAULT_FACTORY_SETTINGS.game.monthsPerRound, 3)
  assert.equal(DEFAULT_FACTORY_SETTINGS.finance.machineryDepreciationPerRound, 0.05)
  assert.equal(DEFAULT_FACTORY_SETTINGS.finance.buildingDepreciationPerRound, 0.025)
  assert.equal(calculateRoundDepreciation(500000, DEFAULT_FACTORY_SETTINGS.finance.machineryDepreciationPerRound), 25000)
  assert.equal(calculateRoundDepreciation(1000000, DEFAULT_FACTORY_SETTINGS.finance.buildingDepreciationPerRound), 25000)
})

test('existing balance sheet cash and debt are available for financing checks', () => {
  assert.equal(balanceSheetSnapshot.assets.cash > 0, true)
  assert.equal(balanceSheetSnapshot.liabilities.bankLoans > 0, true)
})

test('investments view model uses canonical gameState finance', () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const viewModel = buildInvestmentsViewModel({
    snapshot: investmentsSnapshot,
    gameState,
    factorySettings: DEFAULT_FACTORY_SETTINGS,
    draftSelection: {},
  })

  assert.equal(viewModel.financing.currentCash, 50000)
  assert.equal(viewModel.financing.currentDebt, 2957900)
  assert.equal(viewModel.financing.equity, 2073975)
  assert.equal(viewModel.financing.availableCash, 0)
  assert.equal(viewModel.financing.financingCapacity, 1190050)
})

test('removed raw draft flags are ignored without legacy catalogue entries or project levels', () => {
  const viewModel = buildInvestmentsViewModel({
    snapshot: {
      ...investmentsSnapshot,
      investments: {
        newMachine: investmentsSnapshot.investments.newMachine,
        factoryExpansion: investmentsSnapshot.investments.factoryExpansion,
      },
    },
    gameState: createInitialGameState(DEFAULT_FACTORY_SETTINGS),
    factorySettings: DEFAULT_FACTORY_SETTINGS,
    draftSelection: {
      newMachineCount: 1,
      expansionCount: 1,
      setupAutomation: true,
      moldAutomationMachineIds: [1, 2],
      automaticProcessMeasurement: true,
      conditionMonitoring: true,
    },
  })

  assert.deepEqual(viewModel.selectionState, { newMachineCount: 1, expansionCount: 1 })
  assert.deepEqual(viewModel.investmentRows.map((item) => item.type), ['new-machine', 'factory-expansion'])
  assert.equal(viewModel.totals.totalCost, 1500000)
  assert.equal(viewModel.totals.depreciationPerRound, 50000)
  assert.equal(
    viewModel.machineCountAfterSelection,
    createInitialGameState(DEFAULT_FACTORY_SETTINGS).production.machiningMachines + 1,
  )
  assert.equal(viewModel.addedPersonnel, 5)
  assert.equal(viewModel.space.projected.freeArea - viewModel.space.base.freeArea, 750)
  assert.deepEqual(Object.keys(viewModel.guards), ['canAddMachine', 'canAddExpansion'])
  assert.equal(viewModel.methodLevels, undefined)
})

test('investment space uses the live game state and matches CHECK current scenario', () => {
  const factorySettings = structuredClone(DEFAULT_FACTORY_SETTINGS)
  const gameState = createInitialGameState(factorySettings)
  const before = structuredClone(gameState)
  const model = buildInvestmentsViewModel({
    snapshot: investmentsSnapshot,
    gameState,
    factorySettings,
    draftSelection: {},
  })
  const checkForecast = calculateRoundForecast(gameState, {}, factorySettings)
  assert.equal(model.round, gameState.round)
  for (const field of [
    'totalArea',
    'machiningArea',
    'assemblyArea',
    'shippingArea',
    'officeAndSocialArea',
    'finishedGoodsArea',
    'totalUsed',
    'freeArea',
  ]) {
    assert.equal(model.space.base[field], checkForecast.current.space[field], field)
  }
  assert.deepEqual(gameState, before)
  assert.notEqual(model.space.base.finishedGoodsArea, investmentsSnapshot.factory.finishedGoodsContainers * 15)
})

test('CHECK space ignores an outdated stored investment factory snapshot', () => {
  const factorySettings = structuredClone(DEFAULT_FACTORY_SETTINGS)
  const gameState = createInitialGameState(factorySettings)
  const forecast = calculateRoundForecast({
    ...gameState,
    investmentsSnapshot,
  }, {}, factorySettings)
  const model = buildInvestmentsViewModel({
    snapshot: investmentsSnapshot,
    gameState,
    factorySettings,
    draftSelection: {},
  })

  assert.equal(forecast.current.space.totalArea, model.space.base.totalArea)
  assert.equal(forecast.current.space.totalUsed, model.space.base.totalUsed)
  assert.equal(forecast.current.space.freeArea, model.space.base.freeArea)
})

test('equipment, expansion, several investments and teacher factory area use shared space values', () => {
  const factorySettings = structuredClone(DEFAULT_FACTORY_SETTINGS)
  factorySettings.initialState.factory.totalAreaM2 = 5000
  const gameState = createInitialGameState(factorySettings)
  const model = buildInvestmentsViewModel({
    snapshot: investmentsSnapshot,
    gameState,
    factorySettings,
    draftSelection: { newMachineCount: 2, expansionCount: 2 },
  })
  assert.equal(model.space.base.totalArea, 5000)
  assert.equal(model.space.projected.totalArea, 7000)
  assert.equal(model.space.projected.machiningArea - model.space.base.machiningArea, 500)
  assert.equal(model.space.projected.totalUsed - model.space.base.totalUsed, 500)
  assert.equal(model.space.projected.freeArea - model.space.base.freeArea, 1500)
  assert.equal(model.space.projected.totalUsed + model.space.projected.freeArea, 7000)
  assert.equal(model.space.breakdown.reduce((sum, row) => sum + row.projectedArea, 0), model.space.projected.totalUsed)
})

test('space totals remain correct at zero and negative free area', () => {
  const exact = calculateFactorySpaceUsage({ ...investmentsSnapshot.factory, totalAreaM2: 1845 })
  const cramped = calculateFactorySpaceUsage({ ...investmentsSnapshot.factory, totalAreaM2: 1000 })
  assert.equal(exact.freeArea, 0)
  assert.equal(exact.totalUsed + exact.freeArea, exact.totalArea)
  assert.ok(cramped.freeArea < 0)
  assert.equal(cramped.totalUsed + cramped.freeArea, cramped.totalArea)
})

test('decision drafts aggregate machines and expansions and ignore all removed investment rows', () => {
  const draft = buildDraftSelectionFromDecision({
    investments: [
      { type: 'new-machine', quantity: 1 },
      { type: 'new-machine', quantity: 2 },
      { type: 'factory-expansion', quantity: 1 },
      { type: 'mold-change-automation', machineId: 2, quantity: 1 },
      { type: 'automatic-process-measurement', quantity: 1 },
      { type: 'condition-monitoring', quantity: 1 },
    ],
  })

  assert.deepEqual(draft, { newMachineCount: 3, expansionCount: 1 })
  assert.deepEqual(buildDraftSelectionFromDecision(), { newMachineCount: 0, expansionCount: 0 })
})