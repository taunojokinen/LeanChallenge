const INTEGER_FORMATTER = new Intl.NumberFormat('fi-FI', {
  maximumFractionDigits: 0,
})

const DECIMAL_FORMATTER = new Intl.NumberFormat('fi-FI', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

export const FIVE_S_MAX_EFFECTIVE_HOURS = 1600

export const FIVE_S_LEVEL_THRESHOLDS = [
  { level: 0, hours: 0 },
  { level: 1, hours: 189 },
  { level: 2, hours: 474 },
  { level: 3, hours: 711 },
  { level: 4, hours: 1066 },
  { level: 5, hours: 1600 },
]

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

function formatLevel(value) {
  return `${DECIMAL_FORMATTER.format(value)} / 5`
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

export function getFiveSLevel(effectiveHours) {
  const safeHours = clamp(Number(effectiveHours) || 0, 0, FIVE_S_MAX_EFFECTIVE_HOURS)

  if (safeHours <= FIVE_S_LEVEL_THRESHOLDS[0].hours) {
    return 0
  }

  for (let index = 1; index < FIVE_S_LEVEL_THRESHOLDS.length; index += 1) {
    const previous = FIVE_S_LEVEL_THRESHOLDS[index - 1]
    const current = FIVE_S_LEVEL_THRESHOLDS[index]

    if (safeHours <= current.hours) {
      const progress = (safeHours - previous.hours) / (current.hours - previous.hours)

      return previous.level + progress * (current.level - previous.level)
    }
  }

  return 5
}

export function applyFiveSInvestment(currentEffectiveHours, investedHours) {
  const safeCurrent = clamp(Number(currentEffectiveHours) || 0, 0, FIVE_S_MAX_EFFECTIVE_HOURS)
  const safeInvestment = sanitizeHours(investedHours)

  return clamp(safeCurrent + safeInvestment, 0, FIVE_S_MAX_EFFECTIVE_HOURS)
}

export function applyFiveSDecay(currentEffectiveHours) {
  const safeCurrent = clamp(Number(currentEffectiveHours) || 0, 0, FIVE_S_MAX_EFFECTIVE_HOURS)

  return clamp(safeCurrent * 0.95, 0, FIVE_S_MAX_EFFECTIVE_HOURS)
}

export function calculateNextFiveSState(currentEffectiveHours, investedHours) {
  const safeInvestment = sanitizeHours(investedHours)
  const nextEffectiveHours =
    safeInvestment === 0
      ? applyFiveSDecay(currentEffectiveHours)
      : applyFiveSInvestment(currentEffectiveHours, safeInvestment)

  return {
    currentEffectiveHours: clamp(Number(currentEffectiveHours) || 0, 0, FIVE_S_MAX_EFFECTIVE_HOURS),
    investedHours: safeInvestment,
    nextEffectiveHours,
    currentLevel: getFiveSLevel(currentEffectiveHours),
    nextLevel: getFiveSLevel(nextEffectiveHours),
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

export function buildFiveSViewModel(snapshot, decision, selectedInvestedHours) {
  const investedHours = normalizeInvestedHours(selectedInvestedHours ?? decision?.investedHours)
  const usedFocusHours = calculateUsedFocusHours(investedHours)
  const focusBudgetHours = sanitizeHours(snapshot.focusBudgetHours)
  const remainingFocusHours = focusBudgetHours - usedFocusHours
  const canSave = usedFocusHours <= focusBudgetHours

  const departments = snapshot.departments.map((department) => {
    const currentEffectiveHours = clamp(
      Number(department.fiveSEffectiveHours) || 0,
      0,
      FIVE_S_MAX_EFFECTIVE_HOURS,
    )
    const state = calculateNextFiveSState(currentEffectiveHours, investedHours[department.key] ?? 0)
    const levelDelta = roundToOneDecimal(state.nextLevel - state.currentLevel)

    return {
      key: department.key,
      name: department.name,
      investedHours: state.investedHours,
      investedHoursText: formatHours(state.investedHours),
      currentEffectiveHours: state.currentEffectiveHours,
      currentEffectiveHoursText: formatHours(state.currentEffectiveHours),
      nextEffectiveHours: state.nextEffectiveHours,
      nextEffectiveHoursText: formatHours(roundToOneDecimal(state.nextEffectiveHours)),
      currentLevel: state.currentLevel,
      currentLevelText: formatLevel(roundToOneDecimal(state.currentLevel)),
      nextLevel: state.nextLevel,
      nextLevelText: formatLevel(roundToOneDecimal(state.nextLevel)),
      levelDelta,
      levelDeltaText: formatLevelDelta(levelDelta),
      impactCategory: getFiveSImpactCategory(state.currentLevel, state.nextLevel),
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