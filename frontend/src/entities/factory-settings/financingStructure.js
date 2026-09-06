import { DEFAULT_FACTORY_SETTINGS } from './defaultFactorySettings.js'

function toNumber(value, fallback = 0) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

export function calculateFinancingStructure({
  nonCashAssets,
  equity,
  rawMaterialCosts,
  factorySettings = DEFAULT_FACTORY_SETTINGS,
}) {
  const financeSettings = factorySettings?.finance ?? DEFAULT_FACTORY_SETTINGS.finance
  const targetCash = toNumber(
    financeSettings.targetCash,
    DEFAULT_FACTORY_SETTINGS.finance.targetCash,
  )
  const otherLiabilitiesShare = toNumber(
    financeSettings.otherLiabilitiesRawMaterialShare,
    DEFAULT_FACTORY_SETTINGS.finance.otherLiabilitiesRawMaterialShare,
  )

  const safeNonCashAssets = toNumber(nonCashAssets)
  const safeEquity = toNumber(equity)
  const materialsCostBase = Math.abs(toNumber(rawMaterialCosts))
  const otherLiabilities = Math.round(materialsCostBase * otherLiabilitiesShare)
  const financingNeed = safeNonCashAssets + targetCash - safeEquity - otherLiabilities

  const interestBearingDebt = financingNeed > 0 ? financingNeed : 0
  const cash = financingNeed > 0 ? targetCash : targetCash + Math.abs(financingNeed)
  const totalAssets = safeNonCashAssets + cash
  const totalEquityAndLiabilities = safeEquity + otherLiabilities + interestBearingDebt

  return {
    targetCash,
    otherLiabilitiesRawMaterialShare: otherLiabilitiesShare,
    nonCashAssets: safeNonCashAssets,
    financingNeed,
    cash,
    otherLiabilities,
    interestBearingDebt,
    totalAssets,
    totalEquityAndLiabilities,
  }
}