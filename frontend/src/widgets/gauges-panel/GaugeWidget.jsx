function formatChange(value) {
  const numeric = Number(value) || 0
  const sign = numeric > 0 ? '+' : ''
  return `${sign}${numeric.toLocaleString('fi-FI', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
}

function getChangeClass(value) {
  if (value > 0) {
    return 'is-positive'
  }

  if (value < 0) {
    return 'is-negative'
  }

  return 'is-neutral'
}

function GaugeWidget({ gauge }) {
  const safeValue = Math.round(Number(gauge.value) || 0)
  const hasChange = gauge.change != null

  return (
    <article className="gauge-card">
      <div className="gauge-ring" role="img" aria-label={`${gauge.label} ${safeValue}%`}>
        <span>{safeValue}%</span>
      </div>

      <h3>{gauge.label}</h3>
      {hasChange ? <p className={`gauge-change ${getChangeClass(gauge.change)}`}>{formatChange(gauge.change)}</p> : null}
    </article>
  )
}

export default GaugeWidget
