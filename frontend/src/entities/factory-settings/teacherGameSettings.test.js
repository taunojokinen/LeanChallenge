import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateAllowedNewVariations, calculateRoundForecast } from '../forecast/model.js'
import { createInitialGameState } from './initialGameState.js'
import { DEFAULT_FACTORY_SETTINGS } from './defaultFactorySettings.js'
import {
  TEACHER_SETTING_DEFINITIONS,
  TEACHER_FIXED_STARTING_VALUES,
  TEACHER_SETTINGS_STORAGE_KEY,
  TEACHER_SETTINGS_VERSION,
  buildFactorySettingsSnapshot,
  createDefaultTeacherPreferences,
  getTeacherSelectedValue,
  getTeacherSliderStepCount,
  loadTeacherPreferences,
  resetTeacherPreferences,
  saveTeacherPreferences,
  validateTeacherPreferences,
} from './teacherGameSettings.js'

function createStorage() {
  const values = new Map()
  return {
    getItem(key) {
      return values.get(key) ?? null
    },
    setItem(key, value) {
      values.set(key, value)
    },
  }
}

function preferenceAt(preferences, parameterId, field, value) {
  return {
    ...preferences,
    [parameterId]: {
      ...preferences[parameterId],
      [field]: value,
    },
  }
}

function settingsAtPositions(positions) {
  const preferences = createDefaultTeacherPreferences()
  Object.entries(positions).forEach(([parameterId, position]) => {
    preferences[parameterId].position = position
  })
  return buildFactorySettingsSnapshot(preferences)
}

function forecastFor(settings, gameState = createInitialGameState(settings), productionQuantity = 1000) {
  return calculateRoundForecast(gameState, { market: { productionQuantity } }, settings)
}

test('teacher settings defaults mirror the engine values without changing them', () => {
  const preferences = createDefaultTeacherPreferences()

  assert.equal(getTeacherSelectedValue('annualFixedCosts', preferences), 1000000)
  assert.equal(preferences.annualFixedCosts.easy, 400000)
  assert.equal(preferences.annualFixedCosts.hard, 1000000)
  assert.equal(getTeacherSelectedValue('equity', preferences), 2073975)
  assert.equal(getTeacherSelectedValue('machineCount', preferences), null)
  assert.equal(getTeacherSelectedValue('newMachinePrice', preferences), 500000)
  assert.equal(getTeacherSelectedValue('machiningTimePerUnit', preferences), null)
  assert.equal(getTeacherSelectedValue('hoursPerRound', preferences), null)
  assert.equal(getTeacherSelectedValue('initialSetupTimeHours', preferences), 40)
  assert.equal(getTeacherSelectedValue('initialBatchSize', preferences), 20)
  assert.equal(getTeacherSelectedValue('factoryArea', preferences), 4000)
  assert.equal(getTeacherSelectedValue('knlHalfLifeHours', preferences), 400)
  assert.equal(getTeacherSelectedValue('initialVariations', preferences), null)
  assert.equal(getTeacherSelectedValue('goodQualityThreshold', preferences), 75)
  assert.equal(getTeacherSelectedValue('excellentQualityThreshold', preferences), 80)
  assert.equal(TEACHER_SETTING_DEFINITIONS.length, 9)
  assert.deepEqual(TEACHER_FIXED_STARTING_VALUES.map(({ value }) => value), [4, 12, 20])
  for (const definition of TEACHER_SETTING_DEFINITIONS) {
    const selected = getTeacherSelectedValue(definition.id, preferences)
    assert.ok(selected >= definition.min && selected <= definition.max, definition.id)
    assert.ok(preferences[definition.id].easy >= definition.min, `${definition.id} minimum`)
    assert.ok(preferences[definition.id].hard <= definition.max, `${definition.id} maximum`)
  }
  assert.equal(DEFAULT_FACTORY_SETTINGS.costs.annualFixedCosts, 4000000)
  assert.equal(DEFAULT_FACTORY_SETTINGS.knl.knlHalfLifeHours, 400)
  assert.equal(DEFAULT_FACTORY_SETTINGS.initialState.production.machiningMachines, 4)
  assert.equal(DEFAULT_FACTORY_SETTINGS.production.departments.machining.normHoursPerContainer, 12)
  assert.equal(DEFAULT_FACTORY_SETTINGS.initialState.market.activeVariations, 20)
})

test('slider bounds use configured increments and support either numeric direction', () => {
  const preferences = createDefaultTeacherPreferences()

  assert.equal(getTeacherSliderStepCount('annualFixedCosts', preferences), 48)
  assert.equal(getTeacherSliderStepCount('knlHalfLifeHours', preferences), 12)
  assert.equal(getTeacherSelectedValue('knlHalfLifeHours', preferenceAt(preferences, 'knlHalfLifeHours', 'position', 0)), 300)
  assert.equal(getTeacherSelectedValue('knlHalfLifeHours', preferenceAt(preferences, 'knlHalfLifeHours', 'position', 12)), 600)
  assert.equal(getTeacherSliderStepCount('machineCount', preferences), null)
  assert.equal(getTeacherSliderStepCount('machiningTimePerUnit', preferences), null)
  assert.equal(getTeacherSliderStepCount('initialVariations', preferences), null)
})

test('teacher setting limits match the updated range table', () => {
  const ranges = Object.fromEntries(
    TEACHER_SETTING_DEFINITIONS.map(({ id, min, max }) => [id, [min, max]]),
  )

  assert.deepEqual(ranges.annualFixedCosts, [400000, 1000000])
  assert.deepEqual(ranges.equity, [2000000, 4000000])
  assert.deepEqual(ranges.initialSetupTimeHours, [40, 80])
  assert.deepEqual(ranges.initialBatchSize, [10, 20])
  assert.deepEqual(ranges.factoryArea, [4000, 5000])
  assert.deepEqual(ranges.knlHalfLifeHours, [300, 600])
  assert.deepEqual(ranges.goodQualityThreshold, [75, 80])
  assert.deepEqual(ranges.excellentQualityThreshold, [80, 85])
})

test('every slider reaches its easy and hard boundaries in exact configured steps', () => {
  const preferences = createDefaultTeacherPreferences()

  TEACHER_SETTING_DEFINITIONS.forEach((definition) => {
    const steps = getTeacherSliderStepCount(definition.id, preferences)
    assert.ok(steps > 0, definition.id)
    assert.equal(
      getTeacherSelectedValue(definition.id, preferenceAt(preferences, definition.id, 'position', 0)),
      preferences[definition.id].easy,
      `${definition.id} easy endpoint`,
    )
    assert.equal(
      getTeacherSelectedValue(definition.id, preferenceAt(preferences, definition.id, 'position', steps)),
      preferences[definition.id].hard,
      `${definition.id} hard endpoint`,
    )
  })
})

test('validation rejects out-of-range, off-step, and reversed quality thresholds', () => {
  const preferences = createDefaultTeacherPreferences()
  assert.equal(validateTeacherPreferences(preferences).valid, true)

  const equalQualityThresholds = {
    ...preferences,
    goodQualityThreshold: { ...preferences.goodQualityThreshold, position: 5 },
    excellentQualityThreshold: { ...preferences.excellentQualityThreshold, position: 0 },
  }
  assert.equal(validateTeacherPreferences(equalQualityThresholds).valid, true)

  const invalidStep = preferenceAt(preferences, 'initialBatchSize', 'easy', 10.5)
  assert.equal(validateTeacherPreferences(invalidStep).valid, false)

  const outOfRange = preferenceAt(preferences, 'annualFixedCosts', 'easy', -50000)
  assert.equal(validateTeacherPreferences(outOfRange).valid, false)

  const invalidQuality = {
    ...preferences,
    goodQualityThreshold: { ...preferences.goodQualityThreshold, position: 5 },
    excellentQualityThreshold: { ...preferences.excellentQualityThreshold, easy: 79, position: 0 },
  }
  assert.equal(validateTeacherPreferences(invalidQuality).valid, false)
  assert.equal(
    validateTeacherPreferences(invalidQuality).errors.some((error) => error.id === 'qualityThresholds'),
    true,
  )
})

test('localStorage favorites are versioned and restore the last slider position', () => {
  const storage = createStorage()
  const preferences = preferenceAt(
    createDefaultTeacherPreferences(),
    'initialSetupTimeHours',
    'position',
    20,
  )

  saveTeacherPreferences(preferences, storage)
  const stored = JSON.parse(storage.getItem(TEACHER_SETTINGS_STORAGE_KEY))
  assert.equal(stored.version, TEACHER_SETTINGS_VERSION)
  assert.equal(stored.preferences.initialSetupTimeHours.position, 20)
  assert.deepEqual(loadTeacherPreferences(storage), preferences)
})

test('reset stores a fresh copy of the engine-based defaults', () => {
  const storage = createStorage()
  saveTeacherPreferences(
    preferenceAt(createDefaultTeacherPreferences(), 'initialSetupTimeHours', 'position', 4),
    storage,
  )

  const restored = resetTeacherPreferences(storage)
  assert.equal(getTeacherSelectedValue('initialSetupTimeHours', restored), 40)
  assert.deepEqual(loadTeacherPreferences(storage), restored)
})

test('game settings snapshot applies selected values to a clone only', () => {
  const originalDefaults = structuredClone(DEFAULT_FACTORY_SETTINGS)
  const preferences = createDefaultTeacherPreferences()
  preferences.annualFixedCosts.position = 0
  preferences.newMachinePrice.position = 0
  preferences.knlHalfLifeHours.position = 0
  preferences.initialSetupTimeHours.position = 0
  preferences.goodQualityThreshold.position = 1
  preferences.excellentQualityThreshold.position = 1

  const snapshot = buildFactorySettingsSnapshot(preferences)
  const gameStart = createInitialGameState(snapshot)
  assert.notStrictEqual(snapshot, DEFAULT_FACTORY_SETTINGS)
  assert.equal(snapshot.costs.annualFixedCosts, 1600000)
  assert.equal(snapshot.initialState.production.machiningMachines, 4)
  assert.equal(gameStart.staffing.machining, 20)
  assert.equal(snapshot.investments.newMachine.price, 250000)
  assert.equal(snapshot.production.departments.machining.normHoursPerContainer, 12)
  assert.equal(snapshot.production.hoursPerMachinePerRound, 1040)
  assert.equal(snapshot.production.hoursPerWorkerPerRound, 1040)
  assert.equal(snapshot.game.hoursPerMachinePerRound, 1040)
  assert.equal(snapshot.game.hoursPerWorkerPerRound, 1040)
  assert.equal(snapshot.knl.knlHalfLifeHours, 300)
  assert.equal(snapshot.initialState.market.activeVariations, 20)
  assert.equal(snapshot.initialState.factory.totalAreaM2, 4000)
  assert.equal(snapshot.initialState.finance.equity, 2073975)
  assert.equal(snapshot.lean.smed.initialSetupTimeHours, 40)
  assert.equal(snapshot.variationRules.minimumQualityForZeroAdditionalVariations, 0.76)
  assert.equal(snapshot.variationRules.oneVariationMinQuality, 0.81)
  assert.equal(snapshot.variationRules.minimumQualityForOneAdditionalVariation, 0.75)
  preferences.knlHalfLifeHours.position = 12
  assert.equal(snapshot.knl.knlHalfLifeHours, 300)
  assert.deepEqual(DEFAULT_FACTORY_SETTINGS, originalDefaults)
  assert.equal(DEFAULT_FACTORY_SETTINGS.costs.annualFixedCosts, 4000000)
  assert.equal(DEFAULT_FACTORY_SETTINGS.initialState.production.machiningMachines, 4)
})

test('KNL half-life override affects forecast development and leaves Quest defaults intact', () => {
  const teacherSettings = settingsAtPositions({ knlHalfLifeHours: 0 })
  const slowerSettings = settingsAtPositions({ knlHalfLifeHours: 12 })
  const teacherState = createInitialGameState(teacherSettings)
  teacherState.lean.methods.machining.tpm = 800
  const slowerState = createInitialGameState(slowerSettings)
  slowerState.lean.methods.machining.tpm = 800
  const teacherForecast = forecastFor(teacherSettings, teacherState)
  const slowerForecast = forecastFor(slowerSettings, slowerState)

  assert.ok(
    teacherForecast.forecast.knl.machining.kMachiningDevelopedPct >
      slowerForecast.forecast.knl.machining.kMachiningDevelopedPct,
  )
  assert.ok(
    teacherForecast.forecast.knl.machining.capacityContainers >
      slowerForecast.forecast.knl.machining.capacityContainers,
  )
  assert.ok(teacherForecast.summary.plantCapacity > 0)
  assert.equal(DEFAULT_FACTORY_SETTINGS.knl.knlHalfLifeHours, 400)
  assert.equal(createInitialGameState().production.machiningMachines, 4)
})

test('four fixed machines, fixed machining time, SMED setup time, and batch size affect matching capacities', () => {
  const defaultSettings = DEFAULT_FACTORY_SETTINGS
  const baseState = createInitialGameState(defaultSettings)
  const baseForecast = forecastFor(defaultSettings, baseState, 1000)

  const twoMachineState = {
    ...baseState,
    production: { ...baseState.production, machiningMachines: 2 },
    staffing: { ...baseState.staffing, machining: 10 },
  }
  const twoMachineForecast = forecastFor(defaultSettings, twoMachineState, 1000)
  assert.equal(baseState.production.machiningMachines, 4)
  assert.equal(baseState.staffing.machining, 20)
  assert.ok(baseForecast.forecast.knl.machining.capacityContainers > twoMachineForecast.forecast.knl.machining.capacityContainers)

  const alternateNormSettings = structuredClone(defaultSettings)
  alternateNormSettings.production.departments.machining.normHoursPerContainer = 6
  const alternateNormForecast = forecastFor(alternateNormSettings, createInitialGameState(alternateNormSettings), 1000)
  assert.equal(defaultSettings.production.departments.machining.normHoursPerContainer, 12)
  assert.equal(baseForecast.forecast.knl.machining.capacityContainers < alternateNormForecast.forecast.knl.machining.capacityContainers, true)
  assert.equal(defaultSettings.production.hoursPerMachinePerRound, 1040)

  const fastSetupSettings = settingsAtPositions({ initialSetupTimeHours: 0 })
  const slowSetupSettings = settingsAtPositions({ initialSetupTimeHours: 80 })
  const fastSetupForecast = forecastFor(fastSetupSettings, createInitialGameState(fastSetupSettings), 1000)
  const slowSetupForecast = forecastFor(slowSetupSettings, createInitialGameState(slowSetupSettings), 1000)
  assert.ok(fastSetupForecast.forecast.knl.machining.capacityContainers > slowSetupForecast.forecast.knl.machining.capacityContainers)

  const smallBatchSettings = settingsAtPositions({ initialBatchSize: 0 })
  const largeBatchSettings = settingsAtPositions({ initialBatchSize: 10 })
  const smallBatchForecast = forecastFor(smallBatchSettings, createInitialGameState(smallBatchSettings), 1000)
  const largeBatchForecast = forecastFor(largeBatchSettings, createInitialGameState(largeBatchSettings), 1000)
  assert.ok(largeBatchForecast.forecast.knl.machining.capacityContainers > smallBatchForecast.forecast.knl.machining.capacityContainers)
  assert.ok(smallBatchForecast.forecast.inventory.minimumFinishedGoodsInventory < largeBatchForecast.forecast.inventory.minimumFinishedGoodsInventory)
})

test('fixed costs change result and selected equity enters the new game opening balance', () => {
  const lowCostSettings = settingsAtPositions({ annualFixedCosts: 0, equity: 0 })
  const highCostSettings = settingsAtPositions({ annualFixedCosts: 48 })
  const lowCostForecast = forecastFor(lowCostSettings, createInitialGameState(lowCostSettings))
  const highCostForecast = forecastFor(highCostSettings, createInitialGameState(highCostSettings))
  const costDifference = highCostForecast.forecast.finance.fixedCosts - lowCostForecast.forecast.finance.fixedCosts

  assert.equal(costDifference, 600000)
  assert.ok(Math.abs(lowCostForecast.closingState.finance.equity -
    lowCostSettings.initialState.finance.equity - lowCostForecast.forecast.finance.result) < 1e-7)
  assert.ok(Math.abs(createInitialGameState(lowCostSettings).finance.equity - 2000000) < 1e-7)
})

test('fixed costs use quarterly values in preferences and convert back to annual snapshot values', () => {
  const preferences = createDefaultTeacherPreferences()
  assert.equal(getTeacherSelectedValue('annualFixedCosts', preferences), 1000000)
  assert.equal(preferences.annualFixedCosts.easy, 400000)
  assert.equal(preferences.annualFixedCosts.hard, 1000000)

  preferences.annualFixedCosts.position = 28
  const snapshot = buildFactorySettingsSnapshot(preferences)
  assert.equal(getTeacherSelectedValue('annualFixedCosts', preferences), 750000)
  assert.equal(snapshot.costs.annualFixedCosts, 3000000)

  const defaultForecast = forecastFor(DEFAULT_FACTORY_SETTINGS, createInitialGameState())
  assert.equal(defaultForecast.forecast.finance.fixedCosts, 1000000)
  assert.equal(DEFAULT_FACTORY_SETTINGS.costs.annualFixedCosts, 4000000)
})

test('factory area and machine price reach forecast inputs while variations stay fixed', () => {
  const compactSettings = settingsAtPositions({ factoryArea: 0 })
  const spaciousSettings = settingsAtPositions({ factoryArea: 10 })
  const spaciousForecast = forecastFor(spaciousSettings, createInitialGameState(spaciousSettings))
  const compactForecast = forecastFor(compactSettings, createInitialGameState(compactSettings))
  assert.equal(spaciousForecast.forecast.space.totalArea, 5000)
  assert.equal(compactForecast.forecast.space.totalArea, 4000)
  assert.ok(spaciousForecast.forecast.space.freeFactorySpace > compactForecast.forecast.space.freeFactorySpace)

  const cheapMachineSettings = settingsAtPositions({ newMachinePrice: 0 })
  const expensiveMachineSettings = settingsAtPositions({ newMachinePrice: 30 })
  const machineState = createInitialGameState(cheapMachineSettings)
  machineState.investmentsDecision = {
    round: machineState.round,
    investments: [{ type: 'new-machine', quantity: 1 }],
  }
  const cheapMachineForecast = forecastFor(cheapMachineSettings, machineState)
  const expensiveMachineForecast = forecastFor(expensiveMachineSettings, {
    ...machineState,
    investmentsSnapshot: undefined,
  })
  assert.equal(cheapMachineForecast.forecast.investments.totalCost, 250000)
  assert.equal(expensiveMachineForecast.forecast.investments.totalCost, 1000000)

  const initialState = createInitialGameState()
  const initialForecast = forecastFor(DEFAULT_FACTORY_SETTINGS, initialState)
  assert.equal(initialState.market.activeVariations, 20)
  assert.equal(initialForecast.decisions.market.activeVariationCount, 20)
})

test('quality thresholds remain ordered and determine zero, one, or two additional variations', () => {
  const preferences = createDefaultTeacherPreferences()
  const snapshot = buildFactorySettingsSnapshot(preferences)
  const goodQuality = TEACHER_SETTING_DEFINITIONS.find((definition) => definition.id === 'goodQualityThreshold')
  const excellentQuality = TEACHER_SETTING_DEFINITIONS.find((definition) => definition.id === 'excellentQualityThreshold')

  assert.equal(goodQuality.min, 75)
  assert.equal(goodQuality.max, 80)
  assert.equal(excellentQuality.min, 80)
  assert.equal(excellentQuality.max, 85)
  assert.equal(calculateAllowedNewVariations(74, snapshot), 0)
  assert.equal(calculateAllowedNewVariations(75, snapshot), 1)
  assert.equal(calculateAllowedNewVariations(80, snapshot), 2)
})

test('version 2 favorites migrate to the current bounded settings and discard fixed-setting preferences', () => {
  const storage = createStorage()
  const oldPreferences = createDefaultTeacherPreferences()
  oldPreferences.annualFixedCosts = { easy: 2000000, hard: 8000000, position: 40 }
  oldPreferences.initialBatchSize.position = 5
  oldPreferences.machineCount = { easy: 4, hard: 1, position: 1 }
  oldPreferences.machiningTimePerUnit = { easy: 4, hard: 8, position: 2 }
  oldPreferences.initialVariations = { easy: 15, hard: 25, position: 5 }
  oldPreferences.hoursPerRound = { easy: 1280, hard: 780, position: 10 }
  storage.setItem(TEACHER_SETTINGS_STORAGE_KEY, JSON.stringify({
    version: 2,
    preferences: oldPreferences,
  }))

  const migrated = loadTeacherPreferences(storage)
  const storedV4 = JSON.parse(storage.getItem(TEACHER_SETTINGS_STORAGE_KEY))
  assert.equal(TEACHER_SETTINGS_VERSION, 4)
  assert.equal(storedV4.version, 4)
  assert.deepEqual(migrated.annualFixedCosts, { easy: 500000, hard: 1000000, position: 40 })
  assert.equal(getTeacherSelectedValue('annualFixedCosts', migrated), 1000000)
  assert.equal(getTeacherSelectedValue('initialBatchSize', migrated), 15)
  assert.equal('machineCount' in migrated, false)
  assert.equal('machiningTimePerUnit' in migrated, false)
  assert.equal('initialVariations' in migrated, false)
  assert.equal('hoursPerRound' in migrated, false)

  assert.deepEqual(loadTeacherPreferences(storage), migrated)
  assert.deepEqual(JSON.parse(storage.getItem(TEACHER_SETTINGS_STORAGE_KEY)), storedV4)
})

test('out-of-range version 3 favorites migrate safely into new bounds', () => {
  const storage = createStorage()
  const invalidPreferences = createDefaultTeacherPreferences()
  invalidPreferences.annualFixedCosts = { easy: 0, hard: 2000000, position: 20 }
  invalidPreferences.equity = { easy: 3073975, hard: 1073975, position: 40 }
  invalidPreferences.initialSetupTimeHours = { easy: 5, hard: 20, position: 10 }
  invalidPreferences.machineCount = { easy: 1, hard: 10, position: 2 }
  storage.setItem(TEACHER_SETTINGS_STORAGE_KEY, JSON.stringify({
    version: 3,
    preferences: invalidPreferences,
  }))

  const restored = loadTeacherPreferences(storage)
  assert.equal(restored.annualFixedCosts.easy, 400000)
  assert.equal(restored.annualFixedCosts.hard, 1000000)
  assert.equal(getTeacherSelectedValue('annualFixedCosts', restored), 400000)
  assert.equal(getTeacherSelectedValue('equity', restored), 2073975)
  assert.equal(getTeacherSelectedValue('initialSetupTimeHours', restored), 40)
  assert.equal('machineCount' in restored, false)
  assert.equal(JSON.parse(storage.getItem(TEACHER_SETTINGS_STORAGE_KEY)).version, 4)
  assert.deepEqual(loadTeacherPreferences(storage), restored)
})