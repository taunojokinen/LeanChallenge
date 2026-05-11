export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function mapRange(value, inMin, inMax, outMin, outMax) {
  if (inMin === inMax) {
    return outMin
  }

  return outMin + ((value - inMin) * (outMax - outMin)) / (inMax - inMin)
}
