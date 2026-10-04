const EURO_FORMATTER = new Intl.NumberFormat('fi-FI', {
  maximumFractionDigits: 0,
})

const MACHINERY_DEPRECIATION_RATE_PER_ROUND = 0.05
const BUILDINGS_DEPRECIATION_RATE_PER_ROUND = 0.025

function formatCurrency(value) {
  return `${EURO_FORMATTER.format(Math.round(value))} €`
}

function formatArea(value) {
  return `${EURO_FORMATTER.format(Math.round(value))} m²`
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

export function canFinanceInvestment(totalCost, financialState, options = {}) {
  const financeOptions =
    typeof options === 'number'
      ? { targetCash: 0, maxDebtToEquity: options }
      : options
  const cashBalance = Number(financialState.cashBalance) || 0
  const bankLoanDebt = Math.max(0, Number(financialState.bankLoanDebt) || 0)
  const equity = Math.max(0, Number(financialState.equity) || 0)
  const targetCash = Math.max(0, Number(financeOptions.targetCash) || 0)
  const maxDebtToEquity = Math.max(0, Number(financeOptions.maxDebtToEquity ?? 2) || 0)

  const availableCash = Math.max(0, cashBalance - targetCash)
  const openingDebt = bankLoanDebt
  const debtLimit = calculateDebtLimit(equity, maxDebtToEquity)
  const debtHeadroom = Math.max(0, debtLimit - openingDebt)
  const financingCapacity = availableCash + debtHeadroom

  const normalizedCost = Math.max(0, Number(totalCost) || 0)
  const cashUsed = Math.min(availableCash, normalizedCost)
  const newDebt = Math.max(0, normalizedCost - cashUsed)
  const debtAfter = openingDebt + newDebt
  const remainingDebtHeadroom = Math.max(0, debtLimit - debtAfter)
  const remainingFinancingCapacity = Math.max(0, financingCapacity - normalizedCost)
  const canFinance = normalizedCost <= financingCapacity

  return {
    canFinance,
    targetCash,
    availableCash,
    openingDebt,
    maxDebt: debtLimit,
    debtHeadroom,
    financingCapacity,
    cashUsed,
    newDebt,
    financingNeed: newDebt,
    debtAfter,
    remainingDebtHeadroom,
    remainingFinancingCapacity,
    cashAfter: cashBalance - cashUsed,
    debtLimit,
    debtCapacity: debtHeadroom,
    reason: canFinance ? null : 'debt-limit-exceeded',
  }
}

function parseDraftToSelectionState(draftSelection = {}) {
  const newMachineCount = Math.max(0, Math.round(Number(draftSelection.newMachineCount) || 0))
  const expansionCount = Math.max(0, Math.round(Number(draftSelection.expansionCount) || 0))

  return {
    newMachineCount,
    expansionCount,
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

export function buildInvestmentsViewModel({ snapshot, gameState, factorySettings, draftSelection }) {
  const selectionState = parseDraftToSelectionState(draftSelection)
  const newTotalArea = applyFactoryExpansion(snapshot.factory.totalAreaM2, selectionState.expansionCount)
  const newMachineCount = applyNewMachineCount(snapshot.factory.machiningMachineCount, selectionState.newMachineCount)

  const baseSpace = calculateFactorySpaceUsage(snapshot.factory)
  const projectedSpace = calculateFactorySpaceUsage({
    ...snapshot.factory,
    totalAreaM2: newTotalArea,
    machiningMachineCount: newMachineCount,
  })

  const financialState = {
    cashBalance: gameState.finance.cash,
    bankLoanDebt: gameState.finance.bankLoans,
    equity: gameState.finance.equity,
  }

  const investmentRows = buildInvestmentRows(selectionState, snapshot)
  const totalCost = investmentRows.reduce((sum, item) => sum + item.cost, 0)
  const financeOptions = {
    targetCash: factorySettings.finance.targetCash,
    maxDebtToEquity: factorySettings.finance.maxDebtToEquity,
  }
  const financing = canFinanceInvestment(totalCost, financialState, financeOptions)
  const depreciationPerRound = calculateSelectionDepreciation(investmentRows, snapshot)

  const canAddMachineBySpace = projectedSpace.freeArea >= 0
  const oneMachineCost = snapshot.investments.newMachine.unitCost
  const plusOneMachineFinancing = canFinanceInvestment(
    totalCost + oneMachineCost,
    financialState,
    financeOptions,
  )
  const canAddMachine = canAddMachineBySpace && plusOneMachineFinancing.canFinance

  const plusOneExpansionFinancing = canFinanceInvestment(
    totalCost + snapshot.investments.factoryExpansion.unitCost,
    financialState,
    financeOptions,
  )
  const machineCountAfterSelection = newMachineCount
  const addedPersonnel = getAdditionalPersonnelFromMachines(selectionState.newMachineCount)

  return {
    round: snapshot.round,
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
      equity: financialState.equity,
      currentCash: financialState.cashBalance,
      currentDebt: financialState.bankLoanDebt,
      currentCashText: formatCurrency(financialState.cashBalance),
      currentDebtText: formatCurrency(financialState.bankLoanDebt),
      equityText: formatCurrency(financialState.equity),
      debtLimitText: formatCurrency(financing.debtLimit),
      maxDebtText: formatCurrency(financing.maxDebt),
      availableCashText: formatCurrency(financing.availableCash),
      debtHeadroomText: formatCurrency(financing.debtHeadroom),
      financingCapacityText: formatCurrency(financing.financingCapacity),
      remainingDebtHeadroomText: formatCurrency(financing.remainingDebtHeadroom),
      remainingFinancingCapacityText: formatCurrency(financing.remainingFinancingCapacity),
      targetCashText: formatCurrency(financing.targetCash),
      cashUsedText: formatCurrency(financing.cashUsed),
      financingNeedText: formatCurrency(financing.newDebt),
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
    },
    investmentRows,
  }
}

export function buildDraftSelectionFromDecision(decision = {}) {
  const result = {
    newMachineCount: 0,
    expansionCount: 0,
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

  })

  return result
}