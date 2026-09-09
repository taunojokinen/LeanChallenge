import { useMemo } from 'react'
import { buildConfirmedCockpitViewModel, formatChange, formatPercent } from './cockpitModel.js'
import GaugesPanel from '../../widgets/gauges-panel/GaugesPanel.jsx'
import './PlanCockpitPage.css'

function getChangeClass(value) {
  if (value > 0) {
    return 'is-positive'
  }

  if (value < 0) {
    return 'is-negative'
  }

  return 'is-neutral'
}

function DepartmentCard({ department }) {
  return (
    <article className="cockpit-department-card">
      <h2>{department.name}</h2>
      <table>
        <caption className="visually-hidden">{department.name} K/N/L/KNL-vertailu</caption>
        <thead>
          <tr>
            <th scope="col">Mittari</th>
            <th scope="col">Kierros {department.previousRound}</th>
            <th scope="col">Kierros {department.currentRound}</th>
            <th scope="col">Muutos</th>
          </tr>
        </thead>
        <tbody>
          {Object.values(department.metrics).map((metric) => (
            <tr key={metric.key}>
              <th scope="row">{metric.label}</th>
              <td>{formatPercent(metric.previous)}</td>
              <td>{formatPercent(metric.current)}</td>
              <td className={`comparison-change ${getChangeClass(metric.change)}`}>
                {formatChange(metric.change)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  )
}

function PlanCockpitPage({ round, totalRounds, gameState, factorySettings }) {
  const cockpit = useMemo(
    () => buildConfirmedCockpitViewModel(gameState, factorySettings),
    [factorySettings, gameState],
  )

  if (!cockpit) {
    return (
      <div className="plan-cockpit-page">
        <main className="plan-cockpit-main">
          <section className="plan-cockpit-loading">
            <h1>Lean Cockpit</h1>
            <p>Ladataan Lean Cockpit -näkymää...</p>
          </section>
        </main>
      </div>
    )
  }

  const gauges = cockpit.gauges.map((gauge) => ({ ...gauge, value: gauge.value }))
  const departments = cockpit.departments.map((department) => ({
    ...department,
    previousRound: cockpit.previousConfirmedRound,
    currentRound: cockpit.confirmedRound,
  }))

  return (
    <div className="plan-cockpit-page">
      <main className="plan-cockpit-main">
        <header className="plan-cockpit-header">
          <div>
            <h1>Lean Cockpit</h1>
            <p>K/N/L-kehitys kahdelta viimeisimmältä vahvistetulta kierrokselta.</p>
          </div>
          <strong>Kierros {round} / {totalRounds}</strong>
        </header>

        <section className="plan-cockpit-metrics" aria-label="Tehtaan kokonaismittarit">
          <h2>Tehtaan kokonaismittarit</h2>
          <GaugesPanel gauges={gauges} />
        </section>

        <section className="plan-cockpit-departments" aria-label="Osastojen K/N/L-vertailu">
          <h2>Osastot</h2>
          <div className="cockpit-department-grid">
            {departments.map((department) => (
              <DepartmentCard key={department.key} department={department} />
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

export default PlanCockpitPage