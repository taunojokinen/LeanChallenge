import { DEFAULT_FACTORY_SETTINGS } from '../factory-settings/defaultFactorySettings.js'
import { resolveDevelopmentLevel } from '../forecast/knlDevelopment.js'

const INTEGER_FORMATTER = new Intl.NumberFormat('fi-FI', {
  maximumFractionDigits: 0,
})

const DECIMAL_FORMATTER = new Intl.NumberFormat('fi-FI', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

export const FIVE_S_MAX_EFFECTIVE_HOURS = DEFAULT_FACTORY_SETTINGS.lean.fiveS.maxHours

export const FIVE_S_LEVEL_THRESHOLDS = DEFAULT_FACTORY_SETTINGS.lean.fiveS.levelThresholds

const DEFAULT_INVESTED_HOURS = {
  machining: 0,
  assembly: 0,
  shipping: 0,
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

function roundToOneDecimal(value) {
  return Math.round(value * 10) / 10
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

function toNumber(value, fallback = 0) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
}

function formatLevel(value) {
  return `Taso ${INTEGER_FORMATTER.format(value)}`
}

function formatHours(value) {
  return `${INTEGER_FORMATTER.format(value)} h`
}

function formatLevelDelta(value) {
  if (value === 0) {
    return '0,0'
  }

  const sign = value > 0 ? '+' : ''

  return `${sign}${DECIMAL_FORMATTER.format(value)}`
}

function normalizeInvestedHours(rawHours) {
  if (!rawHours || typeof rawHours !== 'object') {
    return { ...DEFAULT_INVESTED_HOURS }
  }

  return {
    machining: sanitizeHours(rawHours.machining),
    assembly: sanitizeHours(rawHours.assembly),
    shipping: sanitizeHours(rawHours.shipping),
  }
}

function calculateUsedFocusHours(investedHours) {
  return investedHours.machining + investedHours.assembly + investedHours.shipping
}

function resolveFiveSSettings(factorySettings = DEFAULT_FACTORY_SETTINGS) {
  return factorySettings?.lean?.fiveS ?? DEFAULT_FACTORY_SETTINGS.lean.fiveS
}

function resolveDevelopmentLevelSettings(factorySettings = DEFAULT_FACTORY_SETTINGS) {
  return factorySettings?.lean?.developmentLevel ?? DEFAULT_FACTORY_SETTINGS.lean.developmentLevel
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

export function getFiveSImpactCategory(currentLevel, nextLevel) {
  const delta = (Number(nextLevel) || 0) - (Number(currentLevel) || 0)

  if (delta < 0) {
    return 'Negatiivinen'
  }

  if (delta < 0.1) {
    return 'Pieni'
  }

  if (delta < 0.25) {
    return 'Kohtuullinen'
  }

  return 'Suuri'
}

export function isFocusBudgetValid(investedHours, focusBudgetHours) {
  return calculateUsedFocusHours(investedHours) <= focusBudgetHours
}

export function buildFiveSViewModel(snapshot, decision, selectedInvestedHours, factorySettings = DEFAULT_FACTORY_SETTINGS) {
  const settings = resolveFiveSSettings(factorySettings)
  const developmentLevelSettings = resolveDevelopmentLevelSettings(factorySettings)
  const investedHours = normalizeInvestedHours(selectedInvestedHours ?? decision?.investedHours)
  const usedFocusHours = calculateUsedFocusHours(investedHours)
  const focusBudgetHours = sanitizeHours(snapshot.focusBudgetHours)
  const remainingFocusHours = focusBudgetHours - usedFocusHours
  const canSave = usedFocusHours <= focusBudgetHours

  const departments = snapshot.departments.map((department) => {
    const currentEffectiveHours = clamp(
      Number(department.fiveSEffectiveHours) || 0,
      0,
      settings.maxHours ?? FIVE_S_MAX_EFFECTIVE_HOURS,
    )
    const state = calculateNextFiveSState(currentEffectiveHours, investedHours[department.key] ?? 0, factorySettings)
    // Displayed level uses the shared canonical development-level helper (baseHours/multiplier),
    // not the old fixed 0-5 threshold table - it never feeds back into the KNL calculation.
    const currentLevel = resolveDevelopmentLevel(state.currentEffectiveHours, developmentLevelSettings)
    const nextLevel = resolveDevelopmentLevel(state.nextEffectiveHours, developmentLevelSettings)
    const levelDelta = nextLevel - currentLevel

    return {
      key: department.key,
      name: department.name,
      investedHours: state.investedHours,
      investedHoursText: formatHours(state.investedHours),
      currentEffectiveHours: state.currentEffectiveHours,
      currentEffectiveHoursText: formatHours(state.currentEffectiveHours),
      nextEffectiveHours: state.nextEffectiveHours,
      nextEffectiveHoursText: formatHours(roundToOneDecimal(state.nextEffectiveHours)),
      currentLevel,
      currentLevelText: formatLevel(currentLevel),
      nextLevel,
      nextLevelText: formatLevel(nextLevel),
      levelDelta,
      levelDeltaText: formatLevelDelta(levelDelta),
      impactCategory: getFiveSImpactCategory(currentLevel, nextLevel),
      weight: Number(department.weight) || 0,
    }
  })

  const totalWeight = departments.reduce((sum, department) => sum + department.weight, 0)

  const averageCurrentLevel =
    totalWeight > 0
      ? departments.reduce((sum, department) => sum + department.currentLevel * department.weight, 0) / totalWeight
      : 0
  const averageNextLevel =
    totalWeight > 0
      ? departments.reduce((sum, department) => sum + department.nextLevel * department.weight, 0) / totalWeight
      : 0

  const factoryLevelDelta = roundToOneDecimal(averageNextLevel - averageCurrentLevel)

  return {
    round: snapshot.round,
    focus: {
      totalHours: focusBudgetHours,
      totalHoursText: formatHours(focusBudgetHours),
      usedHours: usedFocusHours,
      usedHoursText: formatHours(usedFocusHours),
      remainingHours: remainingFocusHours,
      remainingHoursText: formatHours(remainingFocusHours),
      canSave,
    },
    investedHours,
    departments,
    benefits: snapshot.benefits,
    impacts: {
      factory: {
        currentLevel: averageCurrentLevel,
        currentLevelText: formatLevel(roundToOneDecimal(averageCurrentLevel)),
        nextLevel: averageNextLevel,
        nextLevelText: formatLevel(roundToOneDecimal(averageNextLevel)),
        delta: factoryLevelDelta,
        deltaText: formatLevelDelta(factoryLevelDelta),
        impactCategory: getFiveSImpactCategory(averageCurrentLevel, averageNextLevel),
      },
    },
  }
}