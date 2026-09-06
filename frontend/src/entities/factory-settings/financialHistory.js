import { DEFAULT_FACTORY_SETTINGS } from './defaultFactorySettings.js'
import { createInitialGameState } from './initialGameState.js'
import { calculateFinancingStructure } from './financingStructure.js'

function toNumber(value, fallback = 0) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function toPercentDelta(currentValue, previousValue) {
  const previous = toNumber(previousValue)
  const current = toNumber(currentValue)

  if (previous === 0) {
    return 0
  }

  return Number((((current - previous) / previous) * 100).toFixed(1))
}

function buildIncomeRows(current, previous) {
  return {
    sales: {
      label: 'Myynti',
      unit: 'kpl',
      amount: toNumber(current.sales),
      deltaPct: toPercentDelta(current.sales, previous.sales),
    },
    revenue: {
      label: 'Liikevaihto',
      unit: 'EUR',
      amount: toNumber(current.revenue),
      deltaPct: toPercentDelta(current.revenue, previous.revenue),
    },
    inventoryChange: {
      label: 'Varaston muutos',
      unit: 'EUR',
      amount: toNumber(current.inventoryChange),
      deltaPct: toPercentDelta(current.inventoryChange, previous.inventoryChange),
    },
    materials: {
      label: 'Raaka-aineet',
      unit: 'EUR',
      amount: toNumber(current.materials),
      deltaPct: toPercentDelta(current.materials, previous.materials),
    },
    labor: {
      label: 'Työ',
      unit: 'EUR',
      amount: toNumber(current.labor),
      deltaPct: toPercentDelta(current.labor, previous.labor),
    },
    fixedCosts: {
      label: 'Kiinteät kustannukset',
      unit: 'EUR',
      amount: toNumber(current.fixedCosts),
      deltaPct: toPercentDelta(current.fixedCosts, previous.fixedCosts),
    },
    depreciation: {
      label: 'Poistot',
      unit: 'EUR',
      amount: toNumber(current.depreciation),
      deltaPct: toPercentDelta(current.depreciation, previous.depreciation),
    },
    financingCosts: {
      label: 'Rahoituskustannukset',
      unit: 'EUR',
      amount: toNumber(current.financingCosts),
      deltaPct: toPercentDelta(current.financingCosts, previous.financingCosts),
    },
  }
}

function buildRoundZeroCanonicalFinance(gameState, factorySettings) {
  const initialFinance = gameState.finance || {}
  const previousBalanceInput =
    factorySettings.initialState?.finance?.history?.previousRoundBalanceSheet || {}
  const previousIncome =
    factorySettings.initialState?.finance?.history?.previousRoundIncomeStatement || {}
  const financeSettings = factorySettings.finance || DEFAULT_FACTORY_SETTINGS.finance

  const previousMachinery = toNumber(previousBalanceInput.assets?.machineryAndEquipment)
  const previousBuildings = toNumber(previousBalanceInput.assets?.buildings)
  const previousFinishedGoodsInventory = toNumber(
    previousBalanceInput.assets?.finishedGoodsInventory,
  )
  const previousRawMaterialInventory = toNumber(
    previousBalanceInput.assets?.rawMaterialInventory,
  )
  const previousOverdraft = toNumber(previousBalanceInput.equityAndLiabilities?.overdraft)
  const previousEquity = toNumber(previousBalanceInput.equityAndLiabilities?.equity)

  const previousFinancingStructure = calculateFinancingStructure({
    nonCashAssets:
      previousBuildings +
      previousMachinery +
      previousFinishedGoodsInventory +
      previousRawMaterialInventory,
    equity: previousEquity,
    rawMaterialCosts: toNumber(previousIncome.materials),
    factorySettings,
  })

  // TODO: Historical round -1 financing cost is calibrated history and does not directly match the new canonical debt balance. Interest timing/basis will be resolved separately before advanceRound.
  const previousBalance = {
    round: toNumber(previousBalanceInput.round, -1),
    assets: {
      buildings: previousBuildings,
      machineryAndEquipment: previousMachinery,
      finishedGoodsInventory: previousFinishedGoodsInventory,
      rawMaterialInventory: previousRawMaterialInventory,
      cash: previousFinancingStructure.cash,
    },
    equityAndLiabilities: {
      equity: previousEquity,
      bankLoans: previousFinancingStructure.interestBearingDebt,
      otherLiabilities: previousFinancingStructure.otherLiabilities,
      overdraft: previousOverdraft,
    },
  }

  const machineryDepreciationRate = toNumber(
    financeSettings.machineryDepreciationPerRound,
    DEFAULT_FACTORY_SETTINGS.finance.machineryDepreciationPerRound,
  )
  const buildingDepreciationRate = toNumber(
    financeSettings.buildingDepreciationPerRound,
    DEFAULT_FACTORY_SETTINGS.finance.buildingDepreciationPerRound,
  )

  const machineryDepreciation = Math.round(previousMachinery * machineryDepreciationRate)
  const buildingDepreciation = Math.round(previousBuildings * buildingDepreciationRate)
  const totalDepreciation = machineryDepreciation + buildingDepreciation

  const machineryBookValue = previousMachinery - machineryDepreciation
  const buildingsBookValue = previousBuildings - buildingDepreciation

  const finishedGoodsInventory = toNumber(initialFinance.finishedGoodsInventoryBookValue)
  const rawMaterialInventory = toNumber(initialFinance.rawMaterialInventoryBookValue)
  const overdraft = toNumber(initialFinance.overdraft)

  const revenue = toNumber(initialFinance.incomeStatement?.revenue)
  const inventoryChange = toNumber(initialFinance.incomeStatement?.inventoryChange)
  const materials = toNumber(initialFinance.incomeStatement?.materials)
  const labor = toNumber(initialFinance.incomeStatement?.labor)
  const fixedCosts = toNumber(initialFinance.incomeStatement?.fixedCosts)
  const financingCosts = toNumber(initialFinance.incomeStatement?.financingCosts)

  const result =
    revenue +
    inventoryChange -
    materials -
    labor -
    fixedCosts -
    totalDepreciation -
    financingCosts

  const equity = previousEquity + result

  const nonCashAssets =
    buildingsBookValue +
    machineryBookValue +
    finishedGoodsInventory +
    rawMaterialInventory

  const financingStructure = calculateFinancingStructure({
    nonCashAssets,
    equity,
    rawMaterialCosts: materials,
    factorySettings,
  })
  const cash = financingStructure.cash
  const bankLoans = financingStructure.interestBearingDebt
  const otherLiabilities = financingStructure.otherLiabilities
  const assetsTotal = financingStructure.totalAssets

  return {
    currentIncome: {
      sales: toNumber(initialFinance.incomeStatement?.sales),
      revenue,
      inventoryChange,
      materials,
      labor,
      fixedCosts,
      depreciation: totalDepreciation,
      financingCosts,
    },
    previousIncome,
    currentBalance: {
      assets: {
        buildings: buildingsBookValue,
        machinery: machineryBookValue,
        finishedGoodsInventory,
        rawMaterialInventory,
        cash,
      },
      liabilities: {
        equity,
        interestBearingDebt: bankLoans,
        bankLoans,
        otherLiabilities,
        overdraft,
      },
    },
    previousBalance,
    depreciation: {
      machineryDepreciation,
      buildingDepreciation,
      totalDepreciation,
    },
    totals: {
      assetsTotal,
      totalEquityAndLiabilities: financingStructure.totalEquityAndLiabilities,
    },
    financingStructure,
  }
}

export function buildInitialIncomeHistory(
  gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS),
  factorySettings = DEFAULT_FACTORY_SETTINGS,
) {
  const canonicalFinance = buildRoundZeroCanonicalFinance(gameState, factorySettings)
  const currentIncome = canonicalFinance.currentIncome || {}
  const previousIncome = canonicalFinance.previousIncome || {}

  return {
    round: 0,
    previousRound: -1,
    rows: buildIncomeRows(currentIncome, previousIncome),
    previousRows: {
      sales: {
        label: 'Myynti',
        unit: 'kpl',
        amount: toNumber(previousIncome.sales),
      },
      revenue: {
        label: 'Liikevaihto',
        unit: 'EUR',
        amount: toNumber(previousIncome.revenue),
      },
      inventoryChange: {
        label: 'Varaston muutos',
        unit: 'EUR',
        amount: toNumber(previousIncome.inventoryChange),
      },
      materials: {
        label: 'Raaka-aineet',
        unit: 'EUR',
        amount: toNumber(previousIncome.materials),
      },
      labor: {
        label: 'Työ',
        unit: 'EUR',
        amount: toNumber(previousIncome.labor),
      },
      fixedCosts: {
        label: 'Kiinteät kustannukset',
        unit: 'EUR',
        amount: toNumber(previousIncome.fixedCosts),
      },
      depreciation: {
        label: 'Poistot',
        unit: 'EUR',
        amount: toNumber(previousIncome.depreciation),
      },
      financingCosts: {
        label: 'Rahoituskustannukset',
        unit: 'EUR',
        amount: toNumber(previousIncome.financingCosts),
      },
    },
    gameRound: toNumber(gameState.round, 1),
  }
}

export function buildInitialBalanceSheetHistory(
  gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS),
  factorySettings = DEFAULT_FACTORY_SETTINGS,
) {
  const canonicalFinance = buildRoundZeroCanonicalFinance(gameState, factorySettings)
  const currentBalance = canonicalFinance.currentBalance
  const previousBalance = canonicalFinance.previousBalance

  const currentAssets = {
    buildings: toNumber(currentBalance.assets?.buildings),
    machinery: toNumber(currentBalance.assets?.machinery),
    finishedGoodsInventory: toNumber(currentBalance.assets?.finishedGoodsInventory),
    rawMaterialInventory: toNumber(currentBalance.assets?.rawMaterialInventory),
    cash: toNumber(currentBalance.assets?.cash),
  }

  const currentLiabilities = {
    equity: toNumber(currentBalance.liabilities?.equity),
    interestBearingDebt: toNumber(currentBalance.liabilities?.interestBearingDebt),
    bankLoans: toNumber(currentBalance.liabilities?.bankLoans),
    otherLiabilities: toNumber(currentBalance.liabilities?.otherLiabilities),
    overdraft: toNumber(currentBalance.liabilities?.overdraft),
  }

  const previousAssets = {
    buildings: toNumber(previousBalance.assets?.buildings),
    machinery: toNumber(previousBalance.assets?.machineryAndEquipment),
    finishedGoodsInventory: toNumber(previousBalance.assets?.finishedGoodsInventory),
    rawMaterialInventory: toNumber(previousBalance.assets?.rawMaterialInventory),
    cash: toNumber(previousBalance.assets?.cash),
  }

  const previousLiabilities = {
    equity: toNumber(previousBalance.equityAndLiabilities?.equity),
    interestBearingDebt: toNumber(previousBalance.equityAndLiabilities?.bankLoans),
    bankLoans: toNumber(previousBalance.equityAndLiabilities?.bankLoans),
    otherLiabilities: toNumber(previousBalance.equityAndLiabilities?.otherLiabilities),
    overdraft: toNumber(previousBalance.equityAndLiabilities?.overdraft),
  }

  return {
    round: 0,
    previousRound: -1,
    assets: currentAssets,
    previousAssets,
    liabilities: currentLiabilities,
    previousLiabilities,
    gameRound: toNumber(gameState.round, 1),
  }
}
