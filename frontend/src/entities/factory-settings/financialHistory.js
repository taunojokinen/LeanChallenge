import { DEFAULT_FACTORY_SETTINGS } from './defaultFactorySettings.js'
import { createInitialFactoryState } from './initialFactoryState.js'
import { calculateFinancingStructure } from './financingStructure.js'
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

function simulateFinancialHistory(initialState, settings, productionByRound) {
  let historicalState = structuredClone(initialState)
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
    entry.production = {
      actualProduction: forecast.forecast.actualProduction,
      deliveries: forecast.forecast.deliveries,
    }
    entry.inventory = { ...forecast.closingState.canonical.inventory }
    entries.push(assertCanonicalFinancialHistoryEntry(entry))
    historicalState = forecast.closingState
  }

  return entries
}

function getHistoricalProduction(initialState, settings) {
  const configuredProduction = Math.max(
    0,
    Math.round(Number(settings.production?.initialProductionQuantity) || 0),
  )
  const roundZeroProbe = calculateRoundForecast(
    initialState,
    { market: { productionQuantity: configuredProduction } },
    settings,
  )
  const effectiveRoundZeroProduction = roundZeroProbe.forecast.actualProduction
  return new Map([
    [-2, Math.max(0, effectiveRoundZeroProduction - 10)],
    [-1, Math.max(0, effectiveRoundZeroProduction - 5)],
    [0, effectiveRoundZeroProduction],
  ])
}

export function buildLegacyFinancialHistory(factorySettings) {
  const initialState = createInitialFactoryState(factorySettings, { historySeed: 0 })
  return simulateFinancialHistory(initialState, factorySettings, getHistoricalProduction(initialState, factorySettings))
}

export function buildCanonicalFinancialHistory(
  gameState,
  factorySettings = DEFAULT_FACTORY_SETTINGS,
) {
  if (gameState?.initialFinancialHistory) {
    const entries = gameState.initialFinancialHistory
    if (!Array.isArray(entries) || entries.length !== 3 ||
      entries.some((entry, index) => entry.round !== index - 2)) {
      throw new Error('Pelin tallennettu lähtöhistoria ei sisällä kierroksia −2, −1 ja 0.')
    }
    entries.forEach(assertCanonicalFinancialHistoryEntry)
    return structuredClone(entries)
  }
  const settings = factorySettings ?? gameState?.factorySettings ?? DEFAULT_FACTORY_SETTINGS
  const initialState = createInitialFactoryState(settings, { historySeed: 0 })
  const productionByRound = getHistoricalProduction(initialState, settings)
  const targetEquity = Number(initialState.finance.equity)
  if (!Number.isFinite(targetEquity)) {
    throw new Error('Kierroksen 0 tavoitepääoman tulee olla äärellinen luku.')
  }
  const generate = (equity) => {
    const state = structuredClone(initialState)
    const finance = state.finance
    const financing = calculateFinancingStructure({
      nonCashAssets: finance.machineryBookValue + finance.buildingsBookValue +
        finance.finishedGoodsInventoryBookValue + finance.rawMaterialInventoryBookValue,
      equity,
      rawMaterialCosts: finance.incomeStatement.materials,
      factorySettings: settings,
    })
    state.finance = {
      ...finance,
      equity,
      cash: financing.cash,
      bankLoans: financing.interestBearingDebt,
      otherLiabilities: financing.otherLiabilities,
      overdraft: 0,
    }
    return simulateFinancialHistory(state, settings, productionByRound)
  }
  let openingEquity = targetEquity
  let lower
  let upper
  // Each trial reruns the existing financing/forecast model, including the debt-free branch.
  for (let iteration = 0; iteration < 100; iteration += 1) {
    const entries = generate(openingEquity)
    const difference = entries.at(-1).finance.equity - targetEquity
    if (!Number.isFinite(difference)) {
      throw new Error('Historialaskennan oman pääoman ratkaisu ei ole äärellinen.')
    }
    if (Math.abs(difference) <= 1e-9) {
      return entries
    }
    if (difference < 0) {
      lower = openingEquity
    } else {
      upper = openingEquity
    }
    // Once both sides of the target are bracketed, bisection avoids slow oscillation
    // when the financing model has a steep response to opening equity.
    const corrected = openingEquity - difference
    openingEquity = lower != null && upper != null
      ? (lower + upper) / 2
      : corrected
  }
  throw new Error('Kierroksen 0 tavoitepääomaa ei saavutettu historialaskennassa.')
}

export function buildInitialIncomeHistory(
  gameState = createInitialFactoryState(DEFAULT_FACTORY_SETTINGS),
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
  gameState = createInitialFactoryState(DEFAULT_FACTORY_SETTINGS),
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
