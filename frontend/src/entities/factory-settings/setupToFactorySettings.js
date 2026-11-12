import { DEFAULT_FACTORY_SETTINGS } from '../../../../shared/factory-settings/defaultFactorySettings.js'

// Muuntaa backendin setup-taulun arvot frontendin factorySettings-muotoon.
// Backend palauttaa numeric-sarakkeet merkkijonoina, joten ne muunnetaan numeroiksi.
// Kentät, joita setup ei kata, säilyvät oletusarvoisina.
export function buildFactorySettingsFromSetup(setup) {
  const settings = structuredClone(DEFAULT_FACTORY_SETTINGS)

  const fixedCostsQuarter = Number(setup.fixedCostsQuarter)
  if (Number.isFinite(fixedCostsQuarter)) {
    settings.costs.annualFixedCosts = fixedCostsQuarter * 4
  }

  const initialEquity = Number(setup.initialEquity)
  if (Number.isFinite(initialEquity)) {
    settings.initialState.finance.equity = initialEquity
  }

  const newMachinePrice = Number(setup.newMachinePrice)
  if (Number.isFinite(newMachinePrice)) {
    settings.investments.newMachine.price = newMachinePrice
  }

  const setupTimeHours = Number(setup.setupTimeHours)
  if (Number.isFinite(setupTimeHours)) {
    settings.lean.smed.initialSetupTimeHours = setupTimeHours
  }

  const initialBatchSize = Number(setup.initialBatchSize)
  if (Number.isFinite(initialBatchSize)) {
    settings.production.initialBatchSize = initialBatchSize
  }

  const factoryAreaM2 = Number(setup.factoryAreaM2)
  if (Number.isFinite(factoryAreaM2)) {
    settings.initialState.factory.totalAreaM2 = factoryAreaM2
  }

  const knlTimeConstantHours = Number(setup.knlTimeConstantHours)
  if (Number.isFinite(knlTimeConstantHours)) {
    settings.knl.knlHalfLifeHours = knlTimeConstantHours
  }

  // Backend tallentaa laatukynnykset prosentteina (75, 80),
  // frontend käyttää desimaaleja (0.75, 0.80).
  const goodQualityThreshold = Number(setup.goodQualityThreshold)
  if (Number.isFinite(goodQualityThreshold)) {
    settings.variationRules.minimumQualityForZeroAdditionalVariations = goodQualityThreshold / 100
    settings.variationRules.minimumQualityForOneAdditionalVariation = goodQualityThreshold / 100
  }

  const excellentQualityThreshold = Number(setup.excellentQualityThreshold)
  if (Number.isFinite(excellentQualityThreshold)) {
    settings.variationRules.oneVariationMinQuality = excellentQualityThreshold / 100
    settings.variationRules.twoVariationMinQuality = excellentQualityThreshold / 100
    settings.variationRules.minimumQualityForTwoAdditionalVariations = excellentQualityThreshold / 100
  }

  return settings
}
