import test from 'node:test'
import assert from 'node:assert/strict'
import investmentsSnapshot from '../../mocks/investmentsSnapshot.json' with { type: 'json' }
import balanceSheetSnapshot from '../../mocks/balanceSheetSnapshot.json' with { type: 'json' }
import projectsSnapshot from '../../mocks/projectsSnapshot.json' with { type: 'json' }
import { buildProjectsViewModel } from '../lean-projects/model.js'
import { DEFAULT_FACTORY_SETTINGS } from '../factory-settings/defaultFactorySettings.js'
import { createInitialGameState } from '../factory-settings/initialGameState.js'
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
  normalizeMachineAutomationSelection,
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

test('SMED lower than 4 keeps mold automation locked', () => {
  const projectsViewModel = buildProjectsViewModel(projectsSnapshot, { selectionMap: {} })
  const smed = projectsViewModel.departments
    .find((department) => department.key === 'machining')
    .methods.find((method) => method.key === 'smed')
  assert.equal(smed.currentLevel < 4, true)
})

test('SMED at least 4 unlocks mold automation', () => {
  const projectsViewModel = buildProjectsViewModel(
    {
      ...projectsSnapshot,
      departments: projectsSnapshot.departments.map((department) =>
        department.key === 'machining'
          ? {
              ...department,
              methods: department.methods.map((method) =>
                method.key === 'smed' ? { ...method, effectiveHours: 400 } : method,
              ),
            }
          : department,
      ),
    },
    { selectionMap: {} },
  )
  const smed = projectsViewModel.departments
    .find((department) => department.key === 'machining')
    .methods.find((method) => method.key === 'smed')
  assert.equal(smed.currentLevel >= 4, true)
})

test('same machine cannot receive two mold automations', () => {
  const normalized = normalizeMachineAutomationSelection([2], [1, 1, 2, 3], 3)
  assert.deepEqual(normalized, [1, 3])
})

test('SPC >= 4 unlocks automatic process measurement', () => {
  const projectsViewModel = buildProjectsViewModel(
    {
      ...projectsSnapshot,
      departments: projectsSnapshot.departments.map((department) =>
        department.key === 'machining'
          ? {
              ...department,
              methods: department.methods.map((method) =>
                method.key === 'spc' ? { ...method, effectiveHours: 400 } : method,
              ),
            }
          : department,
      ),
    },
    { selectionMap: {} },
  )

  const spc = projectsViewModel.departments
    .find((department) => department.key === 'machining')
    .methods.find((method) => method.key === 'spc')

  assert.equal(spc.currentLevel >= 4, true)
})

test('TPM >= 4 unlocks condition monitoring', () => {
  const projectsViewModel = buildProjectsViewModel(
    {
      ...projectsSnapshot,
      departments: projectsSnapshot.departments.map((department) =>
        department.key === 'machining'
          ? {
              ...department,
              methods: department.methods.map((method) =>
                method.key === 'tpm' ? { ...method, effectiveHours: 400 } : method,
              ),
            }
          : department,
      ),
    },
    { selectionMap: {} },
  )

  const tpm = projectsViewModel.departments
    .find((department) => department.key === 'machining')
    .methods.find((method) => method.key === 'tpm')

  assert.equal(tpm.currentLevel >= 4, true)
})

test('factory-wide systems cannot be bought twice (already installed in snapshot)', () => {
  assert.equal(investmentsSnapshot.investments.automaticProcessMeasurement.installed, false)
  assert.equal(investmentsSnapshot.investments.conditionMonitoring.installed, false)
})

test('machines depreciation is 5 percent per round', () => {
  assert.equal(calculateRoundDepreciation(500000, 0.05), 25000)
})

test('buildings depreciation is 2.5 percent per round', () => {
  assert.equal(calculateRoundDepreciation(1000000, 0.025), 25000)
})

test('existing balance sheet cash and debt are available for financing checks', () => {
  assert.equal(balanceSheetSnapshot.assets.cash > 0, true)
  assert.equal(balanceSheetSnapshot.liabilities.bankLoans > 0, true)
})

test('investments view model uses canonical gameState finance', () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const projectsViewModel = buildProjectsViewModel(projectsSnapshot, { selectionMap: {} })
  const viewModel = buildInvestmentsViewModel({
    snapshot: investmentsSnapshot,
    gameState,
    factorySettings: DEFAULT_FACTORY_SETTINGS,
    projectsViewModel,
    draftSelection: {},
  })

  assert.equal(viewModel.financing.currentCash, 50000)
  assert.equal(viewModel.financing.currentDebt, 2957900)
  assert.equal(viewModel.financing.equity, 2073975)
  assert.equal(viewModel.financing.availableCash, 0)
  assert.equal(viewModel.financing.financingCapacity, 1190050)
})

test('setup automation is one factory-wide canonical investment', () => {
  assert.equal(DEFAULT_FACTORY_SETTINGS.investments.setupAutomation.repeatable, false)
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const projectsViewModel = buildProjectsViewModel(projectsSnapshot, { selectionMap: {} })
  const viewModel = buildInvestmentsViewModel({
    snapshot: investmentsSnapshot,
    gameState,
    factorySettings: DEFAULT_FACTORY_SETTINGS,
    projectsViewModel,
    draftSelection: { setupAutomation: true },
  })

  assert.equal(viewModel.investmentRows.filter((item) => item.type === 'mold-change-automation').length, 1)
  assert.equal(viewModel.investmentRows.find((item) => item.type === 'mold-change-automation').machineId, undefined)
  assert.equal(viewModel.investmentRows.find((item) => item.type === 'mold-change-automation').cost, 250000)

  const legacyDraft = buildDraftSelectionFromDecision({
    investments: [{ type: 'mold-change-automation', machineId: 2, quantity: 1, cost: 250000 }],
  })
  assert.equal(legacyDraft.setupAutomation, true)
  assert.deepEqual(legacyDraft.moldAutomationMachineIds, undefined)
})

test('installed setup automation cannot be selected again', () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const projectsViewModel = buildProjectsViewModel(projectsSnapshot, { selectionMap: {} })
  const viewModel = buildInvestmentsViewModel({
    snapshot: investmentsSnapshot,
    gameState: {
      ...gameState,
      investments: {
        ...gameState.investments,
        setupAutomation: { installed: true },
      },
    },
    factorySettings: DEFAULT_FACTORY_SETTINGS,
    projectsViewModel,
    draftSelection: { setupAutomation: true },
  })

  assert.equal(viewModel.guards.setupAutomationInstalled, true)
  assert.equal(viewModel.investmentRows.some((item) => item.type === 'mold-change-automation'), false)
})