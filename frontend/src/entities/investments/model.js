import { DEFAULT_FACTORY_SETTINGS } from '../factory-settings/defaultFactorySettings.js'
import {
  calculateFactorySpace,
  calculateMinimumFinishedGoodsContainers,
} from '../factory-space/model.js'

const EURO_FORMATTER = new Intl.NumberFormat('fi-FI', {
  maximumFractionDigits: 0,
})

const MACHINERY_DEPRECIATION_RATE_PER_ROUND = 0.05
const BUILDINGS_DEPRECIATION_RATE_PER_ROUND = 0.025

function toNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

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

export function calculateFactorySpaceUsage(factoryState, factorySettings = DEFAULT_FACTORY_SETTINGS) {
  return calculateFactorySpace({
    totalAreaM2: factoryState.totalAreaM2,
    machineCount: factoryState.machiningMachineCount,
    assemblyWorkers: factoryState.assemblyWorkers,
    shippingWorkers: factoryState.shippingWorkers,
    dispatchM2: factoryState.dispatchM2,
    officeAndSocialM2: factoryState.officeAndSocialM2,
    finishedGoodsContainers: factoryState.finishedGoodsContainers,
    minimumFinishedGoodsContainers: factoryState.minimumFinishedGoodsContainers,
  }, factorySettings)
}

export function applyFactoryExpansion(totalAreaM2, expansionCount, expansionAreaM2 = 1000) {
  return Number(totalAreaM2) + Number(expansionCount) * Number(expansionAreaM2)
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
  const settings = factorySettings ?? DEFAULT_FACTORY_SETTINGS
  const factorySettingsSection = settings.factory ?? DEFAULT_FACTORY_SETTINGS.factory
  const variationCount = gameState.market?.activeVariations ?? settings.initialState?.market?.activeVariations
  const batchSize = gameState.market?.batchSize ?? settings.production?.initialBatchSize
  const currentFactory = {
    totalAreaM2: gameState.factory?.totalAreaM2,
    machiningMachineCount: gameState.production?.machiningMachines,
    assemblyWorkers: gameState.staffing?.assembly,
    shippingWorkers: gameState.staffing?.shipping,
    dispatchM2: gameState.factory?.dispatchM2,
    officeAndSocialM2: gameState.factory?.officeAndSocialM2,
    finishedGoodsContainers: gameState.inventory?.finishedGoodsContainers,
    minimumFinishedGoodsContainers: calculateMinimumFinishedGoodsContainers({
      variations: variationCount,
      batchSize,
      machineCount: gameState.production?.machiningMachines,
    }),
  }
  const selectionState = parseDraftToSelectionState(draftSelection)
  const expansionAreaM2 = toNumber(factorySettingsSection.factoryExpansionM2, 1000)
  const newTotalArea = applyFactoryExpansion(currentFactory.totalAreaM2, selectionState.expansionCount, expansionAreaM2)
  const newMachineCount = applyNewMachineCount(currentFactory.machiningMachineCount, selectionState.newMachineCount)

  const baseSpace = calculateFactorySpaceUsage(currentFactory, settings)
  const projectedSpace = calculateFactorySpaceUsage({
    ...currentFactory,
    totalAreaM2: newTotalArea,
    machiningMachineCount: newMachineCount,
    minimumFinishedGoodsContainers: calculateMinimumFinishedGoodsContainers({
      variations: variationCount,
      batchSize,
      machineCount: newMachineCount,
    }),
  }, settings)

  const financialState = {
    cashBalance: gameState.finance.cash,
    bankLoanDebt: gameState.finance.bankLoans,
    equity: gameState.finance.equity,
  }

  const investmentCatalog = {
    ...snapshot,
    investments: {
      ...snapshot.investments,
      newMachine: {
        ...snapshot.investments.newMachine,
        unitCost: toNumber(settings.investments?.newMachine?.price, snapshot.investments.newMachine.unitCost),
      },
      factoryExpansion: {
        ...snapshot.investments.factoryExpansion,
        unitCost: toNumber(settings.investments?.factoryExpansion?.price, snapshot.investments.factoryExpansion.unitCost),
      },
    },
  }
  const investmentRows = buildInvestmentRows(selectionState, investmentCatalog)
  const totalCost = investmentRows.reduce((sum, item) => sum + item.cost, 0)
  const financeOptions = {
    targetCash: settings.finance.targetCash,
    maxDebtToEquity: settings.finance.maxDebtToEquity,
  }
  const financing = canFinanceInvestment(totalCost, financialState, financeOptions)
  const depreciationPerRound = calculateSelectionDepreciation(investmentRows, investmentCatalog)

  const canAddMachineBySpace = projectedSpace.freeArea >= 0
  const oneMachineCost = investmentCatalog.investments.newMachine.unitCost
  const plusOneMachineFinancing = canFinanceInvestment(
    totalCost + oneMachineCost,
    financialState,
    financeOptions,
  )
  const canAddMachine = canAddMachineBySpace && plusOneMachineFinancing.canFinance

  const plusOneExpansionFinancing = canFinanceInvestment(
    totalCost + investmentCatalog.investments.factoryExpansion.unitCost,
    financialState,
    financeOptions,
  )
  const machineCountAfterSelection = newMachineCount
  const addedPersonnel = getAdditionalPersonnelFromMachines(selectionState.newMachineCount)

  return {
    round: gameState.round,
    selectionState,
    machineCountAfterSelection,
    addedPersonnel,
    space: {
      base: baseSpace,
      projected: projectedSpace,
      totalAreaText: formatArea(baseSpace.totalArea),
      usedAreaText: formatArea(baseSpace.totalUsed),
      freeAreaText: formatArea(baseSpace.freeArea),
      baseText: {
        totalArea: formatArea(baseSpace.totalArea),
        usedArea: formatArea(baseSpace.totalUsed),
        freeArea: formatArea(baseSpace.freeArea),
      },
      projectedText: {
        totalArea: formatArea(projectedSpace.totalArea),
        usedArea: formatArea(projectedSpace.totalUsed),
        freeArea: formatArea(projectedSpace.freeArea),
      },
      investmentSpaceChange: projectedSpace.freeArea - baseSpace.freeArea,
      investmentSpaceChangeText: `${projectedSpace.freeArea - baseSpace.freeArea > 0 ? '+' : ''}${formatArea(projectedSpace.freeArea - baseSpace.freeArea)}`,
      breakdown: [
        { key: 'machiningArea', label: 'Koneistus' },
        { key: 'assemblyArea', label: 'Kokoonpano' },
        { key: 'shippingWorkerArea', label: 'Lähettämöhenkilöstö' },
        { key: 'shippingArea', label: 'Lähettämö' },
        { key: 'officeAndSocialArea', label: 'Toimistot ja muut kiinteät tilat' },
        { key: 'finishedGoodsArea', label: 'Valmistuotevarasto' },
      ].map((row) => ({
        ...row,
        currentArea: baseSpace[row.key],
        projectedArea: projectedSpace[row.key],
        currentAreaText: formatArea(baseSpace[row.key]),
        projectedAreaText: formatArea(projectedSpace[row.key]),
      })),
      usedCurrent: baseSpace.totalUsed,
      freeCurrent: baseSpace.freeArea,
      totalCurrent: baseSpace.totalArea,
      usedProjected: projectedSpace.totalUsed,
      freeProjected: projectedSpace.freeArea,
      totalProjected: projectedSpace.totalArea,
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