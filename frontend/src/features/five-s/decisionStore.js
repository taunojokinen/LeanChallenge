const FIVE_S_DECISION_STORAGE_KEY = 'lean-challenge-five-s-decision'

const DEFAULT_HOURS_BY_DEPARTMENT = {
  machining: 0,
  assembly: 0,
  shipping: 0,
}

function sanitizeHours(value) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0
  }

  return Math.round(numericValue)
}

function normalizeInvestedHours(rawHours) {
  if (!rawHours || typeof rawHours !== 'object') {
    return { ...DEFAULT_HOURS_BY_DEPARTMENT }
  }

  return {
    machining: sanitizeHours(rawHours.machining),
    assembly: sanitizeHours(rawHours.assembly),
    shipping: sanitizeHours(rawHours.shipping),
  }
}

function getUsedFocusHours(investedHours) {
  return investedHours.machining + investedHours.assembly + investedHours.shipping
}

export function loadFiveSDecision(round) {
  try {
    const rawValue = window.localStorage.getItem(FIVE_S_DECISION_STORAGE_KEY)

    if (!rawValue) {
      return null
    }

    const parsedValue = JSON.parse(rawValue)

    if (!parsedValue || parsedValue.round !== round) {
      return null
    }

    const investedHours = normalizeInvestedHours(parsedValue.investedHours)

    return {
      round: parsedValue.round,
      investedHours,
      usedFocusHours: sanitizeHours(parsedValue.usedFocusHours ?? getUsedFocusHours(investedHours)),
      savedAt: parsedValue.savedAt,
    }
  } catch {
    return null
  }
}

export function saveFiveSDecision(decision) {
  const investedHours = normalizeInvestedHours(decision?.investedHours)
  const normalizedDecision = {
    round: Number(decision?.round) || 0,
    investedHours,
    usedFocusHours: sanitizeHours(decision?.usedFocusHours ?? getUsedFocusHours(investedHours)),
    savedAt: decision?.savedAt ?? new Date().toISOString(),
  }

  window.localStorage.setItem(FIVE_S_DECISION_STORAGE_KEY, JSON.stringify(normalizedDecision))
}