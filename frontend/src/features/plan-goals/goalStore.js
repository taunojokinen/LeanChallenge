const PLAN_GOALS_STORAGE_KEY = 'lean-challenge-plan-goals'

export function loadPlanGoals() {
  try {
    const rawValue = window.localStorage.getItem(PLAN_GOALS_STORAGE_KEY)

    if (!rawValue) {
      return []
    }

    const parsedValue = JSON.parse(rawValue)

    return Array.isArray(parsedValue) ? parsedValue : []
  } catch {
    return []
  }
}

export function savePlanGoals(goals) {
  window.localStorage.setItem(PLAN_GOALS_STORAGE_KEY, JSON.stringify(goals))
}
