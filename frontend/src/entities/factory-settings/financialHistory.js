import { DEFAULT_FACTORY_SETTINGS } from './defaultFactorySettings.js'
import { createInitialGameState } from './initialGameState.js'
import { calculateRoundForecast } from '../forecast/model.js'

const REQUIRED_INCOME_FIELDS = [
  'salesUnits',
  'revenue',
  'inventoryChange',
  'materials',
  'labor',
  'fixedCosts',
  'depreciation',
  'financingCosts',
  'result',
]

const REQUIRED_FINANCE_FIELDS = [
  'cash',
  'bankLoans',
  'equity',
  'otherLiabilities',
  'machineryBookValue',
  'buildingsBookValue',
  'finishedGoodsInventoryBookValue',
  'rawMaterialInventoryBookValue',
]

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
  const currentSales = current.salesUnits ?? current.sales
  const previousSales = previous.salesUnits ?? previous.sales

  return {
    sales: {
      label: 'Myynti',
      unit: 'kpl',
      amount: toNumber(currentSales),
      deltaPct: toPercentDelta(currentSales, previousSales),
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

function buildCanonicalEntry(round, incomeStatement, finance) {
  return {
    round,
    incomeStatement: { ...incomeStatement },
    finance: { ...finance },
  }
}

export function assertCanonicalFinancialHistoryEntry(entry) {
  const missingIncome = REQUIRED_INCOME_FIELDS.filter(
    (field) => !Number.isFinite(Number(entry?.incomeStatement?.[field])),
  )
  const missingFinance = REQUIRED_FINANCE_FIELDS.filter(
    (field) => !Number.isFinite(Number(entry?.finance?.[field])),
  )

  if (missingIncome.length > 0 || missingFinance.length > 0) {
    throw new Error(
      `Canonical financial history entry ${entry?.round ?? 'unknown'} is missing required fields: ${[
        ...missingIncome.map((field) => `incomeStatement.${field}`),
        ...missingFinance.map((field) => `finance.${field}`),
      ].join(', ')}`,
    )
  }

  return entry
}

export function normalizeFinancialHistoryEntry(entry, { strict = false } = {}) {
  if (strict) {
    assertCanonicalFinancialHistoryEntry(entry)
  }

  const income = entry?.incomeStatement ?? {}
  const finance = entry?.finance ?? {}
  const assets = entry?.assets ?? {}
  const liabilities = entry?.liabilities ?? {}
  const salesUnits =
    income.salesUnits ??
    entry?.production?.deliveries ??
    entry?.production?.actualProduction ??
    income.sales

  return buildCanonicalEntry(
    Number(entry?.round) || 0,
    {
      salesUnits: toNumber(salesUnits),
      revenue: toNumber(income.revenue),
      inventoryChange: toNumber(income.inventoryChange),
      materials: toNumber(income.materials),
      labor: toNumber(income.labor),
      fixedCosts: toNumber(income.fixedCosts),
      depreciation: toNumber(income.depreciation),
      financingCosts: toNumber(income.financingCosts ?? income.interest),
      result: toNumber(income.result),
    },
    {
      cash: toNumber(finance.cash ?? assets.cash),
      bankLoans: toNumber(finance.bankLoans ?? liabilities.bankLoans),
      equity: toNumber(finance.equity ?? liabilities.equity),
      otherLiabilities: toNumber(finance.otherLiabilities ?? liabilities.otherLiabilities),
      machineryBookValue: toNumber(finance.machineryBookValue ?? assets.machinery),
      buildingsBookValue: toNumber(finance.buildingsBookValue ?? assets.buildings),
      finishedGoodsInventoryBookValue: toNumber(
        finance.finishedGoodsInventoryBookValue ?? assets.finishedGoodsInventory,
      ),
      rawMaterialInventoryBookValue: toNumber(
        finance.rawMaterialInventoryBookValue ?? assets.rawMaterialInventory,
      ),
    },
  )
}

export function buildCanonicalFinancialHistory(
  gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS),
  factorySettings = DEFAULT_FACTORY_SETTINGS,
) {
  const settings = factorySettings ?? gameState?.factorySettings ?? DEFAULT_FACTORY_SETTINGS
  let historicalState = createInitialGameState(settings)
  const configuredProduction = Math.max(
    0,
    Math.round(Number(settings.production?.initialProductionQuantity) || 0),
  )
  const roundZeroProbe = calculateRoundForecast(
    historicalState,
    { market: { productionQuantity: configuredProduction } },
    settings,
  )
  const effectiveRoundZeroProduction = roundZeroProbe.forecast.actualProduction
  const productionByRound = new Map([
    [-2, Math.max(0, effectiveRoundZeroProduction - 10)],
    [-1, Math.max(0, effectiveRoundZeroProduction - 5)],
    [0, effectiveRoundZeroProduction],
  ])
  const entries = []

  for (const round of [-2, -1, 0]) {
    const state = structuredClone(historicalState)
    state.inventory.finishedGoodsContainers = toNumber(
      settings.initialState?.inventory?.finishedGoodsContainers,
    )
    const forecast = calculateRoundForecast(
      state,
      { market: { productionQuantity: productionByRound.get(round) } },
      settings,
    )
    const income = forecast.closingState.finance.incomeStatement
    const entry = buildCanonicalEntry(
      round,
      {
        salesUnits: forecast.forecast.deliveries,
        revenue: income.revenue,
        inventoryChange: income.inventoryChange,
        materials: income.materials,
        labor: income.labor,
        fixedCosts: income.fixedCosts,
        depreciation: income.depreciation,
        financingCosts: income.interest,
        result: income.result,
      },
      forecast.closingState.finance,
    )
    entries.push(assertCanonicalFinancialHistoryEntry(entry))
    historicalState = forecast.closingState
  }

  return entries
}

export function buildInitialIncomeHistory(
  gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS),
  factorySettings = DEFAULT_FACTORY_SETTINGS,
) {
  const entries = buildCanonicalFinancialHistory(gameState, factorySettings)
  const [previousEntry, currentEntry] = entries.slice(-2)
  const currentIncome = currentEntry.incomeStatement
  const previousIncome = previousEntry.incomeStatement

  return {
    entries,
    round: 0,
    previousRound: -1,
    rows: buildIncomeRows(currentIncome, previousIncome),
    previousRows: {
      sales: {
        label: 'Myynti',
        unit: 'kpl',
        amount: toNumber(previousIncome.salesUnits),
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
  const entries = buildCanonicalFinancialHistory(gameState, factorySettings)
  const [previousEntry, currentEntry] = entries.slice(-2)
  const currentAssets = {
    buildings: currentEntry.finance.buildingsBookValue,
    machinery: currentEntry.finance.machineryBookValue,
    finishedGoodsInventory: currentEntry.finance.finishedGoodsInventoryBookValue,
    rawMaterialInventory: currentEntry.finance.rawMaterialInventoryBookValue,
    cash: currentEntry.finance.cash,
  }

  const currentLiabilities = {
    equity: currentEntry.finance.equity,
    interestBearingDebt: currentEntry.finance.bankLoans,
    bankLoans: currentEntry.finance.bankLoans,
    otherLiabilities: currentEntry.finance.otherLiabilities,
    overdraft: 0,
  }

  const previousAssets = {
    buildings: previousEntry.finance.buildingsBookValue,
    machinery: previousEntry.finance.machineryBookValue,
    finishedGoodsInventory: previousEntry.finance.finishedGoodsInventoryBookValue,
    rawMaterialInventory: previousEntry.finance.rawMaterialInventoryBookValue,
    cash: previousEntry.finance.cash,
  }

  const previousLiabilities = {
    equity: previousEntry.finance.equity,
    interestBearingDebt: previousEntry.finance.bankLoans,
    bankLoans: previousEntry.finance.bankLoans,
    otherLiabilities: previousEntry.finance.otherLiabilities,
    overdraft: 0,
  }

  return {
    entries,
    round: 0,
    previousRound: -1,
    assets: currentAssets,
    previousAssets,
    liabilities: currentLiabilities,
    previousLiabilities,
    gameRound: toNumber(gameState.round, 1),
  }
}
