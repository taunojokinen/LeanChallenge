import { useEffect, useMemo, useState } from 'react'
import { buildIncomeStatementRows } from '../../entities/income/model.js'
import { getIncomeSnapshot } from '../../shared/api/incomeApi.js'
import './PlanIncomePage.css'

function PlanIncomePage() {
  const [snapshot, setSnapshot] = useState(null)

  useEffect(() => {
    let isMounted = true

    const loadSnapshot = async () => {
      const data = await getIncomeSnapshot()

      if (isMounted) {
        setSnapshot(data)
      }
    }

    loadSnapshot()

    return () => {
      isMounted = false
    }
  }, [])

  const rows = useMemo(() => {
    if (!snapshot) {
      return []
    }

    return buildIncomeStatementRows(snapshot)
  }, [snapshot])

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
        <p>Kierroksen {snapshot.round} tuloslaskelma</p>
      </header>

      <div className="plan-income-table" role="table" aria-label="Kierroksen tuloslaskelma">
        {rows.map((row) => (
          <div
            key={row.key}
            className={`plan-income-row ${row.kind === 'subtotal' ? 'is-subtotal' : ''} ${row.kind === 'total' ? 'is-total' : ''} ${row.isNegative ? 'is-negative-total' : ''}`}
            role="row"
          >
            <span className="plan-income-label" role="cell">
              {row.label}
            </span>
            <span className="plan-income-value" role="cell">
              {row.amountText}
            </span>
            <span className={`plan-income-delta is-${row.impact}`} role="cell">
              {row.deltaText}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

export default PlanIncomePage