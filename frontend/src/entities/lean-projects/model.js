import { DEFAULT_FACTORY_SETTINGS } from '../factory-settings/defaultFactorySettings.js'

const INTEGER_FORMATTER = new Intl.NumberFormat('fi-FI', {
  maximumFractionDigits: 0,
})

const DECIMAL_FORMATTER = new Intl.NumberFormat('fi-FI', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

export const METHOD_LEVEL_THRESHOLDS = DEFAULT_FACTORY_SETTINGS.lean.methods.levelThresholds

export const METHOD_DEVELOPMENT_FIXED_HOURS = DEFAULT_FACTORY_SETTINGS.lean.methods.fixedHours
export const PROJECT_EURO_PER_HOUR = DEFAULT_FACTORY_SETTINGS.lean.methods.costPerHour
export const PROJECT_COST_ROUNDING = DEFAULT_FACTORY_SETTINGS.lean.methods.costRounding
export const MAX_METHOD_EFFECTIVE_HOURS = DEFAULT_FACTORY_SETTINGS.lean.methods.maxEffectiveHours

const PHASE_LABELS = {
  smed: [
    'Ei järjestelmällistä SMEDiä',
    'Kehitettävän asetustenvaihdon tunnistaminen',
    'Työvaiheiden ja aikojen mittaus',
    'Sisäisten ja ulkoisten työvaiheiden erottelu',
    'Sisäisen työn muuttaminen ulkoiseksi',
    'Sisäisten työvaiheiden tehostaminen',
    'Menetelmän standardointi ja levittäminen',
  ],
  tpm: [
    'Reaktiivinen kunnossapito',
    'Häiriöiden tunnistaminen',
    'Peruskunnon palauttaminen',
    'Käyttäjäkunnossapito',
    'Ennakoiva kunnossapito',
    'Kunnonvalvonta',
    'TPM vakiintunut',
  ],
  spc: [
    'Ei järjestelmällistä SPC:tä',
    'Kriittisten laatuominaisuuksien tunnistaminen',
    'Mittausdatan systemaattinen kerääminen',
    'Prosessin vaihtelun ymmärtäminen',
    'Ohjauskorttien käyttöönotto',
    'Systemaattinen reagointimalli',
    'SPC vakiintunut',
  ],
  'poka-yoke': [
    'Ei järjestelmällistä virheenestoa',
    'Virheiden tunnistaminen',
    'Juurisyiden selvittäminen',
    'Yksinkertainen virheenesto',
    'Virheen välitön havaitseminen',
    'Virheen automaattinen estäminen',
    'Poka-Yoke vakiintunut',
  ],
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

function roundToOneDecimal(value) {
  return Math.round(value * 10) / 10
}

function formatHours(value) {
  return `${INTEGER_FORMATTER.format(Math.round(value))} h`
}

function formatCurrency(value) {
  return `${INTEGER_FORMATTER.format(Math.round(value))} €`
}

function formatLevel(value) {
  return `${DECIMAL_FORMATTER.format(value)} / 6`
}

function getSelectionKey(departmentKey, methodKey) {
  return `${departmentKey}:${methodKey}`
}

function toNumber(value, fallback = 0) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
}

function resolveMethodsSettings(factorySettings = DEFAULT_FACTORY_SETTINGS) {
  return factorySettings?.lean?.methods ?? DEFAULT_FACTORY_SETTINGS.lean.methods
}

export function normalizeSelectionHours(value, step = 10) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0
  }

  return Math.round(numericValue / step) * step
}

export function getMethodLevel(effectiveHours, factorySettings = DEFAULT_FACTORY_SETTINGS) {
  const settings = resolveMethodsSettings(factorySettings)
  const levelThresholds = settings.levelThresholds ?? METHOD_LEVEL_THRESHOLDS
  const safeHours = clamp(Number(effectiveHours) || 0, 0, settings.maxEffectiveHours ?? MAX_METHOD_EFFECTIVE_HOURS)

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

  return 6
}

export function calculateProjectCost(investedHours, factorySettings = DEFAULT_FACTORY_SETTINGS) {
  const settings = resolveMethodsSettings(factorySettings)
  const safeHours = Math.max(0, Math.round(Number(investedHours) || 0))
  const rawCost = safeHours * toNumber(settings.costPerHour, PROJECT_EURO_PER_HOUR)

  return Math.round(rawCost / toNumber(settings.costRounding, PROJECT_COST_ROUNDING)) * toNumber(
    settings.costRounding,
    PROJECT_COST_ROUNDING,
  )
}

function getProgressiveImpactCategory(currentLevel, nextLevel) {
  const delta = nextLevel - currentLevel

  if (delta < 0) {
    return 'Negatiivinen'
  }

  if (delta === 0) {
    return 'Ei vaikutusta'
  }

  if (delta < 0.15) {
    return 'Pieni'
  }

  if (delta < 0.35) {
    return 'Kohtuullinen'
  }

  return 'Suuri'
}

function getMethodDevelopmentImpactCategory() {
  return 'Pieni'
}

export function canSelectMethodDevelopment(remainingFocusHours, factorySettings = DEFAULT_FACTORY_SETTINGS) {
  const settings = resolveMethodsSettings(factorySettings)
  return Number(remainingFocusHours) >= toNumber(settings.fixedHours, METHOD_DEVELOPMENT_FIXED_HOURS)
}

function getPhaseDescription(methodKey, currentLevel) {
  const labels = PHASE_LABELS[methodKey]

  if (!labels) {
    return 'Ei vaihepolkua tässä toimenpiteessä.'
  }

  const phaseIndex = clamp(Math.floor(currentLevel), 0, labels.length - 1)
  return labels[phaseIndex]
}

export function isCombinedFocusWithinBudget(focusBudgetHours, fiveSUsedHours, projectsHours) {
  return fiveSUsedHours + projectsHours <= focusBudgetHours
}

function normalizeSelectionMap(rawSelectionMap = {}) {
  if (!rawSelectionMap || typeof rawSelectionMap !== 'object') {
    return {}
  }

  return Object.entries(rawSelectionMap).reduce((accumulator, [key, value]) => {
    accumulator[key] = Math.max(0, Math.round(Number(value) || 0))
    return accumulator
  }, {})
}

function createMethodViewModel(department, method, selectedHours, factorySettings = DEFAULT_FACTORY_SETTINGS) {
  const settings = resolveMethodsSettings(factorySettings)
  if (method.type === 'fixed') {
    const fixedHours = toNumber(settings.fixedHours, METHOD_DEVELOPMENT_FIXED_HOURS)
    const fixedCost = calculateProjectCost(fixedHours, factorySettings)
    const isSelected = selectedHours > 0
    const hours = isSelected ? fixedHours : 0
    const cost = isSelected ? fixedCost : 0

    return {
      key: method.key,
      name: method.name,
      type: method.type,
      targetLoss: method.targetLoss,
      targetProblem: method.targetProblem,
      impactDriver: method.impactDriver,
      currentLevel: null,
      currentLevelText: '-',
      currentPhaseDescription: 'Vakioitu menetelmätoimenpide osaston suurimpaan ongelmaan.',
      isSelected,
      displayHours: fixedHours,
      displayHoursText: formatHours(fixedHours),
      displayCost: fixedCost,
      displayCostText: formatCurrency(fixedCost),
      displayImpactCategory: getMethodDevelopmentImpactCategory(),
      selectedHours: hours,
      selectedHoursText: formatHours(hours),
      cost,
      costText: formatCurrency(cost),
      impactCategory: getMethodDevelopmentImpactCategory(),
      nextLevel: null,
      levelDelta: null,
      selectionKey: getSelectionKey(department.key, method.key),
    }
  }

  const currentEffectiveHours = clamp(
    Number(method.effectiveHours) || 0,
    0,
    settings.maxEffectiveHours ?? MAX_METHOD_EFFECTIVE_HOURS,
  )
  const investedHours = normalizeSelectionHours(selectedHours)
  const nextEffectiveHours = clamp(
    currentEffectiveHours + investedHours,
    0,
    settings.maxEffectiveHours ?? MAX_METHOD_EFFECTIVE_HOURS,
  )
  const currentLevel = getMethodLevel(currentEffectiveHours, factorySettings)
  const nextLevel = getMethodLevel(nextEffectiveHours, factorySettings)
  const levelDelta = roundToOneDecimal(nextLevel - currentLevel)
  const cost = calculateProjectCost(investedHours, factorySettings)
  const impactCategory = investedHours === 0 ? 'Ei vaikutusta' : getProgressiveImpactCategory(currentLevel, nextLevel)

  return {
    key: method.key,
    name: method.name,
    type: method.type,
    targetLoss: method.targetLoss,
    targetProblem: method.targetProblem ?? null,
    impactDriver: method.impactDriver,
    currentLevel,
    currentLevelText: formatLevel(roundToOneDecimal(currentLevel)),
    currentPhaseDescription: getPhaseDescription(method.key, currentLevel),
    selectedHours: investedHours,
    selectedHoursText: formatHours(investedHours),
    cost,
    costText: formatCurrency(cost),
    impactCategory,
    nextLevel,
    levelDelta,
    selectionKey: getSelectionKey(department.key, method.key),
  }
}

export function buildProjectsViewModel(snapshot, options = {}, factorySettings = DEFAULT_FACTORY_SETTINGS) {
  const focusBudgetHours = Math.max(0, Math.round(Number(snapshot.focusBudgetHours) || 0))
  const fiveSUsedHours = Math.max(0, Math.round(Number(options.fiveSDecision?.usedFocusHours) || 0))
  const selectionMap = normalizeSelectionMap(options.selectionMap)

  const departments = snapshot.departments.map((department) => {
    const methods = department.methods.map((method) => {
      const selectionKey = getSelectionKey(department.key, method.key)
      const selectedHours = selectionMap[selectionKey] ?? 0
      return createMethodViewModel(department, method, selectedHours, factorySettings)
    })

    return {
      key: department.key,
      name: department.name,
      methods,
    }
  })

  const selections = departments
    .flatMap((department) =>
      department.methods
        .filter((method) => method.selectedHours > 0)
        .map((method) => ({
          departmentKey: department.key,
          departmentName: department.name,
          methodKey: method.key,
          methodName: method.name,
          investedHours: method.selectedHours,
          investedHoursText: method.selectedHoursText,
          cost: method.cost,
          costText: method.costText,
          targetLoss: method.targetLoss,
          targetProblem: method.targetProblem,
          impactCategory: method.impactCategory,
        })),
    )
    .sort((left, right) => left.departmentName.localeCompare(right.departmentName, 'fi'))

  const projectsSelectedHours = selections.reduce((sum, item) => sum + item.investedHours, 0)
  const projectsTotalCost = selections.reduce((sum, item) => sum + item.cost, 0)
  const combinedUsedHours = fiveSUsedHours + projectsSelectedHours
  const remainingFocusHours = focusBudgetHours - combinedUsedHours

  return {
    round: snapshot.round,
    focus: {
      totalHours: focusBudgetHours,
      totalHoursText: formatHours(focusBudgetHours),
      fiveSUsedHours,
      fiveSUsedHoursText: formatHours(fiveSUsedHours),
      projectsSelectedHours,
      projectsSelectedHoursText: formatHours(projectsSelectedHours),
      combinedUsedHours,
      combinedUsedHoursText: formatHours(combinedUsedHours),
      remainingHours: remainingFocusHours,
      remainingHoursText: formatHours(remainingFocusHours),
      canSave: isCombinedFocusWithinBudget(focusBudgetHours, fiveSUsedHours, projectsSelectedHours),
    },
    costs: {
      total: projectsTotalCost,
      totalText: formatCurrency(projectsTotalCost),
    },
    departments,
    selections,
  }
}

export function buildSelectionMapFromDecision(decision) {
  if (!decision?.selections || !Array.isArray(decision.selections)) {
    return {}
  }

  return decision.selections.reduce((accumulator, selection) => {
    const department = String(selection.department ?? '').trim()
    const method = String(selection.method ?? '').trim()

    if (!department || !method) {
      return accumulator
    }

    accumulator[getSelectionKey(department, method)] = Math.max(
      0,
      Math.round(Number(selection.investedHours) || 0),
    )
    return accumulator
  }, {})
}

export function getDepartmentMethodKeys(snapshot, departmentKey) {
  const department = snapshot.departments.find((item) => item.key === departmentKey)

  if (!department) {
    return []
  }

  return department.methods.map((method) => method.key)
}