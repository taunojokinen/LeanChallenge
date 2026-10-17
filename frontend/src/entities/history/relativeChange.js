export function relativePercentChange(current, previous) {
  if (current == null || previous == null
    || !Number.isFinite(Number(current)) || !Number.isFinite(Number(previous))
    || Number(previous) === 0) {
    return null
  }

  return (Number(current) - Number(previous)) / Math.abs(Number(previous)) * 100
}
