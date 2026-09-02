const EURO_FORMATTER = new Intl.NumberFormat('fi-FI', {
  maximumFractionDigits: 0,
})

const DECIMAL_FORMATTER = new Intl.NumberFormat('fi-FI', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const MACHINERY_DEPRECIATION_RATE_PER_ROUND = 0.05
const BUILDINGS_DEPRECIATION_RATE_PER_ROUND = 0.025

function formatCurrency(value) {
  return `${EURO_FORMATTER.format(Math.round(value))} €`
}

function formatArea(value) {
  return `${EURO_FORMATTER.format(Math.round(value))} m²`
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

function buildSelectionKey(type, machineId = null) {
  return machineId == null ? type : `${type}:${machineId}`
}

function parseSelectionKey(key) {
  const [type, machineIdRaw] = String(key).split(':')

  return {
    type,
    machineId: machineIdRaw ? Number(machineIdRaw) : null,
  }
}

export function calculateDebtLimit(equity, maxDebtToEquity = 2) {
  return Math.max(0, Number(equity) || 0) * Math.max(0, Number(maxDebtToEquity) || 0)
}

export function calculateRoundDepreciation(value, rate) {
  return Math.round((Number(value) || 0) * (Number(rate) || 0))
}

export function calculateFactorySpaceUsage(factoryState) {
  const machiningArea = (factoryState.machiningMachineCount || 0) * 250
  const assemblyArea = (factoryState.assemblyWorkers || 0) * 25
  const dispatchArea = factoryState.dispatchM2 || 0
  const finishedGoodsArea = (factoryState.finishedGoodsContainers || 0) * 15
  const officeAndSocialArea = factoryState.officeAndSocialM2 || 0
  const totalUsed = machiningArea + assemblyArea + dispatchArea + finishedGoodsArea + officeAndSocialArea

  return {
    machiningArea,
    assemblyArea,
    dispatchArea,
    finishedGoodsArea,
    officeAndSocialArea,
    totalUsed,
    freeArea: (factoryState.totalAreaM2 || 0) - totalUsed,
  }
}

export function applyFactoryExpansion(totalAreaM2, expansionCount) {
  return Number(totalAreaM2) + Number(expansionCount) * 1000
}

export function applyNewMachineCount(machineCount, purchasedMachineCount) {
  return Number(machineCount) + Number(purchasedMachineCount)
}

export function getAdditionalPersonnelFromMachines(purchasedMachineCount) {
  return Number(purchasedMachineCount) * 5
}

export function normalizeMachineAutomationSelection(installedMachineIds, selectedMachineIds, machineCount) {
  const installedSet = new Set(installedMachineIds)
  const uniqueSelected = new Set(selectedMachineIds)

  return [...uniqueSelected]
    .filter((machineId) => Number.isInteger(machineId))
    .filter((machineId) => machineId >= 1 && machineId <= machineCount)
    .filter((machineId) => !installedSet.has(machineId))
    .sort((left, right) => left - right)
}

export function canFinanceInvestment(totalCost, financialState, maxDebtToEquity = 2) {
  const cashBalance = Number(financialState.cashBalance) || 0
  const bankLoanDebt = Number(financialState.bankLoanDebt) || 0
  const equity = Math.max(0, Number(financialState.equity) || 0)

  const availableCash = Math.max(0, cashBalance)
  const existingDebt = bankLoanDebt + Math.max(0, -cashBalance)
  const debtLimit = calculateDebtLimit(equity, maxDebtToEquity)

  const cashUsed = Math.min(availableCash, totalCost)
  const financingNeed = Math.max(0, totalCost - cashUsed)
  const debtAfter = existingDebt + financingNeed
  const debtCapacity = debtLimit - existingDebt

  if (existingDebt > debtLimit && financingNeed > 0) {
    return {
      canFinance: false,
      cashUsed,
      financingNeed,
      debtAfter,
      debtLimit,
      debtCapacity,
      reason: 'existing-debt-over-limit',
    }
  }

  if (debtAfter > debtLimit) {
    return {
      canFinance: false,
      cashUsed,
      financingNeed,
      debtAfter,
      debtLimit,
      debtCapacity,
      reason: 'debt-limit-exceeded',
    }
  }

  return {
    canFinance: true,
    cashUsed,
    financingNeed,
    debtAfter,
    debtLimit,
    debtCapacity,
    reason: null,
  }
}

function getMethodLevel(projectsViewModel, departmentKey, methodKey) {
  const department = projectsViewModel.departments.find((item) => item.key === departmentKey)

  if (!department) {
    return 0
  }

  const method = department.methods.find((item) => item.key === methodKey)
  return Number(method?.currentLevel) || 0
}

function parseDraftToSelectionState(draftSelection = {}, snapshot) {
  const newMachineCount = Math.max(0, Math.round(Number(draftSelection.newMachineCount) || 0))
  const expansionCount = Math.max(0, Math.round(Number(draftSelection.expansionCount) || 0))
  const measurementSelected = Boolean(draftSelection.automaticProcessMeasurement)
  const conditionMonitoringSelected = Boolean(draftSelection.conditionMonitoring)

  const moldSelectionRaw = Array.isArray(draftSelection.moldAutomationMachineIds)
    ? draftSelection.moldAutomationMachineIds
    : []

  const moldAutomationMachineIds = normalizeMachineAutomationSelection(
    snapshot.investments.moldChangeAutomation.installedMachineIds,
    moldSelectionRaw,
    snapshot.factory.machiningMachineCount,
  )

  return {
    newMachineCount,
    expansionCount,
    moldAutomationMachineIds,
    automaticProcessMeasurement: measurementSelected,
    conditionMonitoring: conditionMonitoringSelected,
  }
}

function buildInvestmentRows(selectionState, snapshot) {
  const rows = []

  if (selectionState.newMachineCount > 0) {
    rows.push({
      type: snapshot.investments.newMachine.type,
      quantity: selectionState.newMachineCount,
      machineId: null,
      cost: snapshot.investments.newMachine.unitCost * selectionState.newMachineCount,
    })
  }

  if (selectionState.expansionCount > 0) {
    rows.push({
      type: snapshot.investments.factoryExpansion.type,
      quantity: selectionState.expansionCount,
      machineId: null,
      cost: snapshot.investments.factoryExpansion.unitCost * selectionState.expansionCount,
    })
  }

  selectionState.moldAutomationMachineIds.forEach((machineId) => {
    rows.push({
      type: snapshot.investments.moldChangeAutomation.type,
      quantity: 1,
      machineId,
      cost: snapshot.investments.moldChangeAutomation.unitCost,
    })
  })

  if (selectionState.automaticProcessMeasurement) {
    rows.push({
      type: snapshot.investments.automaticProcessMeasurement.type,
      quantity: 1,
      machineId: null,
      cost: snapshot.investments.automaticProcessMeasurement.unitCost,
    })
  }

  if (selectionState.conditionMonitoring) {
    rows.push({
      type: snapshot.investments.conditionMonitoring.type,
      quantity: 1,
      machineId: null,
      cost: snapshot.investments.conditionMonitoring.unitCost,
    })
  }

  return rows
}

function calculateSelectionDepreciation(investmentRows, snapshot) {
  return investmentRows.reduce((sum, item) => {
    if (item.type === snapshot.investments.factoryExpansion.type) {
      return sum + calculateRoundDepreciation(item.cost, BUILDINGS_DEPRECIATION_RATE_PER_ROUND)
    }

    return sum + calculateRoundDepreciation(item.cost, MACHINERY_DEPRECIATION_RATE_PER_ROUND)
  }, 0)
}

export function buildInvestmentsViewModel({ snapshot, balanceSheetSnapshot, projectsViewModel, draftSelection }) {
  const selectionState = parseDraftToSelectionState(draftSelection, snapshot)
  const newTotalArea = applyFactoryExpansion(snapshot.factory.totalAreaM2, selectionState.expansionCount)
  const newMachineCount = applyNewMachineCount(snapshot.factory.machiningMachineCount, selectionState.newMachineCount)

  const baseSpace = calculateFactorySpaceUsage(snapshot.factory)
  const projectedSpace = calculateFactorySpaceUsage({
    ...snapshot.factory,
    totalAreaM2: newTotalArea,
    machiningMachineCount: newMachineCount,
  })

  const assetsTotal =
    balanceSheetSnapshot.assets.machinery +
    balanceSheetSnapshot.assets.buildings +
    balanceSheetSnapshot.assets.cash +
    balanceSheetSnapshot.assets.inventory
  const equity = assetsTotal - balanceSheetSnapshot.liabilities.bankLoans
  const financialState = {
    cashBalance: balanceSheetSnapshot.assets.cash,
    bankLoanDebt: balanceSheetSnapshot.liabilities.bankLoans,
    equity,
  }

  const smedLevel = getMethodLevel(projectsViewModel, 'machining', 'smed')
  const spcLevel = getMethodLevel(projectsViewModel, 'machining', 'spc')
  const tpmLevel = getMethodLevel(projectsViewModel, 'machining', 'tpm')

  const investmentRows = buildInvestmentRows(selectionState, snapshot)
  const totalCost = investmentRows.reduce((sum, item) => sum + item.cost, 0)
  const financing = canFinanceInvestment(totalCost, financialState)
  const depreciationPerRound = calculateSelectionDepreciation(investmentRows, snapshot)

  const machineList = Array.from({ length: snapshot.factory.machiningMachineCount }, (_, index) => index + 1)
  const installedMoldAutomation = new Set(snapshot.investments.moldChangeAutomation.installedMachineIds)
  const selectedMoldAutomation = new Set(selectionState.moldAutomationMachineIds)

  const moldAutomationByMachine = machineList.map((machineId) => {
    const isInstalled = installedMoldAutomation.has(machineId)
    const isSelected = selectedMoldAutomation.has(machineId)

    return {
      machineId,
      isInstalled,
      isSelected,
      canSelect: !isInstalled,
    }
  })

  const canUnlockMoldAutomation = smedLevel >= snapshot.investments.moldChangeAutomation.requiredSmedLevel
  const canUnlockAutoMeasurement =
    spcLevel >= snapshot.investments.automaticProcessMeasurement.requiredSpcLevel
  const canUnlockConditionMonitoring =
    tpmLevel >= snapshot.investments.conditionMonitoring.requiredTpmLevel

  const canAddMachineBySpace = projectedSpace.freeArea >= 0
  const oneMachineCost = snapshot.investments.newMachine.unitCost
  const plusOneMachineFinancing = canFinanceInvestment(totalCost + oneMachineCost, financialState)
  const canAddMachine = canAddMachineBySpace && plusOneMachineFinancing.canFinance

  const plusOneExpansionFinancing = canFinanceInvestment(
    totalCost + snapshot.investments.factoryExpansion.unitCost,
    financialState,
  )

  const machineCountAfterSelection = newMachineCount
  const addedPersonnel = getAdditionalPersonnelFromMachines(selectionState.newMachineCount)

  return {
    round: snapshot.round,
    methodLevels: {
      smedLevel,
      spcLevel,
      tpmLevel,
      smedLevelText: DECIMAL_FORMATTER.format(smedLevel),
      spcLevelText: DECIMAL_FORMATTER.format(spcLevel),
      tpmLevelText: DECIMAL_FORMATTER.format(tpmLevel),
    },
    selectionState,
    machineCountAfterSelection,
    addedPersonnel,
    space: {
      base: baseSpace,
      projected: projectedSpace,
      totalAreaText: formatArea(newTotalArea),
      usedAreaText: formatArea(projectedSpace.totalUsed),
      freeAreaText: formatArea(projectedSpace.freeArea),
    },
    financing: {
      ...financing,
      equity,
      currentCash: financialState.cashBalance,
      currentDebt: financialState.bankLoanDebt,
      currentCashText: formatCurrency(financialState.cashBalance),
      currentDebtText: formatCurrency(financialState.bankLoanDebt),
      equityText: formatCurrency(equity),
      debtLimitText: formatCurrency(financing.debtLimit),
      cashUsedText: formatCurrency(financing.cashUsed),
      financingNeedText: formatCurrency(financing.financingNeed),
      debtAfterText: formatCurrency(financing.debtAfter),
    },
    totals: {
      totalCost,
      totalCostText: formatCurrency(totalCost),
      depreciationPerRound,
      depreciationPerRoundText: formatCurrency(depreciationPerRound),
    },
    guards: {
      canAddMachine,
      canAddExpansion: plusOneExpansionFinancing.canFinance,
      canUnlockMoldAutomation,
      canUnlockAutoMeasurement,
      canUnlockConditionMonitoring,
      autoMeasurementAlreadyInstalled: snapshot.investments.automaticProcessMeasurement.installed,
      conditionMonitoringAlreadyInstalled: snapshot.investments.conditionMonitoring.installed,
    },
    machineAutomation: {
      machines: moldAutomationByMachine,
    },
    investmentRows,
  }
}

export function buildDraftSelectionFromDecision(decision = {}) {
  const result = {
    newMachineCount: 0,
    expansionCount: 0,
    moldAutomationMachineIds: [],
    automaticProcessMeasurement: false,
    conditionMonitoring: false,
  }

  if (!decision?.investments || !Array.isArray(decision.investments)) {
    return result
  }

  decision.investments.forEach((item) => {
    if (item.type === 'new-machine') {
      result.newMachineCount += Number(item.quantity) || 0
      return
    }

    if (item.type === 'factory-expansion') {
      result.expansionCount += Number(item.quantity) || 0
      return
    }

    if (item.type === 'mold-change-automation' && item.machineId != null) {
      result.moldAutomationMachineIds.push(Number(item.machineId))
      return
    }

    if (item.type === 'automatic-process-measurement') {
      result.automaticProcessMeasurement = true
      return
    }

    if (item.type === 'condition-monitoring') {
      result.conditionMonitoring = true
    }
  })

  return result
}