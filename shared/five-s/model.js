import { DEFAULT_FACTORY_SETTINGS } from '../factory-settings/defaultFactorySettings.js'

export const FIVE_S_MAX_EFFECTIVE_HOURS = DEFAULT_FACTORY_SETTINGS.lean.fiveS.maxHours

export const FIVE_S_LEVEL_THRESHOLDS = DEFAULT_FACTORY_SETTINGS.lean.fiveS.levelThresholds

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

function roundToInteger(value) {
  return Math.round(value)
}

function sanitizeHours(value) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0
  }

  return roundToInteger(numericValue)
}

function calculateUsedFocusHours(investedHours) {
  return investedHours.machining + investedHours.assembly + investedHours.shipping
}

function resolveFiveSSettings(factorySettings = DEFAULT_FACTORY_SETTINGS) {
  return factorySettings?.lean?.fiveS ?? DEFAULT_FACTORY_SETTINGS.lean.fiveS
}

export function getFiveSLevel(effectiveHours, factorySettings = DEFAULT_FACTORY_SETTINGS) {
  const settings = resolveFiveSSettings(factorySettings)
  const levelThresholds = settings.levelThresholds ?? FIVE_S_LEVEL_THRESHOLDS
  const safeHours = clamp(Number(effectiveHours) || 0, 0, settings.maxHours ?? FIVE_S_MAX_EFFECTIVE_HOURS)

  if (safeHours <= levelThresholds[0].hours) {
    return 0
  }

  for (let index = 1; index < levelThresholds.length; index += 1) {
    const previous = levelThresholds[index - 1]
    const current = levelThresholds[index]

    if (safeHours <= current.hours) {
      const progress = (safeHours - previous.hours) / (current.hours - previous.hours)

      return previous.level + progress * (current.level - previous.level)
    }
  }

  return 5
}

export function applyFiveSInvestment(currentEffectiveHours, investedHours, factorySettings = DEFAULT_FACTORY_SETTINGS) {
  const settings = resolveFiveSSettings(factorySettings)
  const maxHours = settings.maxHours ?? FIVE_S_MAX_EFFECTIVE_HOURS
  const safeCurrent = clamp(Number(currentEffectiveHours) || 0, 0, maxHours)
  const safeInvestment = sanitizeHours(investedHours)

  return clamp(safeCurrent + safeInvestment, 0, maxHours)
}

export function applyFiveSDecay(currentEffectiveHours, factorySettings = DEFAULT_FACTORY_SETTINGS) {
  const settings = resolveFiveSSettings(factorySettings)
  const maxHours = settings.maxHours ?? FIVE_S_MAX_EFFECTIVE_HOURS
  const safeCurrent = clamp(Number(currentEffectiveHours) || 0, 0, maxHours)

  return clamp(safeCurrent * 0.95, 0, maxHours)
}

export function calculateNextFiveSState(currentEffectiveHours, investedHours, factorySettings = DEFAULT_FACTORY_SETTINGS) {
  const safeInvestment = sanitizeHours(investedHours)
  const nextEffectiveHours =
    safeInvestment === 0
      ? applyFiveSDecay(currentEffectiveHours, factorySettings)
      : applyFiveSInvestment(currentEffectiveHours, safeInvestment, factorySettings)

  return {
    currentEffectiveHours: clamp(
      Number(currentEffectiveHours) || 0,
      0,
      resolveFiveSSettings(factorySettings).maxHours ?? FIVE_S_MAX_EFFECTIVE_HOURS,
    ),
    investedHours: safeInvestment,
    nextEffectiveHours,
    currentLevel: getFiveSLevel(currentEffectiveHours, factorySettings),
    nextLevel: getFiveSLevel(nextEffectiveHours, factorySettings),
  }
}

export function isFocusBudgetValid(investedHours, focusBudgetHours) {
  return calculateUsedFocusHours(investedHours) <= focusBudgetHours
}