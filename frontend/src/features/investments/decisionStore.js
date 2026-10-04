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

  if (!['new-machine', 'factory-expansion'].includes(type)) {
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

  return items.map(normalizeInvestment).filter(Boolean).map((item) => {
    if (!includeLegacyFields) {
      delete item.cost
      delete item.machineId
    }
    return item
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