import test from 'node:test'
import assert from 'node:assert/strict'
import { createInitialGameState } from '../factory-settings/initialGameState.js'
import { buildInitialKnlHistory, selectConfirmedKnlRounds } from './confirmedKnl.js'
import { DEFAULT_FACTORY_SETTINGS } from '../factory-settings/defaultFactorySettings.js'
import { calculateRoundForecast } from '../forecast/model.js'
import { advanceRoundState } from '../game-round/advanceRound.js'
import { calculateFactoryKnl, calculateKnlFromMetrics } from '../forecast/factoryKnl.js'

// A: while planning round 1 (gameState.round === 1, no confirmed history yet), the latest
// confirmed round the player sees must be round 0 - the planning round itself is not yet history.
test('planning round 1 has confirmed round 0 as the latest confirmed reference', () => {
  const gameState = createInitialGameState()
  assert.equal(gameState.round, 1)

  const [, currentEntry] = selectConfirmedKnlRounds(gameState)

  assert.equal(currentEntry.round, 0)
})

function assertBound(previous, current, key) {
  if (current[key] === 0) {
    assert.equal(previous[key], 0)
  } else {
    assert.ok(Math.abs(previous[key] / current[key] - 1) < 0.01, key)
    assert.ok(Math.abs(current[key] / previous[key] - 1) < 0.01, `${key} inverse`)
  }
}

test('all department and factory metrics derive from round zero within 1% across 1000 seeds', () => {
  for (let index = 0; index < 1000; index += 1) {
    const state = createInitialGameState(DEFAULT_FACTORY_SETTINGS, { historySeed: index * 4294967 })
    const [previous, current] = buildInitialKnlHistory(state)
    const forecast = calculateRoundForecast(state).current
    assert.deepEqual(current.factory, forecast.factoryKnl)
    for (const department of ['machining', 'assembly', 'shipping']) {
      const before = previous.departments[department]
      const now = current.departments[department]
      for (const key of ['kPct', 'nPct', 'lPct', 'knl', 'kAvailabilityPct']) {
        assertBound(before, now, key)
      }
      for (const key of ['kPct', 'nPct', 'lPct', 'kAvailabilityPct']) {
        assert.ok(before[key] >= 0 && before[key] <= 100)
      }
      assert.equal(before.capacityContainers, now.capacityContainers)
      assert.equal(before.knl, calculateKnlFromMetrics(before).knl * 100)
      assert.equal(now.kPct, forecast.knl[department].kPct)
      if (department === 'machining') {
        assertBound(before, now, 'kChangeoverPct')
        assert.equal(before.kPct, before.kAvailabilityPct * before.kChangeoverPct / 100)
      }
    }
    assert.deepEqual(previous.factory, calculateFactoryKnl(previous.departments))
    for (const key of ['kPct', 'nPct', 'lPct', 'knl']) {
      assertBound(previous.factory, current.factory, key)
    }
  }
})

test('seed survives reads, serialization, phase changes and confirmed rounds', () => {
  const state = createInitialGameState()
  const history = buildInitialKnlHistory(state)
  for (const phase of ['PLAN', 'DO', 'CHECK', 'ACT']) {
    assert.deepEqual(buildInitialKnlHistory({ ...JSON.parse(JSON.stringify(state)), phase }), history)
  }
  const forecast = calculateRoundForecast(state)
  const { nextGameState } = advanceRoundState({ gameState: state, forecast, totalRounds: 12 })
  assert.equal(nextGameState.historySeed, state.historySeed)
  assert.deepEqual(buildInitialKnlHistory(nextGameState), history)
  assert.deepEqual(selectConfirmedKnlRounds(nextGameState)[0], history[1])
})

test('new game creation draws a seed once and different seeds give different starting histories', (t) => {
  let seed = 123
  const random = t.mock.method(globalThis.crypto, 'getRandomValues', (values) => {
    values[0] = seed
    seed += 333
    return values
  })
  const first = createInitialGameState()
  const second = createInitialGameState()
  assert.equal(first.historySeed, 123)
  assert.equal(second.historySeed, 456)
  assert.notDeepEqual(buildInitialKnlHistory(first)[0], buildInitialKnlHistory(second)[0])
  assert.deepEqual(buildInitialKnlHistory(first)[1], buildInitialKnlHistory(second)[1])
  assert.equal(random.mock.callCount(), 2)
})

test('legacy sessions without a seed have a stable baseline on every read', () => {
  const state = createInitialGameState()
  delete state.historySeed
  assert.deepEqual(buildInitialKnlHistory(state), buildInitialKnlHistory(JSON.parse(JSON.stringify(state))))
})

test('teacher snapshot controls round zero and derived history, not legacy configured history', () => {
  const settings = structuredClone(DEFAULT_FACTORY_SETTINGS)
  settings.knl.baseline.K_assembly = 0.5
  const state = createInitialGameState(settings, { historySeed: 123 })
  const history = buildInitialKnlHistory(state, settings)
  const forecast = calculateRoundForecast(state, {}, settings).current
  assert.equal(history[1].departments.assembly.kPct, forecast.knl.assembly.kPct)
  assert.notEqual(history[1].departments.assembly.kPct, buildInitialKnlHistory(state)[1].departments.assembly.kPct)
  assertBound(history[0].departments.assembly, history[1].departments.assembly, 'kPct')
  settings.history.knl.roundMinusOne.assembly.kPct = 1
  assert.deepEqual(buildInitialKnlHistory(state, settings), history)
})

test('zero and saturated factors remain valid and keep the relative bound', () => {
  const settings = structuredClone(DEFAULT_FACTORY_SETTINGS)
  settings.knl.knlMaximum = 1
  for (const department of ['machining', 'assembly', 'shipping']) {
    settings.knl.baseline[`K_${department}`] = 1
    settings.knl.baseline[`N_${department}`] = 1
    settings.knl.baseline[`L_${department}`] = 0
  }
  const [previous, current] = buildInitialKnlHistory({ historySeed: 42 }, settings)
  for (const department of ['machining', 'assembly', 'shipping']) {
    for (const key of ['kPct', 'nPct', 'lPct', 'knl']) {
      assertBound(previous.departments[department], current.departments[department], key)
      assert.ok(previous.departments[department][key] >= 0 && previous.departments[department][key] <= 100)
    }
  }
})
