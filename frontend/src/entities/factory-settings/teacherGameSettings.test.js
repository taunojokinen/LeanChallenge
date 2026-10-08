import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateAllowedNewVariations, calculateRoundForecast } from '../forecast/model.js'
import { createInitialGameState } from './initialGameState.js'
import { DEFAULT_FACTORY_SETTINGS } from './defaultFactorySettings.js'
import {
  TEACHER_SETTING_DEFINITIONS,
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
  assert.equal(preferences.annualFixedCosts.easy, 500000)
  assert.equal(preferences.annualFixedCosts.hard, 2000000)
  assert.equal(getTeacherSelectedValue('equity', preferences), 2073975)
  assert.equal(getTeacherSelectedValue('machineCount', preferences), 2)
  assert.equal(getTeacherSelectedValue('newMachinePrice', preferences), 500000)
  assert.equal(getTeacherSelectedValue('machiningTimePerUnit', preferences), 6)
  assert.equal(getTeacherSelectedValue('hoursPerRound', preferences), null)
  assert.equal(getTeacherSelectedValue('initialSetupTimeHours', preferences), 10)
  assert.equal(getTeacherSelectedValue('initialBatchSize', preferences), 20)
  assert.equal(getTeacherSelectedValue('factoryArea', preferences), 4000)
  assert.equal(getTeacherSelectedValue('knlHalfLifeHours', preferences), 400)
  assert.equal(getTeacherSelectedValue('initialVariations', preferences), 20)
  assert.equal(getTeacherSelectedValue('goodQualityThreshold', preferences), 75)
  assert.equal(getTeacherSelectedValue('excellentQualityThreshold', preferences), 80)
  assert.equal(TEACHER_SETTING_DEFINITIONS.length, 12)
  assert.equal(DEFAULT_FACTORY_SETTINGS.costs.annualFixedCosts, 4000000)
  assert.equal(DEFAULT_FACTORY_SETTINGS.knl.knlHalfLifeHours, 400)
})

test('slider bounds use configured increments and support either numeric direction', () => {
  const preferences = createDefaultTeacherPreferences()

  assert.equal(getTeacherSliderStepCount('machineCount', preferences), 3)
  assert.equal(getTeacherSliderStepCount('annualFixedCosts', preferences), 120)
  assert.equal(getTeacherSliderStepCount('machiningTimePerUnit', preferences), 8)
  assert.equal(getTeacherSelectedValue('machiningTimePerUnit', preferences), 6)
  assert.equal(getTeacherSelectedValue('machiningTimePerUnit', preferenceAt(preferences, 'machiningTimePerUnit', 'position', 0)), 4)
  assert.equal(getTeacherSelectedValue('machiningTimePerUnit', preferenceAt(preferences, 'machiningTimePerUnit', 'position', 8)), 8)
  assert.equal(getTeacherSelectedValue('knlHalfLifeHours', preferenceAt(preferences, 'knlHalfLifeHours', 'position', 0)), 200)
  assert.equal(getTeacherSelectedValue('knlHalfLifeHours', preferenceAt(preferences, 'knlHalfLifeHours', 'position', 24)), 800)
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

  const invalidStep = preferenceAt(preferences, 'initialBatchSize', 'easy', 10.5)
  assert.equal(validateTeacherPreferences(invalidStep).valid, false)

  const outOfRange = preferenceAt(preferences, 'annualFixedCosts', 'easy', -50000)
  assert.equal(validateTeacherPreferences(outOfRange).valid, false)

  const invalidQuality = preferenceAt(preferences, 'goodQualityThreshold', 'easy', 80)
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
    'hoursPerRound',
    'position',
    10,
  )

  saveTeacherPreferences(preferences, storage)
  const stored = JSON.parse(storage.getItem(TEACHER_SETTINGS_STORAGE_KEY))
  assert.equal(stored.version, TEACHER_SETTINGS_VERSION)
  assert.equal(stored.preferences.hoursPerRound.position, 10)
  assert.deepEqual(loadTeacherPreferences(storage), preferences)
})

test('reset stores a fresh copy of the engine-based defaults', () => {
  const storage = createStorage()
  saveTeacherPreferences(
    preferenceAt(createDefaultTeacherPreferences(), 'machiningTimePerUnit', 'position', 0),
    storage,
  )

  const restored = resetTeacherPreferences(storage)
  assert.equal(getTeacherSelectedValue('machiningTimePerUnit', restored), 6)
  assert.deepEqual(loadTeacherPreferences(storage), restored)
})

test('game settings snapshot applies selected values to a clone only', () => {
  const originalDefaults = structuredClone(DEFAULT_FACTORY_SETTINGS)
  const preferences = createDefaultTeacherPreferences()
  preferences.annualFixedCosts.position = 0
  preferences.machineCount.position = 0
  preferences.newMachinePrice.position = 0
  preferences.machiningTimePerUnit.position = 0
  preferences.knlHalfLifeHours.position = 0
  preferences.initialVariations.position = 10
  preferences.goodQualityThreshold.position = 6
  preferences.excellentQualityThreshold.position = 10

  const snapshot = buildFactorySettingsSnapshot(preferences)
  const gameStart = createInitialGameState(snapshot)
  assert.notStrictEqual(snapshot, DEFAULT_FACTORY_SETTINGS)
  assert.equal(snapshot.costs.annualFixedCosts, 2000000)
  assert.equal(snapshot.initialState.production.machiningMachines, 4)
  assert.equal(gameStart.staffing.machining, 20)
  assert.equal(snapshot.investments.newMachine.price, 250000)
  assert.equal(snapshot.production.departments.machining.normHoursPerContainer, 4)
  assert.equal(snapshot.production.hoursPerMachinePerRound, 1040)
  assert.equal(snapshot.production.hoursPerWorkerPerRound, 1040)
  assert.equal(snapshot.game.hoursPerMachinePerRound, 1040)
  assert.equal(snapshot.game.hoursPerWorkerPerRound, 1040)
  assert.equal(snapshot.knl.knlHalfLifeHours, 200)
  assert.equal(snapshot.initialState.market.activeVariations, 25)
  assert.equal(snapshot.initialState.factory.totalAreaM2, 4000)
  assert.equal(snapshot.initialState.finance.equity, 2073975)
  assert.equal(snapshot.lean.smed.initialSetupTimeHours, 10)
  assert.equal(snapshot.variationRules.minimumQualityForZeroAdditionalVariations, 0.76)
  assert.equal(snapshot.variationRules.oneVariationMinQuality, 0.85)
  assert.equal(snapshot.variationRules.minimumQualityForOneAdditionalVariation, 0.75)
  preferences.knlHalfLifeHours.position = 24
  assert.equal(snapshot.knl.knlHalfLifeHours, 200)
  assert.deepEqual(DEFAULT_FACTORY_SETTINGS, originalDefaults)
  assert.equal(DEFAULT_FACTORY_SETTINGS.costs.annualFixedCosts, 4000000)
  assert.equal(DEFAULT_FACTORY_SETTINGS.initialState.production.machiningMachines, 2)
})

test('KNL half-life override affects forecast development and leaves Quest defaults intact', () => {
  const teacherSettings = settingsAtPositions({ knlHalfLifeHours: 0, machineCount: 3 })
  const slowerSettings = settingsAtPositions({ knlHalfLifeHours: 24, machineCount: 3 })
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
  assert.equal(createInitialGameState().production.machiningMachines, 2)
})

test('machine count, machining time, SMED setup time, and batch size change the matching capacities', () => {
  const defaultSettings = DEFAULT_FACTORY_SETTINGS
  const baseState = createInitialGameState(defaultSettings)
  const baseForecast = forecastFor(defaultSettings, baseState, 1000)

  const machineSettings = settingsAtPositions({ machineCount: 0 })
  const machineForecast = forecastFor(machineSettings, createInitialGameState(machineSettings), 1000)
  assert.ok(machineForecast.forecast.knl.machining.capacityContainers > baseForecast.forecast.knl.machining.capacityContainers)

  const easyMachiningSettings = settingsAtPositions({ machiningTimePerUnit: 0 })
  const hardMachiningSettings = settingsAtPositions({ machiningTimePerUnit: 8 })
  const easyMachiningForecast = forecastFor(easyMachiningSettings, createInitialGameState(easyMachiningSettings), 1000)
  const hardMachiningForecast = forecastFor(hardMachiningSettings, createInitialGameState(hardMachiningSettings), 1000)
  assert.equal(easyMachiningSettings.production.hoursPerMachinePerRound, 1040)
  assert.equal(easyMachiningSettings.production.hoursPerWorkerPerRound, 1040)
  assert.equal(hardMachiningSettings.production.hoursPerMachinePerRound, 1040)
  assert.equal(hardMachiningSettings.production.hoursPerWorkerPerRound, 1040)
  assert.ok(easyMachiningForecast.forecast.knl.machining.capacityContainers > hardMachiningForecast.forecast.knl.machining.capacityContainers)

  const fastSetupSettings = settingsAtPositions({ initialSetupTimeHours: 0 })
  const slowSetupSettings = settingsAtPositions({ initialSetupTimeHours: 30 })
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
  const highCostSettings = settingsAtPositions({ annualFixedCosts: 120 })
  const lowCostForecast = forecastFor(lowCostSettings, createInitialGameState(lowCostSettings))
  const highCostForecast = forecastFor(highCostSettings, createInitialGameState(highCostSettings))
  const costDifference = highCostForecast.forecast.finance.fixedCosts - lowCostForecast.forecast.finance.fixedCosts

  assert.equal(costDifference, 1500000)
  assert.equal(lowCostForecast.closingState.finance.equity, lowCostSettings.initialState.finance.equity + lowCostForecast.forecast.finance.result)
  assert.equal(createInitialGameState(lowCostSettings).finance.equity, 3073975)
})

test('fixed costs use quarterly values in preferences and convert back to annual snapshot values', () => {
  const preferences = createDefaultTeacherPreferences()
  assert.equal(getTeacherSelectedValue('annualFixedCosts', preferences), 1000000)
  assert.equal(preferences.annualFixedCosts.easy, 500000)
  assert.equal(preferences.annualFixedCosts.hard, 2000000)

  preferences.annualFixedCosts.position = 20
  const snapshot = buildFactorySettingsSnapshot(preferences)
  assert.equal(getTeacherSelectedValue('annualFixedCosts', preferences), 750000)
  assert.equal(snapshot.costs.annualFixedCosts, 3000000)

  const defaultForecast = forecastFor(DEFAULT_FACTORY_SETTINGS, createInitialGameState())
  assert.equal(defaultForecast.forecast.finance.fixedCosts, 1000000)
  assert.equal(DEFAULT_FACTORY_SETTINGS.costs.annualFixedCosts, 4000000)
})

test('factory area, machine price, and starting variations reach forecast inputs', () => {
  const spaciousSettings = settingsAtPositions({ factoryArea: 0 })
  const compactSettings = settingsAtPositions({ factoryArea: 35 })
  const spaciousForecast = forecastFor(spaciousSettings, createInitialGameState(spaciousSettings))
  const compactForecast = forecastFor(compactSettings, createInitialGameState(compactSettings))
  assert.equal(spaciousForecast.forecast.space.totalArea, 6000)
  assert.equal(compactForecast.forecast.space.totalArea, 2500)
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

  const fewerVariationsSettings = settingsAtPositions({ initialVariations: 0 })
  const moreVariationsSettings = settingsAtPositions({ initialVariations: 10 })
  const fewerVariationsForecast = forecastFor(fewerVariationsSettings, createInitialGameState(fewerVariationsSettings))
  const moreVariationsForecast = forecastFor(moreVariationsSettings, createInitialGameState(moreVariationsSettings))
  assert.equal(fewerVariationsForecast.decisions.market.activeVariationCount, 15)
  assert.equal(moreVariationsForecast.decisions.market.activeVariationCount, 25)
  assert.ok(moreVariationsForecast.summary.demand > fewerVariationsForecast.summary.demand)
})

test('quality thresholds remain ordered and determine zero, one, or two additional variations', () => {
  const preferences = createDefaultTeacherPreferences()
  const snapshot = buildFactorySettingsSnapshot(preferences)
  const goodQuality = TEACHER_SETTING_DEFINITIONS.find((definition) => definition.id === 'goodQualityThreshold')
  const excellentQuality = TEACHER_SETTING_DEFINITIONS.find((definition) => definition.id === 'excellentQualityThreshold')

  assert.equal(goodQuality.max, 95)
  assert.equal(excellentQuality.max, 95)
  assert.equal(calculateAllowedNewVariations(74, snapshot), 0)
  assert.equal(calculateAllowedNewVariations(75, snapshot), 1)
  assert.equal(calculateAllowedNewVariations(80, snapshot), 2)
})

test('version 2 annual fixed-cost favorites migrate once while preserving other favorites', () => {
  const storage = createStorage()
  const oldPreferences = createDefaultTeacherPreferences()
  oldPreferences.annualFixedCosts = { easy: 2000000, hard: 8000000, position: 40 }
  oldPreferences.machineCount.position = 1
  oldPreferences.hoursPerRound = { easy: 1280, hard: 780, position: 10 }
  storage.setItem(TEACHER_SETTINGS_STORAGE_KEY, JSON.stringify({
    version: 2,
    preferences: oldPreferences,
  }))

  const migrated = loadTeacherPreferences(storage)
  const storedV3 = JSON.parse(storage.getItem(TEACHER_SETTINGS_STORAGE_KEY))
  assert.equal(TEACHER_SETTINGS_VERSION, 3)
  assert.equal(storedV3.version, 3)
  assert.deepEqual(migrated.annualFixedCosts, { easy: 500000, hard: 2000000, position: 40 })
  assert.equal(getTeacherSelectedValue('annualFixedCosts', migrated), 1000000)
  assert.deepEqual(migrated.machineCount, oldPreferences.machineCount)
  assert.deepEqual(migrated.hoursPerRound, oldPreferences.hoursPerRound)
  assert.deepEqual(migrated.machiningTimePerUnit, oldPreferences.machiningTimePerUnit)

  assert.deepEqual(loadTeacherPreferences(storage), migrated)
  assert.deepEqual(JSON.parse(storage.getItem(TEACHER_SETTINGS_STORAGE_KEY)), storedV3)
})

test('invalid version 2 fixed-cost favorites use version 3 safe defaults', () => {
  const storage = createStorage()
  const invalidPreferences = createDefaultTeacherPreferences()
  invalidPreferences.annualFixedCosts = { easy: 2000001, hard: 8000000, position: 0 }
  storage.setItem(TEACHER_SETTINGS_STORAGE_KEY, JSON.stringify({
    version: 2,
    preferences: invalidPreferences,
  }))

  const restored = loadTeacherPreferences(storage)
  assert.equal(getTeacherSelectedValue('annualFixedCosts', restored), 1000000)
  assert.equal(JSON.parse(storage.getItem(TEACHER_SETTINGS_STORAGE_KEY)).version, 3)
  assert.deepEqual(loadTeacherPreferences(storage), restored)
})