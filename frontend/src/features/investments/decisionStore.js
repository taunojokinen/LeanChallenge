const INVESTMENTS_DECISION_STORAGE_KEY = 'lean-challenge-investments-decision'

function sanitizeAmount(value) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0
  }

  return Math.round(numericValue)
}

function normalizeInvestment(item) {
  if (!item || typeof item !== 'object') {
    return null
  }

  const type = String(item.type ?? '').trim()

  if (!type) {
    return null
  }

  const normalized = {
    type,
    quantity: Math.max(1, sanitizeAmount(item.quantity || 1)),
    cost: sanitizeAmount(item.cost),
  }

  if (item.machineId != null) {
    normalized.machineId = sanitizeAmount(item.machineId)
  }

  return normalized
}

function normalizeInvestments(items, includeLegacyFields = true) {
  if (!Array.isArray(items)) {
    return []
  }

  const normalized = items.map(normalizeInvestment).filter(Boolean)
  const setupAutomation = normalized.find((item) => item.type === 'mold-change-automation')

  return normalized.filter((item, index) => {
    if (item.type !== 'mold-change-automation') {
      return true
    }

    return item === setupAutomation && normalized.findIndex((candidate) => candidate.type === item.type) === index
  }).map((item) => {
    const canonicalItem = item.type === 'mold-change-automation'
      ? { ...item, quantity: 1 }
      : item

    if (!includeLegacyFields) {
      delete canonicalItem.cost
      delete canonicalItem.machineId
    }

    return canonicalItem
  })
}

export function loadInvestmentsDecision(round) {
  try {
    const rawValue = window.localStorage.getItem(INVESTMENTS_DECISION_STORAGE_KEY)

    if (!rawValue) {
      return null
    }

    const parsedValue = JSON.parse(rawValue)

    if (!parsedValue || parsedValue.round !== round) {
      return null
    }

    const investments = normalizeInvestments(parsedValue.investments)

    return {
      round: parsedValue.round,
      investments,
      totalCost: sanitizeAmount(parsedValue.totalCost),
      financingNeed: sanitizeAmount(parsedValue.financingNeed),
      savedAt: parsedValue.savedAt,
    }
  } catch {
    return null
  }
}

export function saveInvestmentsDecision(decision) {
  const investments = normalizeInvestments(decision?.investments, false)

  const normalizedDecision = {
    round: Number(decision?.round) || 0,
    investments,
    savedAt: decision?.savedAt ?? new Date().toISOString(),
  }

  window.localStorage.setItem(INVESTMENTS_DECISION_STORAGE_KEY, JSON.stringify(normalizedDecision))
}