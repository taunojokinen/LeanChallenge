const EURO_FORMATTER = new Intl.NumberFormat('fi-FI', {
  maximumFractionDigits: 0,
})

const INTEGER_FORMATTER = new Intl.NumberFormat('fi-FI', {
  maximumFractionDigits: 0,
})

function derivePreviousAmount(currentAmount, deltaPct) {
  const ratio = 1 + deltaPct / 100

  if (ratio === 0) {
    return currentAmount
  }

  return currentAmount / ratio
}

function deriveDeltaPctFromAmounts(currentAmount, previousAmount) {
  const previous = Number(previousAmount)
  const current = Number(currentAmount)

  if (!Number.isFinite(previous) || previous === 0 || !Number.isFinite(current)) {
    return 0
  }

  return Number((((current - previous) / previous) * 100).toFixed(1))
}

function formatDelta(deltaPct) {
  if (deltaPct === 0) {
    return '0 %'
  }

  const sign = deltaPct > 0 ? '+' : ''
  return `${sign}${deltaPct} %`
}

function formatAmount(amount, unit) {
  if (unit === 'kpl') {
    return `${INTEGER_FORMATTER.format(amount)} kpl`
  }

  const sign = amount < 0 ? '-' : ''
  return `${sign}${EURO_FORMATTER.format(Math.abs(amount))} €`
}

function getDeltaDirection(deltaPct) {
  if (deltaPct > 0) {
    return 'up'
  }

  if (deltaPct < 0) {
    return 'down'
  }

  return 'flat'
}

function getImpactClass(kind, deltaPct) {
  const direction = getDeltaDirection(deltaPct)

  if (direction === 'flat') {
    return 'neutral'
  }

  if (kind === 'revenue') {
    return direction === 'up' ? 'positive' : 'negative'
  }

  return direction === 'down' ? 'positive' : 'negative'
}

function buildComparisonRow({
  key,
  label,
  unit,
  currentAmount,
  previousAmount,
  deltaPct,
  impactKind,
  kind = 'normal',
  isNegative = false,
}) {
  const previousAmountText = formatAmount(previousAmount, unit)
  const currentAmountText = formatAmount(currentAmount, unit)

  return {
    key,
    label,
    previousAmount,
    previousAmountText,
    currentAmount,
    currentAmountText,
    amountText: currentAmountText,
    deltaText: formatDelta(deltaPct),
    impact: getImpactClass(impactKind, deltaPct),
    kind,
    isNegative,
  }
}

export function buildIncomeStatementRows(snapshot) {
  const rows = snapshot.rows
  const previousRows = snapshot.previousRows || null

  const revenue = rows.revenue.amount
  const inventoryChange = rows.inventoryChange.amount
  const materials = rows.materials.amount
  const labor = rows.labor.amount
  const fixedCosts = rows.fixedCosts.amount
  const depreciation = rows.depreciation.amount
  const financingCosts = rows.financingCosts.amount

  const grossMarginAmount = revenue + inventoryChange - materials - labor
  const resultAmount = grossMarginAmount - fixedCosts - depreciation - financingCosts

  const previousRevenue = previousRows
    ? Number(previousRows.revenue?.amount) || 0
    : derivePreviousAmount(revenue, rows.revenue.deltaPct)
  const previousInventoryChange = previousRows
    ? Number(previousRows.inventoryChange?.amount) || 0
    : derivePreviousAmount(inventoryChange, rows.inventoryChange.deltaPct)
  const previousMaterials = previousRows
    ? Number(previousRows.materials?.amount) || 0
    : derivePreviousAmount(materials, rows.materials.deltaPct)
  const previousLabor = previousRows
    ? Number(previousRows.labor?.amount) || 0
    : derivePreviousAmount(labor, rows.labor.deltaPct)
  const previousFixedCosts = previousRows
    ? Number(previousRows.fixedCosts?.amount) || 0
    : derivePreviousAmount(fixedCosts, rows.fixedCosts.deltaPct)
  const previousDepreciation = previousRows
    ? Number(previousRows.depreciation?.amount) || 0
    : derivePreviousAmount(depreciation, rows.depreciation.deltaPct)
  const previousFinancingCosts = previousRows
    ? Number(previousRows.financingCosts?.amount) || 0
    : derivePreviousAmount(financingCosts, rows.financingCosts.deltaPct)

  const previousGrossMargin = previousRevenue + previousInventoryChange - previousMaterials - previousLabor
  const previousResult =
    previousGrossMargin - previousFixedCosts - previousDepreciation - previousFinancingCosts

  const grossMarginDeltaPct = deriveDeltaPctFromAmounts(grossMarginAmount, previousGrossMargin)
  const resultDeltaPct = deriveDeltaPctFromAmounts(resultAmount, previousResult)

  const salesDeltaPct = previousRows
    ? deriveDeltaPctFromAmounts(rows.sales.amount, previousRows.sales?.amount)
    : rows.sales.deltaPct
  const revenueDeltaPct = previousRows
    ? deriveDeltaPctFromAmounts(rows.revenue.amount, previousRows.revenue?.amount)
    : rows.revenue.deltaPct
  const inventoryChangeDeltaPct = previousRows
    ? deriveDeltaPctFromAmounts(rows.inventoryChange.amount, previousRows.inventoryChange?.amount)
    : rows.inventoryChange.deltaPct
  const materialsDeltaPct = previousRows
    ? deriveDeltaPctFromAmounts(rows.materials.amount, previousRows.materials?.amount)
    : rows.materials.deltaPct
  const laborDeltaPct = previousRows
    ? deriveDeltaPctFromAmounts(rows.labor.amount, previousRows.labor?.amount)
    : rows.labor.deltaPct
  const fixedCostsDeltaPct = previousRows
    ? deriveDeltaPctFromAmounts(rows.fixedCosts.amount, previousRows.fixedCosts?.amount)
    : rows.fixedCosts.deltaPct
  const depreciationDeltaPct = previousRows
    ? deriveDeltaPctFromAmounts(rows.depreciation.amount, previousRows.depreciation?.amount)
    : rows.depreciation.deltaPct
  const financingCostsDeltaPct = previousRows
    ? deriveDeltaPctFromAmounts(rows.financingCosts.amount, previousRows.financingCosts?.amount)
    : rows.financingCosts.deltaPct

  return [
    buildComparisonRow({
      key: 'sales',
      label: rows.sales.label,
      unit: rows.sales.unit,
      currentAmount: rows.sales.amount,
      previousAmount: previousRows
        ? Number(previousRows.sales?.amount) || 0
        : derivePreviousAmount(rows.sales.amount, rows.sales.deltaPct),
      deltaPct: salesDeltaPct,
      impactKind: 'revenue',
    }),
    buildComparisonRow({
      key: 'revenue',
      label: rows.revenue.label,
      unit: rows.revenue.unit,
      currentAmount: rows.revenue.amount,
      previousAmount: previousRevenue,
      deltaPct: revenueDeltaPct,
      impactKind: 'revenue',
    }),
    buildComparisonRow({
      key: 'inventoryChange',
      label: rows.inventoryChange.label,
      unit: rows.inventoryChange.unit,
      currentAmount: rows.inventoryChange.amount,
      previousAmount: previousInventoryChange,
      deltaPct: inventoryChangeDeltaPct,
      impactKind: 'revenue',
    }),
    buildComparisonRow({
      key: 'materials',
      label: rows.materials.label,
      unit: rows.materials.unit,
      currentAmount: -rows.materials.amount,
      previousAmount: -previousMaterials,
      deltaPct: materialsDeltaPct,
      impactKind: 'cost',
    }),
    buildComparisonRow({
      key: 'labor',
      label: rows.labor.label,
      unit: rows.labor.unit,
      currentAmount: -rows.labor.amount,
      previousAmount: -previousLabor,
      deltaPct: laborDeltaPct,
      impactKind: 'cost',
    }),
    buildComparisonRow({
      key: 'grossMargin',
      label: 'MYYNTIKATE',
      unit: 'EUR',
      currentAmount: grossMarginAmount,
      previousAmount: previousGrossMargin,
      deltaPct: grossMarginDeltaPct,
      impactKind: 'revenue',
      kind: 'subtotal',
    }),
    buildComparisonRow({
      key: 'fixedCosts',
      label: rows.fixedCosts.label,
      unit: rows.fixedCosts.unit,
      currentAmount: -rows.fixedCosts.amount,
      previousAmount: -previousFixedCosts,
      deltaPct: fixedCostsDeltaPct,
      impactKind: 'cost',
    }),
    buildComparisonRow({
      key: 'depreciation',
      label: rows.depreciation.label,
      unit: rows.depreciation.unit,
      currentAmount: -rows.depreciation.amount,
      previousAmount: -previousDepreciation,
      deltaPct: depreciationDeltaPct,
      impactKind: 'cost',
    }),
    buildComparisonRow({
      key: 'financingCosts',
      label: rows.financingCosts.label,
      unit: rows.financingCosts.unit,
      currentAmount: -rows.financingCosts.amount,
      previousAmount: -previousFinancingCosts,
      deltaPct: financingCostsDeltaPct,
      impactKind: 'cost',
    }),
    buildComparisonRow({
      key: 'result',
      label: 'TULOS',
      unit: 'EUR',
      currentAmount: resultAmount,
      previousAmount: previousResult,
      deltaPct: resultDeltaPct,
      impactKind: 'revenue',
      kind: 'total',
      isNegative: resultAmount < 0,
    }),
  ]
}
