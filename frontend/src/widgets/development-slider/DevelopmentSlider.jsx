import { useId } from 'react'
import ProgressBar from '../progress-bar/ProgressBar.jsx'
import './development-slider.css'

function DevelopmentSlider({
  label,
  value,
  min = 0,
  max,
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
  const isDisabled = disabled || !hasValidValue || !hasValidStep || max === min
  const hoursText = hasValidValue ? `${value} h` : '\u2013'

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
          onChange={handleChange}
          disabled={isDisabled}
          aria-valuetext={hoursText}
        />
        <span className="development-slider__bound">
          {hasValidRange ? `${max} h` : '\u2013'}
        </span>
      </div>
      <ProgressBar
        value={predictedLevel}
        maximum={100}
        label="Kehitystaso"
        showValue={true}
        formatValue={(level) => `${level}%`}
      />
    </div>
  )
}

export default DevelopmentSlider