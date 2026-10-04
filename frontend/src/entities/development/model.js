import { DEFAULT_FACTORY_SETTINGS } from '../factory-settings/defaultFactorySettings.js'
import { calculateNextFiveSState } from '../five-s/model.js'
import { calculateDevelopedKnlValue } from '../forecast/knlDevelopment.js'

export const DEVELOPMENT_CAPACITY = 400
export const DEVELOPMENT_DEPARTMENTS = [
  { key: 'machining', label: 'Koneistus', methods: ['five-s', 'smed', 'tpm', 'spc'] },
  { key: 'assembly', label: 'Koonta', methods: ['five-s', 'method-development', 'tpm', 'poka-yoke'] },
  { key: 'shipping', label: 'Lähettämö', methods: ['five-s', 'method-development', 'tpm', 'poka-yoke'] },
]

const METHOD_LABELS = {
  'five-s': '5S', smed: 'SMED', tpm: 'TPM', spc: 'SPC',
  'method-development': 'Menetelmäkehitys', 'poka-yoke': 'Poka-Yoke',
}

export function developmentKey(department, method) {
  return `${department}:${method}`
}

const KEYS = DEVELOPMENT_DEPARTMENTS.flatMap(({ key, methods }) =>
  methods.map((method) => developmentKey(key, method)),
)

function safeHours(value) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
}

export function normalizeDevelopmentHours(hours = {}) {
  let remaining = DEVELOPMENT_CAPACITY
  return Object.fromEntries(KEYS.map((key) => {
    const value = Math.min(remaining, safeHours(hours[key]))
    remaining -= value
    return [key, value]
  }))
}

export function sumDevelopmentHours(hours) {
  return KEYS.reduce((total, key) => total + safeHours(hours[key]), 0)
}

export function isDevelopmentHoursValid(hours) {
  return KEYS.every((key) => Number.isInteger(hours[key]) && hours[key] >= 0)
    && Object.keys(hours).every((key) => KEYS.includes(key))
    && sumDevelopmentHours(hours) <= DEVELOPMENT_CAPACITY
}

export function updateDevelopmentHours(hours, key, value) {
  const normalized = normalizeDevelopmentHours(hours)
  if (!KEYS.includes(key) || !Number.isFinite(value)) {
    return normalized
  }
  const maximum = DEVELOPMENT_CAPACITY - sumDevelopmentHours(normalized) + normalized[key]
  return { ...normalized, [key]: Math.min(maximum, safeHours(value)) }
}

export function calculateDevelopmentPercent(cumulativeHours, factorySettings = DEFAULT_FACTORY_SETTINGS) {
  const settings = factorySettings.knl ?? DEFAULT_FACTORY_SETTINGS.knl
  const maximum = settings.knlMaximum
  if (!Number.isFinite(maximum) || maximum <= 0) {
    return 0
  }
  const developed = calculateDevelopedKnlValue({
    x0: 0,
    cumulativeHours,
    knlMaximum: maximum,
    knlHalfLifeHours: settings.knlHalfLifeHours,
  })
  return Math.min(100, Math.max(0, developed / maximum * 100))
}

export function buildDevelopmentViewModel(gameState, hours, factorySettings = DEFAULT_FACTORY_SETTINGS) {
  const selected = normalizeDevelopmentHours(hours)
  const usedHours = sumDevelopmentHours(selected)
  return {
    capacity: DEVELOPMENT_CAPACITY,
    usedHours,
    remainingHours: DEVELOPMENT_CAPACITY - usedHours,
    departments: DEVELOPMENT_DEPARTMENTS.map(({ key, label, methods }) => ({
      key,
      label,
      methods: methods.map((method) => {
        const selectionKey = developmentKey(key, method)
        const value = selected[selectionKey]
        const currentHours = method === 'five-s'
          ? gameState.lean?.fiveS?.departments?.[key]?.effectiveHours ?? 0
          : gameState.lean?.methods?.[key]?.[method] ?? 0
        const predictedHours = method === 'five-s'
          ? calculateNextFiveSState(currentHours, value, factorySettings).nextEffectiveHours
          : safeHours(currentHours) + value
        return {
          key: selectionKey,
          label: METHOD_LABELS[method],
          value,
          maximum: DEVELOPMENT_CAPACITY - usedHours + value,
          currentHours,
          predictedHours,
          currentLevel: calculateDevelopmentPercent(currentHours, factorySettings),
          predictedLevel: Math.round(calculateDevelopmentPercent(predictedHours, factorySettings) * 10) / 10,
        }
      }),
    })),
  }
}