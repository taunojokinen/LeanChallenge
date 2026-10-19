import { useEffect, useMemo, useState } from 'react'
import { buildBalanceSheetHistoryView, buildBalanceSheetViewModel } from '../../entities/balance-sheet/model.js'
import { getInitialBalanceSheetHistory } from '../../shared/api/balanceSheetApi.js'
import { DEFAULT_FACTORY_SETTINGS } from '../../entities/factory-settings/defaultFactorySettings.js'
import { buildBalanceInterpretation } from '../../entities/balance-sheet/interpretation.js'
import BalanceInterpretation from './BalanceInterpretation.jsx'
import './PlanBalanceSheetPage.css'

function renderRows(rows, round, previousRound, label) {
  return (
    <div
      className="plan-balance-sheet-table-scroll"
      role="region"
      aria-label={`${label}, vieritettävissä vaakasuunnassa`}
      tabIndex={0}
    >
      <div className="plan-balance-sheet-table" role="table" aria-label={label}>
        <div className="plan-balance-sheet-row is-header" role="row">
          <span role="columnheader">Erä</span>
          <span role="columnheader">Kierros {previousRound}</span>
          <span role="columnheader">Kierros {round}</span>
        </div>

        {rows.map((row) => (
          <div
            className={`plan-balance-sheet-row ${row.kind === 'subtotal' ? 'is-subtotal' : ''} ${row.kind === 'total' ? 'is-total' : ''}`}
            key={row.key}
            role="row"
          >
            <span role="cell">{row.label}</span>
            <span className="plan-balance-sheet-value is-previous" role="cell">
              {row.previousValue}
            </span>
            <span className="plan-balance-sheet-value" role="cell">
              {row.currentValue}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PlanBalanceSheetPage({ inventoryTurnover, gameState, factorySettings = DEFAULT_FACTORY_SETTINGS }) {
  const [snapshot, setSnapshot] = useState(null)

  useEffect(() => {
    let isMounted = true

    const loadSnapshot = async () => {
      const data = await getInitialBalanceSheetHistory(gameState, factorySettings)

      if (isMounted) {
        setSnapshot(data)
      }
    }

    loadSnapshot()

    return () => {
      isMounted = false
    }
  }, [factorySettings, gameState])

  const viewModel = useMemo(() => {
    if (!snapshot || inventoryTurnover == null) {
      return null
    }

    const historyView = buildBalanceSheetHistoryView({
      baselineHistory: snapshot,
      runtimeHistory: gameState.history,
    })

    const balanceSheet = buildBalanceSheetViewModel(historyView, Number(inventoryTurnover))
    return {
      ...balanceSheet,
      interpretation: buildBalanceInterpretation({
        balanceSheet,
        confirmedEntry: historyView.confirmedEntry,
        factorySettings,
      }),
    }
  }, [factorySettings, gameState.history, inventoryTurnover, snapshot])

  if (!viewModel) {
    return (
      <section className="plan-balance-sheet-page" aria-label="Tase latautuu">
        <header className="plan-balance-sheet-header">
          <h1>Tase</h1>
        </header>
        <p>Ladataan kierroksen tasetta...</p>
      </section>
    )
  }

  return <BalanceSheetPanel viewModel={viewModel} />
}

export function BalanceSheetPanel({ viewModel }) {
  return (
    <section className="plan-balance-sheet-page" aria-label="Tase">
      <header className="plan-balance-sheet-header">
        <h1>Tase</h1>
        <p>
          Vertailu: kierros {viewModel.previousRound} / kierros {viewModel.round}
        </p>
      </header>

      <div className="plan-balance-sheet-layout">
        <div className="plan-balance-sheet-report">
          <div className="plan-balance-sheet-grid">
            <section aria-label="Vastaavaa">
              <h2>VASTAAVAA</h2>
              {renderRows(viewModel.assetsRows, viewModel.round, viewModel.previousRound, 'Vastaavaa')}
            </section>

            <section aria-label="Vastattavaa">
              <h2>VASTATTAVAA</h2>
              {renderRows(viewModel.liabilitiesRows, viewModel.round, viewModel.previousRound, 'Vastattavaa')}
            </section>
          </div>

          <div className="plan-balance-sheet-summary" aria-label="Lean yhteenveto">
            <p>
              <strong>Varaston arvo:</strong> {viewModel.summary.inventoryValue}
            </p>
            <p>
              <strong>Varaston kiertonopeus:</strong> {viewModel.interpretation.inventory.value}
            </p>
            <p>
              <strong>Omavaraisuusaste:</strong> {viewModel.summary.solvencyRatio}
            </p>
          </div>
        </div>
        <BalanceInterpretation interpretation={viewModel.interpretation} />
      </div>
    </section>
  )
}

export default PlanBalanceSheetPage