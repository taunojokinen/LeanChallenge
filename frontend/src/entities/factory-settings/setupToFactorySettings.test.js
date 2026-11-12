import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFactorySettingsFromSetup } from './setupToFactorySettings.js'
import { DEFAULT_FACTORY_SETTINGS } from './defaultFactorySettings.js'

const KISALLI_SETUP = {
  id: '1',
  name: 'Kisälli',
  version: 1,
  fixedCostsQuarter: '400000.00',
  initialEquity: '2073975.00',
  newMachinePrice: '500000.00',
  setupTimeHours: '40.00',
  initialBatchSize: 20,
  factoryAreaM2: '4250.00',
  knlTimeConstantHours: '300.00',
  goodQualityThreshold: '75.00',
  excellentQualityThreshold: '80.00',
  fiveSInitialMultiplier: '2.000',
  fiveSMultiplierTimeConstant: '300.00',
  priceDeclinePercentPerRound: '0.00',
}

test('buildFactorySettingsFromSetup maps setup fields to factorySettings', () => {
  const settings = buildFactorySettingsFromSetup(KISALLI_SETUP)

  assert.equal(settings.costs.annualFixedCosts, 1600000)
  assert.equal(settings.initialState.finance.equity, 2073975)
  assert.equal(settings.investments.newMachine.price, 500000)
  assert.equal(settings.lean.smed.initialSetupTimeHours, 40)
  assert.equal(settings.production.initialBatchSize, 20)
  assert.equal(settings.initialState.factory.totalAreaM2, 4250)
  assert.equal(settings.knl.knlHalfLifeHours, 300)
  assert.equal(settings.variationRules.minimumQualityForZeroAdditionalVariations, 0.75)
  assert.equal(settings.variationRules.oneVariationMinQuality, 0.80)
})

test('buildFactorySettingsFromSetup preserves defaults for unmapped fields', () => {
  const settings = buildFactorySettingsFromSetup(KISALLI_SETUP)

  assert.equal(settings.game.totalRounds, DEFAULT_FACTORY_SETTINGS.game.totalRounds)
  assert.equal(settings.market.referencePrice, DEFAULT_FACTORY_SETTINGS.market.referencePrice)
  assert.equal(settings.production.workersPerMachine, DEFAULT_FACTORY_SETTINGS.production.workersPerMachine)
})

test('buildFactorySettingsFromSetup handles different difficulty levels', () => {
  const easy = buildFactorySettingsFromSetup({
    ...KISALLI_SETUP,
    name: 'Oppipoika',
    fixedCostsQuarter: '300000.00',
    initialEquity: '3000000.00',
  })
  const hard = buildFactorySettingsFromSetup({
    ...KISALLI_SETUP,
    name: 'Mestari',
    fixedCostsQuarter: '500000.00',
    initialEquity: '1500000.00',
  })

  assert.equal(easy.costs.annualFixedCosts, 1200000)
  assert.equal(easy.initialState.finance.equity, 3000000)
  assert.equal(hard.costs.annualFixedCosts, 2000000)
  assert.equal(hard.initialState.finance.equity, 1500000)
})
