const FORMATTER = new Intl.NumberFormat('fi-FI', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
})

export function formatPercentChange(value) {
  if (value == null || !Number.isFinite(value)) {
    return '—'
  }

  return `${FORMATTER.format(value)} %`
}
