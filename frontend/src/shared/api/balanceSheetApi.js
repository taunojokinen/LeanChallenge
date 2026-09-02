import snapshot from '../../mocks/balanceSheetSnapshot.json'
import { DEFAULT_FACTORY_SETTINGS } from '../../entities/factory-settings/defaultFactorySettings.js'
import { createInitialGameState } from '../../entities/factory-settings/initialGameState.js'
import { buildInitialBalanceSheetHistory } from '../../entities/factory-settings/financialHistory.js'

export async function getBalanceSheetSnapshot() {
  return Promise.resolve(snapshot)
}

export async function getInitialBalanceSheetHistory(
  gameState = null,
  factorySettings = DEFAULT_FACTORY_SETTINGS,
) {
  const sourceState = gameState || createInitialGameState(factorySettings)
  return Promise.resolve(buildInitialBalanceSheetHistory(sourceState, factorySettings))
}