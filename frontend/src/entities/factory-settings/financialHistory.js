import { DEFAULT_FACTORY_SETTINGS } from './defaultFactorySettings.js'
import { createInitialGameState } from './initialGameState.js'
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

// Historical pre-game rounds (-2/-1/0) intentionally keep the pre-batchSize-decision FG averaging
// (production runs derived from variations, not the canonical player batchSize) so the calibrated
// round-0 opening FG anchor is not retroactively rewritten by the ACT batchSize decision mechanic.
function calculateLegacyAverageFinishedGoodsInventory(forecastForecast) {
  const totalVariations = Math.max(1, toNumber(forecastForecast.market?.totalVariations, 1))
  const runsPerVariation = Math.max(1, toNumber(forecastForecast.market?.runsPerVariation, 2))
  const productionRuns = totalVariations * runsPerVariation
  const batches = Math.max(1, productionRuns)
  const legacyBatchSize = toNumber(forecastForecast.actualProduction) / batches
  return (totalVariations * legacyBatchSize) / 2
}

function buildAnchoredOpeningState(openingState, roundZeroFinance, roundOneHistoryForecast, settings) {
  const machineryRate = Number(settings.finance.machineryDepreciationPerRound)
  const buildingsRate = Number(settings.finance.buildingDepreciationPerRound)
  const openingMachinery = roundZeroFinance.machineryBookValue / (1 - machineryRate)
  const openingBuildings = roundZeroFinance.buildingsBookValue / (1 - buildingsRate)
  const openingEquity = roundZeroFinance.equity - roundOneHistoryForecast.forecast.finance.result

  return {
    ...structuredClone(openingState),
    finance: {
      ...openingState.finance,
      cash: roundZeroFinance.cash,
      bankLoans: roundZeroFinance.bankLoans,
      equity: openingEquity,
      machineryBookValue: openingMachinery,
      buildingsBookValue: openingBuildings,
    },
  }
}

function buildAnchoredFinance(roundZeroFinance, forecast, isRoundZero, finishedGoodsValueOverride) {
  const finishedGoodsValue = finishedGoodsValueOverride ?? forecast.inventory.finishedGoodsValue

  if (isRoundZero) {
    return {
      cash: roundZeroFinance.cash,
      bankLoans: roundZeroFinance.bankLoans,
      equity: roundZeroFinance.equity,
      otherLiabilities: roundZeroFinance.otherLiabilities,
      machineryBookValue: roundZeroFinance.machineryBookValue,
      buildingsBookValue: roundZeroFinance.buildingsBookValue,
      finishedGoodsInventoryBookValue: finishedGoodsValue,
      rawMaterialInventoryBookValue: Math.round(Math.abs(forecast.finance.materials) * 0.4),
    }
  }

  return {
    cash: roundZeroFinance.cash,
    bankLoans: roundZeroFinance.bankLoans,
    equity: roundZeroFinance.equity,
    otherLiabilities: Math.round(Math.abs(forecast.finance.materials) * 0.5),
    machineryBookValue: roundZeroFinance.machineryBookValue,
    buildingsBookValue: roundZeroFinance.buildingsBookValue,
    finishedGoodsInventoryBookValue: finishedGoodsValue,
    rawMaterialInventoryBookValue: Math.round(Math.abs(forecast.finance.materials) * 0.4),
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

export function buildRoundZeroCanonicalFinance(factorySettings) {
  const initialState = createInitialGameState(factorySettings)
  const initialFinance = initialState.finance || {}
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

export function buildCanonicalFinancialHistory(
  gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS),
  factorySettings = DEFAULT_FACTORY_SETTINGS,
) {
  const settings = factorySettings ?? gameState?.factorySettings ?? DEFAULT_FACTORY_SETTINGS
  const openingState = createInitialGameState(settings)
  const configuredProduction = Math.max(
    0,
    Math.round(Number(settings.production?.initialProductionQuantity) || 0),
  )
  const roundZeroProbe = calculateRoundForecast(
    openingState,
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
  let openingFinishedGoodsContainers = openingState.inventory.finishedGoodsContainers
  const roundZeroFinance = {
    cash: openingState.finance.cash,
    bankLoans: openingState.finance.bankLoans,
    equity: openingState.finance.equity,
    otherLiabilities: openingState.finance.otherLiabilities,
    machineryBookValue: openingState.finance.machineryBookValue,
    buildingsBookValue: openingState.finance.buildingsBookValue,
  }
  let anchoredState = openingState

  for (const round of [-2, -1, 0]) {
    const state = structuredClone(anchoredState)
    state.inventory.finishedGoodsContainers = openingFinishedGoodsContainers
    const forecast = calculateRoundForecast(
      state,
      { market: { productionQuantity: productionByRound.get(round) } },
      settings,
    )
    const income = forecast.closingState.finance.incomeStatement
    const legacyAverageFinishedGoodsInventory = calculateLegacyAverageFinishedGoodsInventory(
      forecast.forecast,
    )
    const finishedGoodsValuePerContainer = toNumber(
      settings.inventory?.finishedGoodsValuePerContainer,
      20000,
    )
    const legacyFinishedGoodsValue = legacyAverageFinishedGoodsInventory * finishedGoodsValuePerContainer
    const legacyInventoryChange =
      (legacyAverageFinishedGoodsInventory - toNumber(forecast.forecast.inventory.baseFinishedGoodsContainers)) *
      finishedGoodsValuePerContainer
    const legacyResult =
      toNumber(income.revenue) +
      legacyInventoryChange -
      toNumber(income.materials) -
      toNumber(income.labor) -
      toNumber(income.fixedCosts) -
      toNumber(income.depreciation) -
      toNumber(income.interest)
    const entry = buildCanonicalEntry(
      round,
      {
        salesUnits: forecast.forecast.actualProduction,
        revenue: income.revenue,
        inventoryChange: legacyInventoryChange,
        materials: income.materials,
        labor: income.labor,
        fixedCosts: income.fixedCosts,
        depreciation: income.depreciation,
        financingCosts: income.interest,
        result: legacyResult,
      },
      buildAnchoredFinance(roundZeroFinance, forecast.forecast, round === 0, legacyFinishedGoodsValue),
    )
    entries.push(assertCanonicalFinancialHistoryEntry(entry))
    openingFinishedGoodsContainers = legacyAverageFinishedGoodsInventory

    if (round === -2) {
      const roundMinusOneState = structuredClone(openingState)
      roundMinusOneState.inventory.finishedGoodsContainers = openingFinishedGoodsContainers
      const roundMinusOneProbe = calculateRoundForecast(
        roundMinusOneState,
        { market: { productionQuantity: productionByRound.get(-1) } },
        settings,
      )
      anchoredState = buildAnchoredOpeningState(
        roundMinusOneState,
        roundZeroFinance,
        roundMinusOneProbe,
        settings,
      )
    } else if (round === -1) {
      anchoredState = structuredClone(openingState)
      anchoredState.inventory.finishedGoodsContainers = openingFinishedGoodsContainers
    }
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
