import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_FACTORY_SETTINGS } from '../factory-settings/defaultFactorySettings.js'
import { createInitialGameState } from '../factory-settings/initialGameState.js'
import { buildFiveSSnapshotFromGameState } from '../forecast/model.js'
import { buildDevelopmentViewModel, normalizeDevelopmentHours } from '../development/model.js'
import fiveSSnapshotFixture from '../../mocks/fiveSSnapshot.json' with { type: 'json' }
import {
  getFiveSLevel,
  applyFiveSInvestment,
  applyFiveSDecay,
  calculateNextFiveSState,
  isFocusBudgetValid,
} from './model.js'

test('5S level thresholds map to exact integer levels', () => {
  assert.equal(getFiveSLevel(0), 0)
  assert.equal(getFiveSLevel(189), 1)
  assert.equal(getFiveSLevel(474), 2)
  assert.equal(getFiveSLevel(711), 3)
  assert.equal(getFiveSLevel(1066), 4)
  assert.equal(getFiveSLevel(1600), 5)
})

test('5S level interpolation returns around 2.53 for 600h', () => {
  const level = getFiveSLevel(600)
  assert.ok(level > 2.52 && level < 2.54)
})

test('0h investment applies 5 percent decay', () => {
  assert.equal(applyFiveSDecay(600), 570)

  const state = calculateNextFiveSState(600, 0)
  assert.equal(state.nextEffectiveHours, 570)
})

test('1h investment does not apply decay', () => {
  const state = calculateNextFiveSState(600, 1)
  assert.equal(state.nextEffectiveHours, 601)
})

test('effective hours are capped to 1600h upper bound', () => {
  assert.equal(applyFiveSInvestment(1599, 50), 1600)
})

test('focus budget validation rejects sums over 400h', () => {
  assert.equal(isFocusBudgetValid({ machining: 200, assembly: 150, shipping: 60 }, 400), false)
  assert.equal(isFocusBudgetValid({ machining: 200, assembly: 150, shipping: 50 }, 400), true)
})

test('five-s max hours override changes the cap', () => {
  const customSettings = {
    ...structuredClone(DEFAULT_FACTORY_SETTINGS),
    lean: {
      ...structuredClone(DEFAULT_FACTORY_SETTINGS.lean),
      fiveS: {
        ...structuredClone(DEFAULT_FACTORY_SETTINGS.lean.fiveS),
        maxHours: 1000,
      },
    },
  }

  const state = calculateNextFiveSState(990, 50, customSettings)

  assert.equal(state.nextEffectiveHours, 1000)
  assert.equal(state.nextLevel < 5, true)
})

test('A) a new game reports 0h of current 5S in every department', () => {
  const snapshot = buildFiveSSnapshotFromGameState(createInitialGameState(), DEFAULT_FACTORY_SETTINGS)
  const hoursByKey = Object.fromEntries(snapshot.departments.map((department) => [department.key, department.fiveSEffectiveHours]))

  assert.deepEqual(hoursByKey, { machining: 0, assembly: 0, shipping: 0 })
})

test('B) a new game reports level 0 in every department', () => {
  const viewModel = buildDevelopmentViewModel(createInitialGameState(), normalizeDevelopmentHours())
  const levelByKey = Object.fromEntries(viewModel.departments.map((department) => [
    department.key,
    department.methods.find((method) => method.key === `${department.key}:five-s`).currentLevel,
  ]))

  assert.deepEqual(levelByKey, { machining: 0, assembly: 0, shipping: 0 })
})

test('C) the canonical snapshot never reflects the mocks/fiveSSnapshot.json fixture values (569/747/417)', () => {
  const snapshot = buildFiveSSnapshotFromGameState(createInitialGameState(), DEFAULT_FACTORY_SETTINGS)
  const hours = snapshot.departments.map((department) => department.fiveSEffectiveHours)

  assert.equal(hours.includes(569), false)
  assert.equal(hours.includes(747), false)
  assert.equal(hours.includes(417), false)
  // Sanity: the fixture itself is untouched and still usable for test scenarios.
  assert.equal(fiveSSnapshotFixture.departments[0].fiveSEffectiveHours, 569)
})

test('D) canonical machining effectiveHours=100 is reflected as the current value, unmodified', () => {
  const gameState = createInitialGameState()
  gameState.lean.fiveS.departments.machining.effectiveHours = 100

  const snapshot = buildFiveSSnapshotFromGameState(gameState, DEFAULT_FACTORY_SETTINGS)
  const machining = snapshot.departments.find((department) => department.key === 'machining')

  assert.equal(machining.fiveSEffectiveHours, 100)
})

test('E) current/decision/preview are kept distinct: current 100h + this-round decision 50h -> preview 150h', () => {
  const gameState = createInitialGameState()
  gameState.lean.fiveS.departments.machining.effectiveHours = 100

  const hours = normalizeDevelopmentHours({ 'machining:five-s': 50 })
  const viewModel = buildDevelopmentViewModel(gameState, hours)
  const machining = viewModel.departments.find((department) => department.key === 'machining')
    .methods.find((method) => method.key === 'machining:five-s')

  assert.equal(machining.currentHours, 100)
  assert.equal(machining.value, 50)
  assert.equal(machining.predictedHours, 150)
})