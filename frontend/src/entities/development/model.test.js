import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateDevelopedKnlValue } from '../forecast/knlDevelopment.js'
import { DEFAULT_FACTORY_SETTINGS } from '../factory-settings/defaultFactorySettings.js'
import { createInitialGameState } from '../factory-settings/initialGameState.js'
import { calculateRoundForecast } from '../forecast/model.js'
import { advanceRoundState } from '../game-round/advanceRound.js'
import {
  normalizeDevelopmentHours, updateDevelopmentHours, sumDevelopmentHours,
  isDevelopmentHoursValid, buildDevelopmentViewModel, calculateDevelopmentPercent,
} from './model.js'

test('all twelve methods start at zero cumulative hours and percent in a new game', () => {
  const view = buildDevelopmentViewModel(createInitialGameState(), normalizeDevelopmentHours())
  const methods = view.departments.flatMap((department) => department.methods)
  assert.equal(methods.length, 12)
  for (const method of methods) {
    assert.equal(method.currentHours, 0, method.key)
    assert.equal(method.predictedHours, 0, method.key)
    assert.equal(method.currentLevel, 0, method.key)
    assert.equal(method.predictedLevel, 0, method.key)
    assert.equal(method.value, 0, method.key)
  }
  assert.equal(view.usedHours, 0)
  assert.equal(view.remainingHours, 400)
})

test('invested method hours survive round advancement from the zero starting state', () => {
  const gameState = createInitialGameState()
  const forecast = calculateRoundForecast({ ...gameState, projectsDecision: {
    round: gameState.round,
    selections: [{ department: 'machining', method: 'smed', investedHours: 100 }],
  } })
  const { nextGameState } = advanceRoundState({ gameState, forecast, totalRounds: 12 })
  const view = buildDevelopmentViewModel(nextGameState, normalizeDevelopmentHours())
  const smed = view.departments[0].methods[1]
  assert.equal(smed.currentHours, 100)
  assert.equal(smed.currentLevel, calculateDevelopmentPercent(100))
  assert.equal(smed.value, 0)
})

test('normalizes all twelve choices and caps legacy over-budget decisions', () => {
  const hours = normalizeDevelopmentHours({ 'machining:five-s': 300, 'assembly:tpm': 200, unknown: 100 })
  assert.equal(Object.keys(hours).length, 12)
  assert.equal(hours['assembly:tpm'], 100)
  assert.equal(sumDevelopmentHours(hours), 400)
  assert.equal(isDevelopmentHoursValid(hours), true)
  assert.equal(isDevelopmentHoursValid({ ...hours, 'assembly:tpm': 200 }), false)
  assert.equal(isDevelopmentHoursValid({ ...hours, unknown: 0 }), false)
})

test('updates within shared capacity while retaining the edited slider own allocation', () => {
  const hours = normalizeDevelopmentHours({ 'machining:five-s': 100, 'assembly:tpm': 200 })
  const updated = updateDevelopmentHours(hours, 'machining:five-s', 300)
  assert.equal(updated['machining:five-s'], 200)
  assert.equal(sumDevelopmentHours(updated), 400)
  assert.equal(hours['machining:five-s'], 100)
  assert.equal(updateDevelopmentHours(updated, 'machining:five-s', 0)['machining:five-s'], 0)
  assert.deepEqual(updateDevelopmentHours(hours, 'unknown', 100), hours)
  assert.deepEqual(updateDevelopmentHours(hours, 'assembly:tpm', NaN), hours)
})

test('percentage reuses exponential curve normalized to its maximum', () => {
  const settings = DEFAULT_FACTORY_SETTINGS.knl
  assert.equal(calculateDevelopmentPercent(0), 0)
  assert.equal(calculateDevelopmentPercent(settings.knlHalfLifeHours), 50)
  assert.ok(Math.abs(calculateDevelopmentPercent(settings.knlHalfLifeHours * 2) - 75) < 1e-10)
  const expected = calculateDevelopedKnlValue({ x0: 0, cumulativeHours: 123,
    knlMaximum: settings.knlMaximum, knlHalfLifeHours: settings.knlHalfLifeHours }) / settings.knlMaximum * 100
  assert.equal(calculateDevelopmentPercent(123), expected)
  assert.equal(calculateDevelopmentPercent(-10), 0)
})

test('view model combines canonical cumulative hours and draft, including continuous method development', () => {
  const gameState = { lean: { methods: { assembly: { 'method-development': 100 } },
    fiveS: { departments: { machining: { effectiveHours: 400 } } } } }
  const hours = normalizeDevelopmentHours({ 'assembly:method-development': 120 })
  const view = buildDevelopmentViewModel(gameState, hours)
  const method = view.departments[1].methods[1]
  assert.equal(method.value, 120)
  assert.equal(method.predictedHours, 220)
  assert.equal(method.maximum, 400)
  assert.equal(view.departments[0].methods[1].maximum, 280)
  assert.equal(view.departments[0].methods[0].predictedHours, 380)
  const invested = buildDevelopmentViewModel(gameState,
    updateDevelopmentHours(hours, 'machining:five-s', 50))
  assert.equal(invested.departments[0].methods[0].predictedHours, 450)
  assert.ok(invested.departments[0].methods[0].predictedLevel > view.departments[0].methods[0].predictedLevel)
  assert.equal(view.usedHours, 120)
  assert.equal(view.remainingHours, 280)
})