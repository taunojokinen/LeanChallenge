import GaugeWidget from './GaugeWidget.jsx'
import './gauge-widget.css'

function GaugesPanel({ gauges }) {
  return (
    <section className="gauges-grid" aria-label="Mittarit">
      {gauges.map((gauge) => (
        <GaugeWidget key={gauge.label} gauge={gauge} />
      ))}
    </section>
  )
}

export default GaugesPanel
