import test from 'node:test'
import assert from 'node:assert/strict'
import investmentsSnapshot from '../../mocks/investmentsSnapshot.json' with { type: 'json' }
import balanceSheetSnapshot from '../../mocks/balanceSheetSnapshot.json' with { type: 'json' }
import projectsSnapshot from '../../mocks/projectsSnapshot.json' with { type: 'json' }
import { buildProjectsViewModel } from '../lean-projects/model.js'
import {
  applyFactoryExpansion,
  applyNewMachineCount,
  calculateDebtLimit,
  calculateFactorySpaceUsage,
  calculateRoundDepreciation,
  canFinanceInvestment,
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