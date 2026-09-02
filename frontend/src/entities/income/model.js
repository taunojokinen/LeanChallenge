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
    {
      key: 'sales',
      label: rows.sales.label,
      amountText: formatAmount(rows.sales.amount, rows.sales.unit),
      deltaText: formatDelta(salesDeltaPct),
      impact: getImpactClass('revenue', salesDeltaPct),
      kind: 'normal',
    },
    {
      key: 'revenue',
      label: rows.revenue.label,
      amountText: formatAmount(rows.revenue.amount, rows.revenue.unit),
      deltaText: formatDelta(revenueDeltaPct),
      impact: getImpactClass('revenue', revenueDeltaPct),
      kind: 'normal',
    },
    {
      key: 'inventoryChange',
      label: rows.inventoryChange.label,
      amountText: formatAmount(rows.inventoryChange.amount, rows.inventoryChange.unit),
      deltaText: formatDelta(inventoryChangeDeltaPct),
      impact: getImpactClass('revenue', inventoryChangeDeltaPct),
      kind: 'normal',
    },
    {
      key: 'materials',
      label: rows.materials.label,
      amountText: formatAmount(-rows.materials.amount, rows.materials.unit),
      deltaText: formatDelta(materialsDeltaPct),
      impact: getImpactClass('cost', materialsDeltaPct),
      kind: 'normal',
    },
    {
      key: 'labor',
      label: rows.labor.label,
      amountText: formatAmount(-rows.labor.amount, rows.labor.unit),
      deltaText: formatDelta(laborDeltaPct),
      impact: getImpactClass('cost', laborDeltaPct),
      kind: 'normal',
    },
    {
      key: 'grossMargin',
      label: 'MYYNTIKATE',
      amountText: formatAmount(grossMarginAmount, 'EUR'),
      deltaText: formatDelta(grossMarginDeltaPct),
      impact: getImpactClass('revenue', grossMarginDeltaPct),
      kind: 'subtotal',
    },
    {
      key: 'fixedCosts',
      label: rows.fixedCosts.label,
      amountText: formatAmount(-rows.fixedCosts.amount, rows.fixedCosts.unit),
      deltaText: formatDelta(fixedCostsDeltaPct),
      impact: getImpactClass('cost', fixedCostsDeltaPct),
      kind: 'normal',
    },
    {
      key: 'depreciation',
      label: rows.depreciation.label,
      amountText: formatAmount(-rows.depreciation.amount, rows.depreciation.unit),
      deltaText: formatDelta(depreciationDeltaPct),
      impact: getImpactClass('cost', depreciationDeltaPct),
      kind: 'normal',
    },
    {
      key: 'financingCosts',
      label: rows.financingCosts.label,
      amountText: formatAmount(-rows.financingCosts.amount, rows.financingCosts.unit),
      deltaText: formatDelta(financingCostsDeltaPct),
      impact: getImpactClass('cost', financingCostsDeltaPct),
      kind: 'normal',
    },
    {
      key: 'result',
      label: 'TULOS',
      amountText: formatAmount(resultAmount, 'EUR'),
      deltaText: formatDelta(resultDeltaPct),
      impact: getImpactClass('revenue', resultDeltaPct),
      kind: 'total',
      isNegative: resultAmount < 0,
    },
  ]
}
