function KpiCard({ item }) {
  return (
    <article className="kpi-card">
      <h3>{item.label}</h3>
      <p>{item.value}</p>
      <small>{item.delta}</small>
    </article>
  )
}

export default KpiCard
