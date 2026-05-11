import KpiCard from './KpiCard.jsx'
import './kpi-row.css'

function KpiRow({ items }) {
  return (
    <section className="kpi-row" aria-label="Keskeiset mittarit">
      {items.map((item) => (
        <KpiCard key={item.label} item={item} />
      ))}
    </section>
  )
}

export default KpiRow
