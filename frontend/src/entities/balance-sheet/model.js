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

function calculateAssetTotal(assets) {
  return assets.machinery + assets.buildings + assets.cash + assets.inventory
}

export function buildBalanceSheetViewModel(snapshot, inventoryTurnover) {
  const assetsTotal = calculateAssetTotal(snapshot.assets)
  const previousAssetsTotal = calculateAssetTotal(snapshot.previousAssets)

  const equity = assetsTotal - snapshot.liabilities.bankLoans
  const previousEquity = previousAssetsTotal - snapshot.previousLiabilities.bankLoans

  const liabilitiesTotal = equity + snapshot.liabilities.bankLoans
  const previousLiabilitiesTotal = previousEquity + snapshot.previousLiabilities.bankLoans

  const solvencyRatio = (equity / assetsTotal) * 100

  return {
    round: snapshot.round,
    previousRound: snapshot.previousRound,
    assetsRows: [
      {
        key: 'machinery',
        label: 'Koneet ja kalusto',
        currentValue: formatCurrency(snapshot.assets.machinery),
        previousValue: formatCurrency(snapshot.previousAssets.machinery),
      },
      {
        key: 'buildings',
        label: 'Rakennukset',
        currentValue: formatCurrency(snapshot.assets.buildings),
        previousValue: formatCurrency(snapshot.previousAssets.buildings),
      },
      {
        key: 'cash',
        label: 'Rahat',
        currentValue: formatCurrency(snapshot.assets.cash),
        previousValue: formatCurrency(snapshot.previousAssets.cash),
      },
      {
        key: 'inventory',
        label: 'Vaihto-omaisuus',
        currentValue: formatCurrency(snapshot.assets.inventory),
        previousValue: formatCurrency(snapshot.previousAssets.inventory),
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
        label: 'Pankkilainat',
        currentValue: formatCurrency(snapshot.liabilities.bankLoans),
        previousValue: formatCurrency(snapshot.previousLiabilities.bankLoans),
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
      inventoryValue: formatCurrency(snapshot.assets.inventory),
      inventoryTurnover: formatTurnover(inventoryTurnover),
      solvencyRatio: `${DECIMAL_FORMATTER.format(solvencyRatio)} %`,
      assetsTotal,
      liabilitiesTotal,
    },
  }
}
