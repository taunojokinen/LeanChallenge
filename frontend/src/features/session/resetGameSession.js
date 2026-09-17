export const GAME_DECISION_STORAGE_KEYS = [
  'lean-challenge-five-s-decision',
  'lean-challenge-projects-decision',
  'lean-challenge-investments-decision',
  'lean-challenge-check-staffing-decision',
  'lean-challenge-check-production-decision',
  'lean-challenge-act-decision',
]

export function resetGameDecisionStorage(storage) {
  const targetStorage = storage ?? window.localStorage

  GAME_DECISION_STORAGE_KEYS.forEach((key) => {
    targetStorage.removeItem(key)
  })
}
