import { useEffect, useMemo, useState } from 'react'
import { buildBalanceSheetViewModel } from '../../entities/balance-sheet/model.js'
import { getBalanceSheetSnapshot } from '../../shared/api/balanceSheetApi.js'
import './PlanBalanceSheetPage.css'

function renderRows(rows, round, previousRound) {
  return (
    <div className="plan-balance-sheet-table" role="table">
      <div className="plan-balance-sheet-row is-header" role="row">
        <span role="columnheader">Erä</span>
        <span role="columnheader">Kierros {round}</span>
        <span role="columnheader">Kierros {previousRound}</span>
      </div>

      {rows.map((row) => (
        <div
          className={`plan-balance-sheet-row ${row.kind === 'total' ? 'is-total' : ''}`}
          key={row.key}
          role="row"
        >
          <span role="cell">{row.label}</span>
          <span className="plan-balance-sheet-value" role="cell">
            {row.currentValue}
          </span>
          <span className="plan-balance-sheet-value is-previous" role="cell">
            {row.previousValue}
          </span>
        </div>
      ))}
    </div>
  )
}

function PlanBalanceSheetPage({ inventoryTurnover }) {
  const [snapshot, setSnapshot] = useState(null)

  useEffect(() => {
    let isMounted = true

    const loadSnapshot = async () => {
      const data = await getBalanceSheetSnapshot()

      if (isMounted) {
        setSnapshot(data)
      }
    }

    loadSnapshot()

    return () => {
      isMounted = false
    }
  }, [])

  const viewModel = useMemo(() => {
    if (!snapshot || inventoryTurnover == null) {
      return null
    }

    return buildBalanceSheetViewModel(snapshot, Number(inventoryTurnover))
  }, [snapshot, inventoryTurnover])

  if (!viewModel) {
    return (
      <section className="plan-balance-sheet-page" aria-label="Tase latautuu">
        <h1>TASE</h1>
        <p>Ladataan kierroksen tasetta...</p>
      </section>
    )
  }

  return (
    <section className="plan-balance-sheet-page" aria-label="Tase">
      <header className="plan-balance-sheet-header">
        <h1>TASE</h1>
        <p>Kierroksen {viewModel.round} tase</p>
      </header>

      <div className="plan-balance-sheet-grid">
        <section aria-label="Vastaavaa">
          <h2>VASTAAVAA</h2>
          {renderRows(viewModel.assetsRows, viewModel.round, viewModel.previousRound)}
        </section>

        <section aria-label="Vastattavaa">
          <h2>VASTATTAVAA</h2>
          {renderRows(viewModel.liabilitiesRows, viewModel.round, viewModel.previousRound)}
        </section>
      </div>

      <div className="plan-balance-sheet-summary" aria-label="Lean yhteenveto">
        <p>
          <strong>Varaston arvo:</strong> {viewModel.summary.inventoryValue}
        </p>
        <p>
          <strong>Varaston kiertonopeus:</strong> {viewModel.summary.inventoryTurnover}
        </p>
        <p>
          <strong>Omavaraisuusaste:</strong> {viewModel.summary.solvencyRatio}
        </p>
      </div>
    </section>
  )
}

export default PlanBalanceSheetPage