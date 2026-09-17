const CHECK_STAFFING_DECISION_STORAGE_KEY = 'lean-challenge-check-staffing-decision'

function sanitizeCount(value) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0
  }

  return Math.round(numericValue)
}

function sanitizeOptionalCount(value) {
  if (value == null) {
    return null
  }

  return sanitizeCount(value)
}

function normalizeStaffing(staffing) {
  if (!staffing || typeof staffing !== 'object') {
    return {
      assembly: 0,
      shipping: 0,
    }
  }

  return {
    assembly: sanitizeCount(staffing.assembly),
    shipping: sanitizeCount(staffing.shipping),
  }
}

export function loadCheckStaffingDecision(round) {
  try {
    const rawValue = window.localStorage.getItem(CHECK_STAFFING_DECISION_STORAGE_KEY)

    if (!rawValue) {
      return null
    }

    const parsedValue = JSON.parse(rawValue)

    if (!parsedValue || parsedValue.round !== round) {
      return null
    }

    return {
      round: parsedValue.round,
      staffing: normalizeStaffing(parsedValue.staffing),
      savedAt: parsedValue.savedAt,
    }
  } catch {
    return null
  }
}

export function saveCheckStaffingDecision(decision) {
  const normalizedDecision = {
    round: Number(decision?.round) || 0,
    staffing: normalizeStaffing(decision?.staffing),
    savedAt: decision?.savedAt ?? new Date().toISOString(),
  }

  window.localStorage.setItem(CHECK_STAFFING_DECISION_STORAGE_KEY, JSON.stringify(normalizedDecision))
}

const CHECK_PRODUCTION_DECISION_STORAGE_KEY = 'lean-challenge-check-production-decision'

// This decision is made during `round` (CHECK) but is intended for round + 1's production plan
// batch size, and finished-goods target; all are next-round decisions and share the same
// round-scoped record.
export function loadCheckProductionDecision(round) {
  try {
    const rawValue = window.localStorage.getItem(CHECK_PRODUCTION_DECISION_STORAGE_KEY)

    if (!rawValue) {
      return null
    }

    const parsedValue = JSON.parse(rawValue)

    if (!parsedValue || parsedValue.round !== round) {
      return null
    }

    return {
      round: parsedValue.round,
      productionQuantity: sanitizeCount(parsedValue.productionQuantity),
      batchSize: sanitizeOptionalCount(parsedValue.batchSize),
      targetFinishedGoodsInventory: sanitizeOptionalCount(parsedValue.targetFinishedGoodsInventory),
      savedAt: parsedValue.savedAt,
    }
  } catch {
    return null
  }
}

export function saveCheckProductionDecision(decision) {
  const normalizedDecision = {
    round: Number(decision?.round) || 0,
    productionQuantity: sanitizeCount(decision?.productionQuantity),
    batchSize: sanitizeOptionalCount(decision?.batchSize),
    targetFinishedGoodsInventory: sanitizeOptionalCount(decision?.targetFinishedGoodsInventory),
    savedAt: decision?.savedAt ?? new Date().toISOString(),
  }

  window.localStorage.setItem(CHECK_PRODUCTION_DECISION_STORAGE_KEY, JSON.stringify(normalizedDecision))
}
