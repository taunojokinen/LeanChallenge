import './progress-bar.css'

function ProgressBar({ value, maximum, label, showValue = true, formatValue }) {
  const isValid = Number.isFinite(value) && Number.isFinite(maximum) && maximum > 0
  const boundedValue = isValid ? Math.min(maximum, Math.max(0, value)) : 0
  const safeMaximum = Number.isFinite(maximum) && maximum > 0 ? maximum : 1
  const percentage = (boundedValue / safeMaximum) * 100
  const valueText = isValid
    ? (formatValue ? formatValue(value, maximum) : `${value} / ${maximum}`)
    : '\u2013'

  return (
    <div className={`progress-bar${showValue ? '' : ' progress-bar--without-value'}`}>
      <span className="progress-bar__label">{label}</span>
      <div
        className="progress-bar__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeMaximum}
        aria-valuenow={boundedValue}
        aria-valuetext={valueText}
      >
        <span className="progress-bar__fill" style={{ width: `${percentage}%` }} />
      </div>
      {showValue ? <span className="progress-bar__value">{valueText}</span> : null}
    </div>
  )
}

export default ProgressBar