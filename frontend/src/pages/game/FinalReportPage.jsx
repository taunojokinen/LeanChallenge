import { useMemo, useState } from 'react'
import Button from '../../shared/ui/Button/Button.jsx'
import { buildReportSeries, formatReportValue, REPORT_METRICS } from '../../entities/report/model.js'
import ReportLineChart from './ReportLineChart.jsx'
import './FinalReportPage.css'

const FINANCIAL_METRICS = REPORT_METRICS.slice(1)

function FinalReportPage({ gameState, totalRounds, onRestartGame }) {
  const [metricIndex, setMetricIndex] = useState(0)
  const series = useMemo(() => buildReportSeries(gameState.history, totalRounds), [gameState.history, totalRounds])
  const latest = series.at(-1)
  const financialMetric = FINANCIAL_METRICS[metricIndex]
  const changeMetric = (direction) => setMetricIndex((index) =>
    (index + direction + FINANCIAL_METRICS.length) % FINANCIAL_METRICS.length)

  return (
    <section className="final-report" aria-label="Pelin loppuraportti">
      <header className="final-report__header">
        <h1>Lean Challenge – Pelin loppuraportti</h1>
        <p>{gameState.completion?.reason === 'bankruptcy'
          ? `Peli päättyi konkurssiin kierroksella ${gameState.completion.confirmedRound}: oma pääoma on nolla tai negatiivinen.`
          : `Kaikki ${totalRounds} kierrosta on vahvistettu.`}</p>
      </header>

      <div className="final-report__charts">
        <section className="final-report__chart-panel" aria-label="KNL:n kehitys">
          <header><h2>KNL (%)</h2></header>
          <ReportLineChart series={series} metric={REPORT_METRICS[0]} totalRounds={totalRounds} />
        </section>
        <section className="final-report__chart-panel" aria-label="Talouden kehitys">
          <header>
            <Button aria-label="Edellinen talouden tunnusluku" onClick={() => changeMetric(-1)}>←</Button>
            <h2 aria-live="polite" aria-atomic="true">{financialMetric.label}</h2>
            <Button aria-label="Seuraava talouden tunnusluku" onClick={() => changeMetric(1)}>→</Button>
          </header>
          <ReportLineChart series={series} metric={financialMetric} totalRounds={totalRounds} />
        </section>
      </div>

      <section aria-label="Viimeisen vahvistetun kierroksen tunnusluvut">
        <h2 className="final-report__kpi-heading">Viimeinen vahvistettu kierros{latest ? `: ${latest.round}` : ''}</h2>
        <dl className="final-report__kpis" tabIndex={0}>
          {REPORT_METRICS.map((metric) => (
            <div key={metric.key}>
              <dt>{metric.label}</dt>
              <dd>{formatReportValue(latest?.[metric.key], metric.unit)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <details className="final-report__details">
        <summary>Vahvistetut kierrostiedot</summary>
        <div className="final-report__table-scroll" role="region" aria-label="Kierrostiedot, vieritettävissä vaakasuunnassa" tabIndex={0}>
          <table>
            <caption>Vahvistetut toteumat. Puuttuva tieto esitetään merkillä —.</caption>
            <thead><tr><th scope="col">Kierros</th>{REPORT_METRICS.map((metric) => <th scope="col" key={metric.key}>{metric.label}</th>)}</tr></thead>
            <tbody>{series.map((entry) => (
              <tr key={entry.round}>
                <th scope="row">{entry.round}</th>
                {REPORT_METRICS.map((metric) => <td key={metric.key}>{formatReportValue(entry[metric.key], metric.unit)}</td>)}
              </tr>
            ))}</tbody>
          </table>
        </div>
      </details>
      <footer className="final-report__actions">
        <Button onClick={onRestartGame}>Aloita uusi peli</Button>
      </footer>
    </section>
  )
}

export default FinalReportPage
