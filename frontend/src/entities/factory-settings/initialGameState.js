import { DEFAULT_FACTORY_SETTINGS } from './defaultFactorySettings.js'
import { createInitialFactoryState } from './initialFactoryState.js'
import { buildCanonicalFinancialHistory } from './financialHistory.js'

export function createInitialGameState(factorySettings = DEFAULT_FACTORY_SETTINGS, options = {}) {
  const settings = factorySettings ?? DEFAULT_FACTORY_SETTINGS
  const nextState = createInitialFactoryState(settings, options)
  const history = buildCanonicalFinancialHistory(nextState, settings)
  nextState.finance = structuredClone(history.at(-1).finance)
  nextState.initialFinancialHistory = history
  return nextState
}