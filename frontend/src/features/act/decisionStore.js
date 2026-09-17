const ACT_DECISION_STORAGE_KEY = 'lean-challenge-act-decision'

function sanitizeNumber(value, fallback = 0) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return fallback
  }

  return numericValue
}

function sanitizeNonNegativeInteger(value, fallback = 0) {
  return Math.max(0, Math.round(sanitizeNumber(value, fallback)))
}

export function loadActDecision(round) {
  try {
    const rawValue = window.localStorage.getItem(ACT_DECISION_STORAGE_KEY)

    if (!rawValue) {
      return null
    }

    const parsedValue = JSON.parse(rawValue)

    if (!parsedValue || parsedValue.round !== round) {
      return null
    }

    return {
      round: parsedValue.round,
      price: sanitizeNonNegativeInteger(parsedValue.price, 25000),
      productionQuantity: sanitizeNonNegativeInteger(parsedValue.productionQuantity, 0),
      addedVariations: sanitizeNonNegativeInteger(parsedValue.addedVariations, 0),
      // batchSize moved to CHECK's next-round decision; legacy stored values are intentionally ignored here.
      savedAt: parsedValue.savedAt,
    }
  } catch {
    return null
  }
}

export function saveActDecision(decision) {
  const normalizedDecision = {
    round: sanitizeNonNegativeInteger(decision?.round, 0),
    price: sanitizeNonNegativeInteger(decision?.price, 25000),
    productionQuantity: sanitizeNonNegativeInteger(decision?.productionQuantity, 0),
    addedVariations: sanitizeNonNegativeInteger(decision?.addedVariations, 0),
    savedAt: decision?.savedAt ?? new Date().toISOString(),
  }

  window.localStorage.setItem(ACT_DECISION_STORAGE_KEY, JSON.stringify(normalizedDecision))
}
