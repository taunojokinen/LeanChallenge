import { DEFAULT_FACTORY_SETTINGS } from '../factory-settings/defaultFactorySettings.js'
import initialState from './forecastInitialState.json' with { type: 'json' }

export const roundConfirmationCases = [
  { name: 'batch-10', batchSize: 10 },
  { name: 'batch-20', batchSize: 20 },
  { name: 'stock-off', productionQuantity: 40 },
  { name: 'stock-on', productionQuantity: 40, useStock: true },
  { name: 'staffing-and-development', develop: true },
  { name: 'bankruptcy', equity: 1 },
  { name: 'round-limit', round: 12, equity: 100000000 },
  { name: 'bankruptcy-at-limit', round: 12, equity: 1 },
]

export function createRoundConfirmationInput({
  round = 1, batchSize = 20, productionQuantity = 10000, useStock = false, develop = false, equity,
}) {
  const gameState = structuredClone(initialState)
  gameState.round = round
  gameState.market.batchSize = 5
  gameState.inventory.finishedGoodsContainers = 180
  gameState.factory.totalAreaM2 = 10000
  if (equity !== undefined) gameState.finance.equity = equity
  const decision = (fields) => ({ round, ...fields, savedAt: '2026-01-01T00:00:00.000Z' })

  return {
    gameState,
    factorySettings: structuredClone(DEFAULT_FACTORY_SETTINGS),
    decisions: {
      actDecision: decision({
        price: 25000,
        addedVariations: 0,
        productionQuantity,
        useFinishedGoodsInventoryForDeliveries: useStock,
      }),
      checkProductionDecision: decision({ batchSize }),
      checkStaffingDecision: develop ? decision({ staffing: { assembly: 45, shipping: 7 } }) : null,
      fiveSDecision: develop ? decision({ investedHours: { machining: 90, assembly: 80, shipping: 70 } }) : null,
      projectsDecision: develop ? decision({
        selections: [{ department: 'machining', method: 'smed', investedHours: 100 }],
      }) : null,
      investmentsDecision: develop ? decision({ investments: [{ type: 'new-machine', quantity: 1 }] }) : null,
    },
  }
}
