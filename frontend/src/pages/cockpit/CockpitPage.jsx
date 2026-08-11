import KpiRow from '../../widgets/kpi-row/KpiRow.jsx'
import GaugesPanel from '../../widgets/gauges-panel/GaugesPanel.jsx'
import Sidebar from '../../widgets/sidebar/Sidebar.jsx'
import SummaryPanel from '../../widgets/summary-panel/SummaryPanel.jsx'
import snapshot from '../../mocks/cockpitSnapshot.json'
import { getPhaseProgress } from '../../shared/lib/pdca.js'
import './CockpitPage.css'

function CockpitPage() {
  const phaseLabel = getPhaseProgress(4, 1)

  return (
    <div className="cockpit-layout">
      <main className="cockpit-main">
        <section className="phase-banner" aria-label="PDCA-tilanne">
          <h2>Lean Cockpit</h2>
          <p>{phaseLabel}</p>
          <span>PLAN → DO → CHECK → ACT</span>
        </section>
        <KpiRow items={snapshot.topKpis} />
        <GaugesPanel gauges={snapshot.gauges} />
        <SummaryPanel summary={snapshot.summary} />
      </main>
      <Sidebar sections={snapshot.sidebar} />
    </div>
  )
}

export default CockpitPage
