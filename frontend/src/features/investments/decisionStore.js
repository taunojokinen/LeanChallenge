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

  return {
    type,
    quantity: Math.max(1, sanitizeAmount(item.quantity || 1)),
    machineId: item.machineId == null ? null : sanitizeAmount(item.machineId),
    cost: sanitizeAmount(item.cost),
  }
}

function normalizeInvestments(items) {
  if (!Array.isArray(items)) {
    return []
  }

  return items.map(normalizeInvestment).filter(Boolean)
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
  const investments = normalizeInvestments(decision?.investments)

  const normalizedDecision = {
    round: Number(decision?.round) || 0,
    investments,
    totalCost: sanitizeAmount(decision?.totalCost),
    financingNeed: sanitizeAmount(decision?.financingNeed),
    savedAt: decision?.savedAt ?? new Date().toISOString(),
  }

  window.localStorage.setItem(INVESTMENTS_DECISION_STORAGE_KEY, JSON.stringify(normalizedDecision))
}