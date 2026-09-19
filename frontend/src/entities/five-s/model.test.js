import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_FACTORY_SETTINGS } from '../factory-settings/defaultFactorySettings.js'
import { createInitialGameState } from '../factory-settings/initialGameState.js'
import { buildFiveSSnapshotFromGameState } from '../forecast/model.js'
import fiveSSnapshotFixture from '../../mocks/fiveSSnapshot.json' with { type: 'json' }
import {
  getFiveSLevel,
  applyFiveSInvestment,
  applyFiveSDecay,
  calculateNextFiveSState,
  isFocusBudgetValid,
  buildFiveSViewModel,
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

// Regression: FiveSPage/view model must read canonical gameState, never the static mock fixture.
function buildViewModelForGameState(gameState, decision = null, investedHours = { machining: 0, assembly: 0, shipping: 0 }) {
  const snapshot = buildFiveSSnapshotFromGameState(gameState, DEFAULT_FACTORY_SETTINGS)
  return buildFiveSViewModel(snapshot, decision, investedHours, DEFAULT_FACTORY_SETTINGS)
}

test('A) a new game reports 0h of current 5S in every department', () => {
  const viewModel = buildViewModelForGameState(createInitialGameState())
  const hoursByKey = Object.fromEntries(viewModel.departments.map((d) => [d.key, d.currentEffectiveHours]))

  assert.deepEqual(hoursByKey, { machining: 0, assembly: 0, shipping: 0 })
})

test('B) a new game reports level 0 in every department', () => {
  const viewModel = buildViewModelForGameState(createInitialGameState())
  const levelByKey = Object.fromEntries(viewModel.departments.map((d) => [d.key, d.currentLevel]))

  assert.deepEqual(levelByKey, { machining: 0, assembly: 0, shipping: 0 })
})

test('C) the view model never reflects the mocks/fiveSSnapshot.json fixture values (569/747/417)', () => {
  const viewModel = buildViewModelForGameState(createInitialGameState())
  const hours = viewModel.departments.map((d) => d.currentEffectiveHours)

  assert.equal(hours.includes(569), false)
  assert.equal(hours.includes(747), false)
  assert.equal(hours.includes(417), false)
  // Sanity: the fixture itself is untouched and still usable for test scenarios.
  assert.equal(fiveSSnapshotFixture.departments[0].fiveSEffectiveHours, 569)
})

test('D) canonical machining effectiveHours=100 is reflected as the current value, unmodified', () => {
  const gameState = createInitialGameState()
  gameState.lean.fiveS.departments.machining.effectiveHours = 100

  const viewModel = buildViewModelForGameState(gameState)
  const machining = viewModel.departments.find((d) => d.key === 'machining')

  assert.equal(machining.currentEffectiveHours, 100)
})

test('E) current/decision/preview are kept distinct: current 100h + this-round decision 50h -> preview 150h', () => {
  const gameState = createInitialGameState()
  gameState.lean.fiveS.departments.machining.effectiveHours = 100

  const viewModel = buildViewModelForGameState(gameState, null, { machining: 50, assembly: 0, shipping: 0 })
  const machining = viewModel.departments.find((d) => d.key === 'machining')

  assert.equal(machining.currentEffectiveHours, 100)
  assert.equal(machining.investedHours, 50)
  assert.equal(machining.nextEffectiveHours, 150)
})

test('F) the displayed level uses the same developmentLevel settings as the canonical model', () => {
  const customSettings = {
    ...structuredClone(DEFAULT_FACTORY_SETTINGS),
    lean: {
      ...structuredClone(DEFAULT_FACTORY_SETTINGS.lean),
      developmentLevel: { baseHours: 10, multiplier: 2 },
    },
  }
  const gameState = createInitialGameState()
  gameState.lean.fiveS.departments.machining.effectiveHours = 10

  const defaultLevel = buildViewModelForGameState(gameState).departments.find((d) => d.key === 'machining').currentLevel

  const snapshot = buildFiveSSnapshotFromGameState(gameState, customSettings)
  const customLevel = buildFiveSViewModel(
    snapshot,
    null,
    { machining: 0, assembly: 0, shipping: 0 },
    customSettings,
  ).departments.find((d) => d.key === 'machining').currentLevel

  // 10h is below the default baseHours (100) -> level 0, but exactly at the custom baseHours (10) -> level 1.
  assert.equal(defaultLevel, 0)
  assert.equal(customLevel, 1)
})