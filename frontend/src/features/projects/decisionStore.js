const PROJECTS_DECISION_STORAGE_KEY = 'lean-challenge-projects-decision'

function sanitizeHours(value) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0
  }

  return Math.round(numericValue)
}

function sanitizeCost(value) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0
  }

  return Math.round(numericValue)
}

function normalizeSelection(selection) {
  if (!selection || typeof selection !== 'object') {
    return null
  }

  const department = String(selection.department ?? '').trim()
  const method = String(selection.method ?? '').trim()

  if (!department || !method) {
    return null
  }

  return {
    department,
    method,
    investedHours: sanitizeHours(selection.investedHours),
    cost: sanitizeCost(selection.cost),
    targetProblem: selection.targetProblem ?? null,
    targetLoss: selection.targetLoss ?? null,
  }
}

function normalizeSelections(rawSelections) {
  if (!Array.isArray(rawSelections)) {
    return []
  }

  return rawSelections.map(normalizeSelection).filter(Boolean)
}

function sumInvestedHours(selections) {
  return selections.reduce((sum, item) => sum + item.investedHours, 0)
}

export function loadProjectsDecision(round) {
  try {
    const rawValue = window.localStorage.getItem(PROJECTS_DECISION_STORAGE_KEY)

    if (!rawValue) {
      return null
    }

    const parsedValue = JSON.parse(rawValue)

    if (!parsedValue || parsedValue.round !== round) {
      return null
    }

    const selections = normalizeSelections(parsedValue.selections)

    return {
      round: parsedValue.round,
      selections,
      usedFocusHours: sanitizeHours(parsedValue.usedFocusHours ?? sumInvestedHours(selections)),
      totalCost: sanitizeCost(
        parsedValue.totalCost ?? selections.reduce((sum, selection) => sum + selection.cost, 0),
      ),
      savedAt: parsedValue.savedAt,
    }
  } catch {
    return null
  }
}

export function saveProjectsDecision(decision) {
  const selections = normalizeSelections(decision?.selections)

  const normalizedDecision = {
    round: Number(decision?.round) || 0,
    selections,
    usedFocusHours: sanitizeHours(decision?.usedFocusHours ?? sumInvestedHours(selections)),
    totalCost: sanitizeCost(
      decision?.totalCost ?? selections.reduce((sum, selection) => sum + selection.cost, 0),
    ),
    savedAt: decision?.savedAt ?? new Date().toISOString(),
  }

  window.localStorage.setItem(PROJECTS_DECISION_STORAGE_KEY, JSON.stringify(normalizedDecision))
}