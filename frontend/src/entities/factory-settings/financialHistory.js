import { DEFAULT_FACTORY_SETTINGS } from './defaultFactorySettings.js'
import { createInitialGameState } from './initialGameState.js'

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

export function buildInitialIncomeHistory(
  gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS),
  factorySettings = DEFAULT_FACTORY_SETTINGS,
) {
  const initialFinance = factorySettings.initialState?.finance || {}
  const currentIncome = initialFinance.incomeStatement || {}
  const previousIncome = initialFinance.history?.previousRoundIncomeStatement || {}

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
  const initialFinance = gameState.finance || {}
  const previousBalance =
    factorySettings.initialState?.finance?.history?.previousRoundBalanceSheet || {}

  const currentAssets = {
    buildings: toNumber(initialFinance.buildingsBookValue),
    machinery: toNumber(initialFinance.machineryBookValue),
    finishedGoodsInventory: toNumber(initialFinance.finishedGoodsInventoryBookValue),
    rawMaterialInventory: toNumber(initialFinance.rawMaterialInventoryBookValue),
    cash: toNumber(initialFinance.cash),
  }

  const currentLiabilities = {
    equity: toNumber(initialFinance.equity),
    interestBearingDebt: toNumber(initialFinance.bankLoans),
    bankLoans: toNumber(initialFinance.bankLoans),
    otherLiabilities: toNumber(initialFinance.otherLiabilities),
    overdraft: toNumber(initialFinance.overdraft),
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
