import { useEffect, useMemo, useState } from 'react'
import { buildIncomeHistoryView, buildIncomeStatementRows } from '../../entities/income/model.js'
import { getInitialIncomeHistory } from '../../shared/api/incomeApi.js'
import { DEFAULT_FACTORY_SETTINGS } from '../../entities/factory-settings/defaultFactorySettings.js'
import './PlanIncomePage.css'

function PlanIncomePage({ gameState, factorySettings = DEFAULT_FACTORY_SETTINGS }) {
  const [snapshot, setSnapshot] = useState(null)

  useEffect(() => {
    let isMounted = true

    const loadSnapshot = async () => {
      const data = await getInitialIncomeHistory(gameState, factorySettings)

      if (isMounted) {
        setSnapshot(data)
      }
    }

    loadSnapshot()

    return () => {
      isMounted = false
    }
  }, [factorySettings, gameState])

  const historyView = useMemo(() => {
    if (!snapshot) {
      return null
    }

    // PLAN/Tulos compares the two latest CONFIRMED rounds, same principle as PLAN/Tase -
    // it must never show the in-progress round's live forecast as if it were confirmed.
    return buildIncomeHistoryView({
      baselineHistory: snapshot,
      runtimeHistory: gameState.history,
    })
  }, [gameState.history, snapshot])

  const rows = useMemo(() => (historyView ? buildIncomeStatementRows(historyView) : []), [historyView])

  if (!snapshot) {
    return (
      <section className="plan-income-page" aria-label="Tuloslaskelma latautuu">
        <h1>TULOS</h1>
        <p>Ladataan kierroksen tuloslaskelmaa...</p>
      </section>
    )
  }

  return (
    <section className="plan-income-page" aria-label="Tuloslaskelma">
      <header className="plan-income-header">
        <h1>TULOS</h1>
          <p>Lähtövertailu: Kierros {historyView.previousRound} | Kierros {historyView.round}</p>
      </header>

      <div className="plan-income-table" role="table" aria-label="Kierroksen tuloslaskelma">
        <div className="plan-income-row plan-income-row-header" role="row">
          {['Erä', `Kierros ${historyView.previousRound}`, `Kierros ${historyView.round}`, 'Muutos'].map((header) => (
            <span key={header} className="plan-income-header-cell" role="columnheader">
              {header}
            </span>
          ))}
        </div>
        {rows.map((row) => {
          const isResultRow = row.key === 'result'
          const previousIsNegative = isResultRow && Number(row.previousAmount) < 0
          const currentIsNegative = isResultRow && Number(row.currentAmount) < 0

          return (
            <div
              key={row.key}
              className={`plan-income-row ${row.kind === 'subtotal' ? 'is-subtotal' : ''} ${row.kind === 'total' ? 'is-total' : ''} ${row.isNegative ? 'is-negative-total' : ''}`}
              role="row"
            >
              <span className="plan-income-label" role="cell">
                {row.label}
              </span>
              <span
                className={`plan-income-value plan-income-previous-value ${previousIsNegative ? 'is-negative-result' : ''}`}
                role="cell"
              >
                {row.previousAmountText}
              </span>
              <span
                className={`plan-income-value plan-income-current-value ${currentIsNegative ? 'is-negative-result' : ''}`}
                role="cell"
              >
                {row.currentAmountText}
              </span>
              <span className={`plan-income-delta is-${row.impact}`} role="cell">
                {row.deltaText}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default PlanIncomePage