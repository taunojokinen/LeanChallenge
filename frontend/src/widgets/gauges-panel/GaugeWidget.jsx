function GaugeWidget({ gauge }) {
  return (
    <article className="gauge-card">
      <div className="gauge-ring" role="img" aria-label={`${gauge.label} ${gauge.value}%`}>
        <span>{gauge.value}%</span>
      </div>
      <h3>{gauge.label}</h3>
    </article>
  )
}

export default GaugeWidget
