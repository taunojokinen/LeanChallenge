import { useMemo, useState } from 'react'
import { COCKPIT_NAME } from '../../config/appConfig.js'
import Button from '../../shared/ui/Button/Button.jsx'
import { buildConfirmedCockpitViewModel, formatPercent } from './cockpitModel.js'
import GaugesPanel from '../../widgets/gauges-panel/GaugesPanel.jsx'
import CockpitDepartmentDialog from './CockpitDepartmentDialog.jsx'
import './PlanCockpitPage.css'

function PlanCockpitPage({ gameState, factorySettings, onOpenGameGoals }) {
  const [showDepartments, setShowDepartments] = useState(false)
  const cockpit = useMemo(
    () => buildConfirmedCockpitViewModel(gameState, factorySettings),
    [factorySettings, gameState],
  )

  if (!cockpit) {
    return (
      <div className="plan-cockpit-page">
        <main className="plan-cockpit-main">
          <section className="plan-cockpit-loading">
            <p role="status">Ladataan {COCKPIT_NAME} -näkymää...</p>
          </section>
        </main>
      </div>
    )
  }

  const gauges = cockpit.gauges.map((gauge) => ({ ...gauge, value: gauge.value }))
  const departments = cockpit.departments.map((department) => ({
    ...department,
    name: department.key === 'assembly' ? 'Kokoonpano' : department.name,
    previousRound: cockpit.previousConfirmedRound,
    currentRound: cockpit.confirmedRound,
  }))

  return (
    <div className="plan-cockpit-page">
      <main className="plan-cockpit-main">
        <section className="plan-cockpit-metrics" aria-labelledby="cockpit-metrics-title">
          <div className="cockpit-section-heading">
            <h2 id="cockpit-metrics-title">Tehtaan kokonaismittarit</h2>
            <Button className="ui-button cockpit-goals-button" type="button" onClick={onOpenGameGoals}>
              Pelin tavoitteet
            </Button>
          </div>
          <GaugesPanel gauges={gauges} />
        </section>

        <section className="plan-cockpit-departments" aria-labelledby="cockpit-departments-title">
          <div className="cockpit-section-heading">
            <h2 id="cockpit-departments-title">Osastojen KNL</h2>
            <Button
              className="ui-button cockpit-details-button"
              type="button"
              aria-haspopup="dialog"
              onClick={() => setShowDepartments(true)}
            >
              Näytä osastojen tarkemmat tiedot
            </Button>
          </div>
          <div className="cockpit-department-bars">
            {departments.map((department) => (
              <div className="cockpit-department-bar" key={department.key}>
                <h3 id={`cockpit-knl-${department.key}`}>{department.name}</h3>
                <meter
                  min="0"
                  max="100"
                  value={department.metrics.KNL.current}
                  aria-labelledby={`cockpit-knl-${department.key}`}
                  aria-valuetext={formatPercent(department.metrics.KNL.current)}
                >
                  {formatPercent(department.metrics.KNL.current)}
                </meter>
                <strong>{formatPercent(department.metrics.KNL.current)}</strong>
              </div>
            ))}
          </div>
        </section>
        {showDepartments ? (
          <CockpitDepartmentDialog departments={departments} onClose={() => setShowDepartments(false)} />
        ) : null}
      </main>
    </div>
  )
}

export default PlanCockpitPage