import { useEffect, useState } from 'react'
import Button from '../../shared/ui/Button/Button.jsx'
import Card from '../../shared/ui/Card/Card.jsx'
import { loadPlanGoals } from '../../features/plan-goals/goalStore.js'
import { getPlanSnapshot } from '../../shared/api/planApi.js'
import GaugesPanel from '../../widgets/gauges-panel/GaugesPanel.jsx'
import './PlanCockpitPage.css'

const MAX_GOALS = 3

function PlanCockpitPage({ onNavigate }) {
  const [snapshot, setSnapshot] = useState(null)
  const [goalsCount, setGoalsCount] = useState(0)

  useEffect(() => {
    let isMounted = true

    const loadSnapshot = async () => {
      const data = await getPlanSnapshot()

      if (isMounted) {
        setSnapshot(data)
      }
    }

    loadSnapshot()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    setGoalsCount(loadPlanGoals().length)
  }, [])

  if (!snapshot) {
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

  const oee = snapshot.kpis.find((kpi) => kpi.key === 'oee')

  return (
    <div className="plan-cockpit-page">
      <main className="plan-cockpit-main">
        <section className="plan-cockpit-hero" aria-label="Lean Cockpit -kojelauta">
          <header>
            <h1>Lean Cockpit</h1>
            <p>PLAN-vaiheen yhteenveto käytettävyydestä, nopeudesta ja laadusta.</p>
          </header>

          <GaugesPanel gauges={snapshot.gauges} />
        </section>

        <section className="plan-cockpit-summary" aria-label="Lean Cockpit -yhteenveto">
          <Card>
            <article className="plan-cockpit-summary-grid">
              <div>
                <small>KNL</small>
                <p>{oee?.value ?? '-'}</p>
              </div>
              <div>
                <small>Pullonkaula</small>
                <p>{snapshot.production.bottleneck}</p>
              </div>
              <div>
                <small>Kierros</small>
                <p>
                  {snapshot.round} / {snapshot.totalRounds}
                </p>
              </div>
              <div>
                <small>Tavoitteiden tila</small>
                <p>
                  {goalsCount} / {MAX_GOALS} asetettu
                </p>
              </div>
            </article>
          </Card>
        </section>

        <section className="plan-cockpit-actions" aria-label="Lean Cockpit -toiminnot">
          <Button type="button" onClick={() => onNavigate('/plan/production')}>
            SIIRRY TUOTANNON ANALYYSIIN
          </Button>
        </section>
      </main>
    </div>
  )
}

export default PlanCockpitPage