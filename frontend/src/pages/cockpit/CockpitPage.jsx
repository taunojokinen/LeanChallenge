import KpiRow from '../../widgets/kpi-row/KpiRow.jsx'
import GaugesPanel from '../../widgets/gauges-panel/GaugesPanel.jsx'
import Sidebar from '../../widgets/sidebar/Sidebar.jsx'
import SummaryPanel from '../../widgets/summary-panel/SummaryPanel.jsx'
import snapshot from '../../mocks/cockpitSnapshot.json'
import './CockpitPage.css'

function CockpitPage() {
  return (
    <div className="cockpit-layout">
      <main className="cockpit-main">
        <KpiRow items={snapshot.topKpis} />
        <GaugesPanel gauges={snapshot.gauges} />
        <SummaryPanel summary={snapshot.summary} />
      </main>
      <Sidebar sections={snapshot.sidebar} />
    </div>
  )
}

export default CockpitPage
