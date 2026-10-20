import { useId } from 'react'
import ProgressBar from '../progress-bar/ProgressBar.jsx'
import './development-slider.css'

function DevelopmentSlider({
  label,
  value,
  min = 0,
  max,
  allocationMaximum = max,
  step = 10,
  predictedLevel,
  onChange,
  disabled = false,
  id,
}) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hasValidRange = Number.isFinite(min) && Number.isFinite(max) && max >= min
  const hasValidStep = Number.isFinite(step) && step > 0
  const hasValidValue = hasValidRange && Number.isFinite(value) && value >= min && value <= max
  const allocationFloor = hasValidValue ? value : min
  const allowedMaximum = hasValidRange
    ? Number.isFinite(allocationMaximum)
      ? Math.min(max, Math.max(allocationFloor, allocationMaximum))
      : max
    : 0
  const currentPosition = hasValidValue ? ((value - min) / (max - min || 1)) * 100 : 0
  const allowedPosition = hasValidRange ? ((allowedMaximum - min) / (max - min || 1)) * 100 : 100
  const isDisabled = disabled || !hasValidValue || !hasValidStep || max === min
  const hoursText = hasValidValue ? `${value} h` : '\u2013'
  const rangeStyle = {
    '--range-value-position': `${currentPosition}%`,
    '--range-allowed-position': `${allowedPosition}%`,
  }

  const handleChange = (event) => {
    const nextHours = event.currentTarget.valueAsNumber

    if (isDisabled || !Number.isFinite(nextHours) || nextHours < min || nextHours > max) {
      return
    }

    onChange(nextHours)
  }

  return (
    <div className="development-slider">
      <div className="development-slider__header">
        <label className="development-slider__label" htmlFor={inputId}>{label}</label>
        <output className="development-slider__value" htmlFor={inputId}>{hoursText}</output>
      </div>
      <div className="development-slider__control">
        <span className="development-slider__bound">
          {hasValidRange ? `${min} h` : '\u2013'}
        </span>
        <input
          className="development-slider__input"
          id={inputId}
          type="range"
          min={hasValidRange ? min : 0}
          max={hasValidRange ? max : 1}
          step={hasValidStep ? step : 10}
          value={hasValidValue ? value : hasValidRange ? min : 0}
          style={rangeStyle}
          onChange={handleChange}
          disabled={isDisabled}
          aria-valuetext={hoursText}
          aria-description={`Valittu ${hoursText}. Vapaan kapasiteetin puitteissa enintään ${allowedMaximum} h.`}
        />
        <span className="development-slider__bound">
          {hasValidRange ? `${max} h` : '\u2013'}
        </span>
      </div>
      <ProgressBar
        value={predictedLevel}
        maximum={100}
        label="Kehitystaso (ennuste)"
        showValue={true}
        formatValue={(level) => `${level}%`}
      />
    </div>
  )
}

export default DevelopmentSlider