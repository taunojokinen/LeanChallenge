import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReportSeries, formatReportValue } from './model.js'

test('report selects and sorts confirmed rounds and derives KNL with the existing factors', () => {
  const entry = (round) => ({
    round,
    factoryKnl: { kPct: 80, nPct: 90, lPct: 75 },
    incomeStatement: { revenue: round * 1000, result: -round * 100 },
    finance: { equity: round * 500 },
  })
  const history = [entry(12), entry(0), entry(2), entry(-1), entry(1), entry(13)]
  const original = structuredClone(history)
  const series = buildReportSeries(history, 12)

  assert.deepEqual(series.map((point) => point.round), [1, 2, 12])
  assert.ok(Math.abs(series[0].knl - 54) < 1e-10)
  assert.equal(series.at(-1).revenue, 12000)
  assert.equal(series.at(-1).result, -1200)
  assert.equal(series.at(-1).equity, 6000)
  assert.deepEqual(history, original)
})

test('missing and nonfinite data remain absent, while actual zero values remain zero', () => {
  const series = buildReportSeries([
    { round: 1 },
    {
      round: 3,
      factoryKnl: { kPct: 80, nPct: null, lPct: 90 },
      incomeStatement: { revenue: NaN, result: 0 },
      finance: { equity: Infinity },
    },
  ], 12)

  assert.deepEqual(series, [
    { round: 1, knl: null, revenue: null, result: null, equity: null },
    { round: 3, knl: null, revenue: null, result: 0, equity: null },
  ])
  assert.deepEqual(buildReportSeries(undefined, 12), [])
})

test('report values use Finnish numbers and preserve negative results', () => {
  assert.equal(formatReportValue(54.12, '%'), '54,1 %')
  assert.equal(formatReportValue(-1234.4, '€'), '−1\u00a0234 €')
  assert.equal(formatReportValue(null, '€'), '—')
  assert.equal(formatReportValue(0, '€'), '0 €')
})
