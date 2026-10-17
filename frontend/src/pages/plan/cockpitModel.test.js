import test from 'node:test'
import assert from 'node:assert/strict'
import { createInitialGameState } from '../../entities/factory-settings/initialGameState.js'
import { calculateRoundForecast } from '../../entities/forecast/model.js'
import { calculateFactoryKnl } from '../../entities/forecast/factoryKnl.js'
import { calculateKNL } from '../../entities/forecast/knl.js'
import { selectConfirmedKnlRounds } from '../../entities/history/confirmedKnl.js'
import {
  buildConfirmedCockpitViewModel,
  calculateRelativeChange,
  formatChange,
  formatPercent,
} from './cockpitModel.js'

const departments = ['machining', 'assembly', 'shipping']

function metrics(value, knl = value / 100) {
  return { kPct: value, nPct: value, lPct: value, knl }
}

function historyEntry(round, value) {
  return {
    round,
    knl: Object.fromEntries(departments.map((department) => [department, metrics(value)])),
    factoryKnl: { kPct: value, nPct: value, lPct: value },
  }
}

function cockpitWithHistory(history) {
  return buildConfirmedCockpitViewModel(
    { ...createInitialGameState(), round: 3, history },
    undefined,
  )
}

test('no runtime history selects round -1 and round 0', () => {
  const cockpit = cockpitWithHistory([])
  const roundZeroForecast = calculateRoundForecast(createInitialGameState()).current
  const roundZeroKnl = roundZeroForecast.knl
  const roundZeroFactoryKnl = roundZeroForecast.factoryKnl
  const expectedRoundZero = {
    machining: { K: 76 * (1 - 100 / 1040), N: 90, L: 70 },
    assembly: { K: 70, N: 70, L: 70 },
    shipping: { K: 70, N: 70, L: 70 },
  }

  assert.equal(cockpit.previousConfirmedRound, -1)
  assert.equal(cockpit.confirmedRound, 0)

  assert.deepEqual(cockpit.gauges.map((gauge) => gauge.value), [
    roundZeroFactoryKnl.kPct,
    roundZeroFactoryKnl.nPct,
    roundZeroFactoryKnl.lPct,
  ])

  cockpit.departments.forEach((department) => {
    const expectedCanonical = expectedRoundZero[department.key]
    const canonicalRoundZero = roundZeroKnl[department.key]
    const { metrics } = department

    const availability = metrics['K - käytettävyys']
    const speed = metrics['N - nopeus']
    const quality = metrics['L - laatu']

    for (const metric of Object.values(metrics)) {
      assert.ok(Math.abs((metric.previous - metric.current) / metric.current) < 0.01)
    }
    assert.ok(Math.abs(canonicalRoundZero.kPct - expectedCanonical.K) < 0.0001)
    assert.ok(Math.abs(canonicalRoundZero.nPct - expectedCanonical.N) < 0.0001)
    assert.ok(Math.abs(canonicalRoundZero.lPct - expectedCanonical.L) < 0.0001)
    assert.ok(Math.abs(availability.current * (metrics['K - vaihdot']?.current ?? 100) / 100 - canonicalRoundZero.kPct) < 1e-9)
    assert.equal(speed.current, canonicalRoundZero.nPct)
    assert.equal(quality.current, canonicalRoundZero.lPct)
    assert.ok(Math.abs(metrics.KNL.current - canonicalRoundZero.knl * 100) < 1e-9)
    assert.ok(Math.abs(metrics.KNL.previous - calculateKNL(
        availability.previous * (metrics['K - vaihdot']?.previous ?? 100) / 100,
        speed.previous,
        quality.previous,
      ) * 100) < 1e-9)
  })
})

test('one confirmed runtime round selects round 0 and round 1', () => {
  const cockpit = cockpitWithHistory([historyEntry(1, 81)])

  assert.equal(cockpit.previousConfirmedRound, 0)
  assert.equal(cockpit.confirmedRound, 1)
})

test('two confirmed runtime rounds select round 1 and round 2', () => {
  const cockpit = cockpitWithHistory([historyEntry(1, 81), historyEntry(2, 84)])

  assert.equal(cockpit.previousConfirmedRound, 1)
  assert.equal(cockpit.confirmedRound, 2)
})

test('machining KNL uses both K components while assembly and shipping keep their row structure', () => {
  const cockpit = cockpitWithHistory([historyEntry(1, 81), historyEntry(2, 84)])
  const machining = cockpit.departments[0]
  const assembly = cockpit.departments[1]
  const shipping = cockpit.departments[2]

  assert.deepEqual(Object.keys(machining.metrics), [
    'K - vaihdot',
    'K - käytettävyys',
    'N - nopeus',
    'L - laatu',
    'KNL',
  ])
  assert.equal(machining.metrics['K - käytettävyys'].current, 84)
  assert.equal(machining.metrics['N - nopeus'].current, 84)
  assert.equal(machining.metrics['L - laatu'].current, 84)
  assert.equal(machining.metrics.KNL.current, 84)
  assert.deepEqual(Object.keys(assembly.metrics), ['K - käytettävyys', 'N - nopeus', 'L - laatu', 'KNL'])
  assert.deepEqual(Object.keys(shipping.metrics), ['K - käytettävyys', 'N - nopeus', 'L - laatu', 'KNL'])
})

test('machining changeover K derives from round zero with a small relative variation', () => {
  const cockpit = cockpitWithHistory([])
  const roundZero = calculateRoundForecast(createInitialGameState()).current.knl.machining
  const metrics = cockpit.departments[0].metrics

  assert.equal(metrics['K - vaihdot'].current, roundZero.kChangeoverPct)
  assert.ok(Math.abs(metrics['K - vaihdot'].previous / roundZero.kChangeoverPct - 1) < 0.01)
  assert.ok(Math.abs(metrics.KNL.current - calculateKNL(
      metrics['K - vaihdot'].current * metrics['K - käytettävyys'].current / 100,
      metrics['N - nopeus'].current,
      metrics['L - laatu'].current,
    ) * 100) < 1e-9)
})

test('baseline factory K/N/L uses the shared capacity-weighted department aggregation', () => {
  const gameState = createInitialGameState()
  const [roundMinusOne, roundZero] = selectConfirmedKnlRounds(gameState)

  for (const entry of [roundMinusOne, roundZero]) {
    const expected = calculateFactoryKnl(entry.departments)

    assert.equal(entry.factory.kPct, expected.kPct)
    assert.equal(entry.factory.nPct, expected.nPct)
    assert.equal(entry.factory.lPct, expected.lPct)
  }

  assert.notEqual(roundMinusOne.factory.kPct, 84)
  assert.notEqual(roundMinusOne.factory.nPct, 82)
  assert.notEqual(roundMinusOne.factory.lPct, 77)
  const canonicalFactory = calculateRoundForecast(gameState).current.factoryKnl
  assert.equal(roundZero.factory.kPct, canonicalFactory.kPct)
  assert.equal(roundZero.factory.nPct, canonicalFactory.nPct)
  assert.equal(roundZero.factory.lPct, canonicalFactory.lPct)
})

test('relative change uses absolute previous value', () => {
  assert.equal(calculateRelativeChange(105, -100), 205)
  assert.equal(calculateRelativeChange(84, 80), 5)
  assert.equal(calculateRelativeChange(70, 69.7), 0.4)
})

test('previous zero produces an unavailable change', () => {
  assert.equal(calculateRelativeChange(84, 0), null)
  assert.equal(formatChange(calculateRelativeChange(84, 0)), '—')
})

test('percentage display rounds values and uses one decimal for changes', () => {
  assert.equal(formatPercent(88.8187166098823), '89 %')
  assert.equal(formatPercent(76.42286765671143), '76 %')
  assert.equal(formatChange(4.73456), '+4,7 %')
  assert.equal(formatChange(-1.344), '-1,3 %')
  assert.equal(formatChange(0), '0,0 %')
})

test('runtime history is the source of truth for the factory metrics', () => {
  const cockpit = buildConfirmedCockpitViewModel(
    { ...createInitialGameState(), round: 2, history: [historyEntry(1, 91)] },
    undefined,
  )

  assert.equal(cockpit.gauges[0].value, 91)
})

test('top gauges use confirmed factory metrics, not machining metrics', () => {
  const cockpit = cockpitWithHistory([{
    ...historyEntry(1, 91),
    knl: {
      machining: metrics(99),
      assembly: metrics(80),
      shipping: metrics(70),
    },
    factoryKnl: { kPct: 88, nPct: 91, lPct: 76 },
  }])

  assert.deepEqual(cockpit.gauges.map((gauge) => gauge.value), [88, 91, 76])
  assert.ok(Math.abs(cockpit.factory.KNL.current - 60.8608) < 1e-12)
})