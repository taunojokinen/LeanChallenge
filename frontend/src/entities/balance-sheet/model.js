const EURO_FORMATTER = new Intl.NumberFormat('fi-FI', {
  maximumFractionDigits: 0,
})

const DECIMAL_FORMATTER = new Intl.NumberFormat('fi-FI', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

function formatCurrency(amount) {
  return `${EURO_FORMATTER.format(amount)} €`
}

function formatTurnover(value) {
  return `${DECIMAL_FORMATTER.format(value)}x`
}

function resolveDebt(liabilities = {}) {
  if (liabilities.bankLoans != null) {
    return Number(liabilities.bankLoans) || 0
  }

  return Number(liabilities.interestBearingDebt) || 0
}

function calculateAssetTotal(assets) {
  const inventory =
    Number(assets.inventory) ||
    (Number(assets.finishedGoodsInventory) || 0) + (Number(assets.rawMaterialInventory) || 0)

  return (
    (Number(assets.machinery) || 0) +
    (Number(assets.buildings) || 0) +
    (Number(assets.cash) || 0) +
    inventory
  )
}

export function buildBalanceSheetViewModel(snapshot, inventoryTurnover) {
  const assetsTotal = calculateAssetTotal(snapshot.assets)
  const previousAssetsTotal = calculateAssetTotal(snapshot.previousAssets)

  const currentInventory =
    Number(snapshot.assets.inventory) ||
    (Number(snapshot.assets.finishedGoodsInventory) || 0) +
      (Number(snapshot.assets.rawMaterialInventory) || 0)
  const previousInventory =
    Number(snapshot.previousAssets.inventory) ||
    (Number(snapshot.previousAssets.finishedGoodsInventory) || 0) +
      (Number(snapshot.previousAssets.rawMaterialInventory) || 0)

  const currentDebt = resolveDebt(snapshot.liabilities)
  const previousDebt = resolveDebt(snapshot.previousLiabilities)

  const equity =
    snapshot.liabilities.equity == null
      ? assetsTotal - currentDebt
      : Number(snapshot.liabilities.equity)
  const previousEquity =
    snapshot.previousLiabilities.equity == null
      ? previousAssetsTotal - previousDebt
      : Number(snapshot.previousLiabilities.equity)

  const currentOtherLiabilities = Number(snapshot.liabilities.otherLiabilities) || 0
  const previousOtherLiabilities = Number(snapshot.previousLiabilities.otherLiabilities) || 0
  const currentOverdraft = Number(snapshot.liabilities.overdraft) || 0
  const previousOverdraft = Number(snapshot.previousLiabilities.overdraft) || 0

  const liabilitiesTotal = equity + currentDebt + currentOtherLiabilities + currentOverdraft
  const previousLiabilitiesTotal =
    previousEquity + previousDebt + previousOtherLiabilities + previousOverdraft

  const solvencyRatio = (equity / assetsTotal) * 100

  return {
    round: snapshot.round,
    previousRound: snapshot.previousRound,
    assetsRows: [
      {
        key: 'machinery',
        label: 'Koneet ja kalusto',
        currentValue: formatCurrency(Number(snapshot.assets.machinery) || 0),
        previousValue: formatCurrency(Number(snapshot.previousAssets.machinery) || 0),
      },
      {
        key: 'buildings',
        label: 'Rakennukset',
        currentValue: formatCurrency(Number(snapshot.assets.buildings) || 0),
        previousValue: formatCurrency(Number(snapshot.previousAssets.buildings) || 0),
      },
      {
        key: 'finishedGoodsInventory',
        label: 'Valmistuotevarasto',
        currentValue: formatCurrency(Number(snapshot.assets.finishedGoodsInventory) || 0),
        previousValue: formatCurrency(Number(snapshot.previousAssets.finishedGoodsInventory) || 0),
      },
      {
        key: 'rawMaterialInventory',
        label: 'Raaka-ainevarasto',
        currentValue: formatCurrency(Number(snapshot.assets.rawMaterialInventory) || 0),
        previousValue: formatCurrency(Number(snapshot.previousAssets.rawMaterialInventory) || 0),
      },
      {
        key: 'cash',
        label: 'Rahat ja pankkisaamiset',
        currentValue: formatCurrency(Number(snapshot.assets.cash) || 0),
        previousValue: formatCurrency(Number(snapshot.previousAssets.cash) || 0),
      },
      {
        key: 'inventory',
        label: 'Vaihto-omaisuus',
        currentValue: formatCurrency(currentInventory),
        previousValue: formatCurrency(previousInventory),
      },
      {
        key: 'assetsTotal',
        label: 'Vastaavaa yhteensä',
        currentValue: formatCurrency(assetsTotal),
        previousValue: formatCurrency(previousAssetsTotal),
        kind: 'total',
      },
    ],
    liabilitiesRows: [
      {
        key: 'equity',
        label: 'Oma pääoma',
        currentValue: formatCurrency(equity),
        previousValue: formatCurrency(previousEquity),
      },
      {
        key: 'bankLoans',
        label: 'Korollinen velka',
        currentValue: formatCurrency(currentDebt),
        previousValue: formatCurrency(previousDebt),
      },
      {
        key: 'otherLiabilities',
        label: 'Muu vieras pääoma / ostovelat',
        currentValue: formatCurrency(currentOtherLiabilities),
        previousValue: formatCurrency(previousOtherLiabilities),
      },
      {
        key: 'liabilitiesTotal',
        label: 'Vastattavaa yhteensä',
        currentValue: formatCurrency(liabilitiesTotal),
        previousValue: formatCurrency(previousLiabilitiesTotal),
        kind: 'total',
      },
    ],
    summary: {
      inventoryValue: formatCurrency(currentInventory),
      inventoryTurnover: formatTurnover(inventoryTurnover),
      solvencyRatio: `${DECIMAL_FORMATTER.format(solvencyRatio)} %`,
      assetsTotal,
      liabilitiesTotal,
    },
  }
}
