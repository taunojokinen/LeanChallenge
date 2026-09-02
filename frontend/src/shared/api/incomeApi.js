import snapshot from '../../mocks/incomeSnapshot.json'
import { DEFAULT_FACTORY_SETTINGS } from '../../entities/factory-settings/defaultFactorySettings.js'
import { createInitialGameState } from '../../entities/factory-settings/initialGameState.js'
import { buildInitialIncomeHistory } from '../../entities/factory-settings/financialHistory.js'

export async function getIncomeSnapshot() {
  return Promise.resolve(snapshot)
}

export async function getInitialIncomeHistory(gameState = null, factorySettings = DEFAULT_FACTORY_SETTINGS) {
  const sourceState = gameState || createInitialGameState(factorySettings)
  return Promise.resolve(buildInitialIncomeHistory(sourceState, factorySettings))
}