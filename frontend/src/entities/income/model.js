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

  const revenue = rows.revenue.amount
  const inventoryChange = rows.inventoryChange.amount
  const materials = rows.materials.amount
  const labor = rows.labor.amount
  const fixedCosts = rows.fixedCosts.amount
  const depreciation = rows.depreciation.amount
  const financingCosts = rows.financingCosts.amount

  const grossMarginAmount = revenue + inventoryChange - materials - labor
  const resultAmount = grossMarginAmount - fixedCosts - depreciation - financingCosts

  const previousRevenue = derivePreviousAmount(revenue, rows.revenue.deltaPct)
  const previousInventoryChange = derivePreviousAmount(inventoryChange, rows.inventoryChange.deltaPct)
  const previousMaterials = derivePreviousAmount(materials, rows.materials.deltaPct)
  const previousLabor = derivePreviousAmount(labor, rows.labor.deltaPct)
  const previousFixedCosts = derivePreviousAmount(fixedCosts, rows.fixedCosts.deltaPct)
  const previousDepreciation = derivePreviousAmount(depreciation, rows.depreciation.deltaPct)
  const previousFinancingCosts = derivePreviousAmount(financingCosts, rows.financingCosts.deltaPct)

  const previousGrossMargin = previousRevenue + previousInventoryChange - previousMaterials - previousLabor
  const previousResult =
    previousGrossMargin - previousFixedCosts - previousDepreciation - previousFinancingCosts

  const grossMarginDeltaPct = Number(
    (((grossMarginAmount - previousGrossMargin) / previousGrossMargin) * 100).toFixed(1),
  )
  const resultDeltaPct = Number((((resultAmount - previousResult) / previousResult) * 100).toFixed(1))

  return [
    {
      key: 'sales',
      label: rows.sales.label,
      amountText: formatAmount(rows.sales.amount, rows.sales.unit),
      deltaText: formatDelta(rows.sales.deltaPct),
      impact: getImpactClass('revenue', rows.sales.deltaPct),
      kind: 'normal',
    },
    {
      key: 'revenue',
      label: rows.revenue.label,
      amountText: formatAmount(rows.revenue.amount, rows.revenue.unit),
      deltaText: formatDelta(rows.revenue.deltaPct),
      impact: getImpactClass('revenue', rows.revenue.deltaPct),
      kind: 'normal',
    },
    {
      key: 'inventoryChange',
      label: rows.inventoryChange.label,
      amountText: formatAmount(rows.inventoryChange.amount, rows.inventoryChange.unit),
      deltaText: formatDelta(rows.inventoryChange.deltaPct),
      impact: getImpactClass('revenue', rows.inventoryChange.deltaPct),
      kind: 'normal',
    },
    {
      key: 'materials',
      label: rows.materials.label,
      amountText: formatAmount(-rows.materials.amount, rows.materials.unit),
      deltaText: formatDelta(rows.materials.deltaPct),
      impact: getImpactClass('cost', rows.materials.deltaPct),
      kind: 'normal',
    },
    {
      key: 'labor',
      label: rows.labor.label,
      amountText: formatAmount(-rows.labor.amount, rows.labor.unit),
      deltaText: formatDelta(rows.labor.deltaPct),
      impact: getImpactClass('cost', rows.labor.deltaPct),
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
      deltaText: formatDelta(rows.fixedCosts.deltaPct),
      impact: getImpactClass('cost', rows.fixedCosts.deltaPct),
      kind: 'normal',
    },
    {
      key: 'depreciation',
      label: rows.depreciation.label,
      amountText: formatAmount(-rows.depreciation.amount, rows.depreciation.unit),
      deltaText: formatDelta(rows.depreciation.deltaPct),
      impact: getImpactClass('cost', rows.depreciation.deltaPct),
      kind: 'normal',
    },
    {
      key: 'financingCosts',
      label: rows.financingCosts.label,
      amountText: formatAmount(-rows.financingCosts.amount, rows.financingCosts.unit),
      deltaText: formatDelta(rows.financingCosts.deltaPct),
      impact: getImpactClass('cost', rows.financingCosts.deltaPct),
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
