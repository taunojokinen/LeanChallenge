import test, { beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { loadDevelopmentDecision, buildDevelopmentDecisions, saveDevelopmentDecision } from './decisionAdapter.js'
import { normalizeDevelopmentHours } from '../../entities/development/model.js'
import { loadFiveSDecision, saveFiveSDecision } from '../five-s/decisionStore.js'
import { loadProjectsDecision, saveProjectsDecision } from '../projects/decisionStore.js'
import { createInitialGameState } from '../../entities/factory-settings/initialGameState.js'
import { calculateRoundForecast } from '../../entities/forecast/model.js'
import { advanceRoundState } from '../../entities/game-round/advanceRound.js'
import { updateDevelopmentHours, sumDevelopmentHours } from '../../entities/development/model.js'

const originalWindow = globalThis.window
beforeEach(() => {
  const values = new Map()
  globalThis.window = { localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  } }
})
afterEach(() => {
  if (originalWindow === undefined) {
    delete globalThis.window
  } else {
    globalThis.window = originalWindow
  }
})

test('loads both legacy stores for the same round without trusting stored summary totals', () => {
  saveFiveSDecision({ round: 2, investedHours: { machining: 80 }, usedFocusHours: 999 })
  saveProjectsDecision({ round: 2, selections: [
    { department: 'assembly', method: 'method-development', investedHours: 120 },
  ] })
  const loaded = loadDevelopmentDecision(2)
  assert.equal(loaded.hours['machining:five-s'], 80)
  assert.equal(loaded.hours['assembly:method-development'], 120)
  assert.equal(loaded.wasAdjusted, false)
  assert.deepEqual(loadDevelopmentDecision(3).hours, normalizeDevelopmentHours())
})

test('reports and bounds legacy over-budget selections without writing storage', () => {
  saveFiveSDecision({ round: 1, investedHours: { machining: 400 } })
  saveProjectsDecision({ round: 1, selections: [{ department: 'assembly', method: 'tpm', investedHours: 100 }] })
  const loaded = loadDevelopmentDecision(1)
  assert.equal(loaded.wasAdjusted, true)
  assert.equal(loaded.hours['assembly:tpm'], 0)
  assert.equal(loadProjectsDecision(1).selections[0].investedHours, 100)
})

test('round-trips continuous choices through existing stores and calculates existing project costs', () => {
  const hours = normalizeDevelopmentHours({ 'shipping:five-s': 60, 'assembly:method-development': 120 })
  saveDevelopmentDecision({ round: 1, hours, savedAt: 'test-time' })
  assert.deepEqual(loadDevelopmentDecision(1).hours, hours)
  assert.equal(loadFiveSDecision(1).usedFocusHours, 60)
  assert.equal(loadProjectsDecision(1).usedFocusHours, 120)
  assert.equal(loadProjectsDecision(1).totalCost, 12000)
  assert.equal(loadProjectsDecision(1).savedAt, 'test-time')
})

test('each slider update immediately refreshes the shared decisions without applying the effect twice', () => {
  const gameState = createInitialGameState()
  let hours = normalizeDevelopmentHours()
  const moves = [
    ['machining:five-s', 300],
    ['assembly:method-development', 200],
    ['machining:five-s', 200],
    ['assembly:method-development', 200],
  ]
  for (const [key, value] of moves) {
    hours = updateDevelopmentHours(hours, key, value)
    saveDevelopmentDecision({ round: gameState.round, hours })
    assert.equal(sumDevelopmentHours(loadDevelopmentDecision(gameState.round).hours), sumDevelopmentHours(hours))
    assert.ok(sumDevelopmentHours(hours) <= 400)
  }
  assert.equal(hours['machining:five-s'], 200)
  assert.equal(hours['assembly:method-development'], 200)

  const savedFiveS = loadFiveSDecision(gameState.round)
  const savedProjects = loadProjectsDecision(gameState.round)
  const decidedState = { ...gameState, fiveSDecision: savedFiveS, projectsDecision: savedProjects }
  const forecast = calculateRoundForecast(decidedState)
  assert.equal(forecast.closingState.lean.fiveS.departments.machining.effectiveHours,
    gameState.lean.fiveS.departments.machining.effectiveHours + 200)
  assert.equal(forecast.closingState.lean.methods.assembly['method-development'], 200)
  const advanced = advanceRoundState({ gameState: decidedState, forecast, totalRounds: 12 })
  assert.equal(advanced.nextGameState.lean.methods.assembly['method-development'], 200)
  assert.equal(advanced.nextGameState.lean.fiveS.departments.machining.effectiveHours,
    forecast.closingState.lean.fiveS.departments.machining.effectiveHours)
  assert.equal(loadDevelopmentDecision(advanced.nextGameState.round).hours['machining:five-s'], 0)
})

test('rejects invalid and over-budget save before changing either store', () => {
  const hours = normalizeDevelopmentHours()
  assert.throws(() => saveDevelopmentDecision({ round: 1, hours: { ...hours, 'machining:tpm': 410 } }))
  assert.throws(() => buildDevelopmentDecisions({ round: 0, hours }))
  assert.equal(loadFiveSDecision(1), null)
  assert.equal(loadProjectsDecision(1), null)
})

test('restores both previous records when the second write fails', () => {
  const hours = normalizeDevelopmentHours({ 'machining:five-s': 50 })
  saveDevelopmentDecision({ round: 1, hours })
  const storage = window.localStorage
  const setItem = storage.setItem
  let writes = 0
  storage.setItem = (key, value) => {
    writes += 1
    if (writes === 2) {
      throw new Error('Storage write failed')
    }
    setItem(key, value)
  }
  assert.throws(() => saveDevelopmentDecision({ round: 1, hours: normalizeDevelopmentHours() }))
  assert.deepEqual(loadDevelopmentDecision(1).hours, hours)
})

test('draft decisions use the existing forecast engine without saving and affect cumulative production state', () => {
  const gameState = createInitialGameState()
  const hours = normalizeDevelopmentHours({ 'assembly:method-development': 120, 'machining:five-s': 50 })
  const decisions = buildDevelopmentDecisions({ round: gameState.round, hours })
  const baseline = calculateRoundForecast(gameState)
  const forecast = calculateRoundForecast({ ...gameState, ...decisions })
  assert.equal(forecast.closingState.lean.methods.assembly['method-development'],
    (gameState.lean.methods.assembly['method-development'] ?? 0) + 120)
  assert.equal(forecast.closingState.lean.fiveS.departments.machining.effectiveHours,
    gameState.lean.fiveS.departments.machining.effectiveHours + 50)
  assert.ok(forecast.forecast.knl.assembly.nPct > baseline.forecast.knl.assembly.nPct)
  assert.equal(loadProjectsDecision(gameState.round), null)
})