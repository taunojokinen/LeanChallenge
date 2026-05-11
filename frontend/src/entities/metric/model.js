export const metricKinds = {
  currency: 'currency',
  percent: 'percent',
}

export function createMetric(label, value, kind) {
  return { label, value, kind }
}
