import test from 'node:test'
import assert from 'node:assert/strict'
import { createInitialGameState } from '../../entities/factory-settings/initialGameState.js'
import { calculateRoundForecast } from '../../entities/forecast/model.js'
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
  const roundZero = calculateRoundForecast(createInitialGameState()).current.factoryKnl

  assert.equal(cockpit.previousConfirmedRound, -1)
  assert.equal(cockpit.confirmedRound, 0)
  assert.ok(cockpit.gauges.every((gauge) => gauge.change < 0))
  assert.deepEqual(cockpit.gauges.map((gauge) => gauge.value), [roundZero.kPct, roundZero.nPct, roundZero.lPct])
  assert.equal(cockpit.departments[0].metrics.K.previous, 89)
  assert.equal(cockpit.departments[1].metrics.K.previous, 83)
  assert.equal(cockpit.departments[2].metrics.K.previous, 79)
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

test('department K/N/L values and KNL come from confirmed history', () => {
  const cockpit = cockpitWithHistory([historyEntry(1, 81), historyEntry(2, 84)])
  const machining = cockpit.departments[0]

  assert.equal(machining.metrics.K.current, 84)
  assert.equal(machining.metrics.N.current, 84)
  assert.equal(machining.metrics.L.current, 84)
  assert.equal(machining.metrics.KNL.current, 84)
})

test('relative change uses absolute previous value', () => {
  assert.equal(calculateRelativeChange(105, -100), 205)
  assert.equal(calculateRelativeChange(84, 80), 5)
})

test('previous zero produces a finite neutral change', () => {
  assert.equal(calculateRelativeChange(84, 0), 0)
  assert.equal(Number.isFinite(calculateRelativeChange(84, 0)), true)
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