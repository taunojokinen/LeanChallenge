import { calculateRoundForecast } from '../forecast/model.js'
import { calculateProductionForecast, createInitialProductionPlan } from '../forecast/productionForecast.js'
import { advanceRoundState } from './advanceRound.js'
import { calculateAnnualConfirmedInventoryTurnover } from './financialMetrics.js'

export function calculateRoundConfirmation({
  factorySettings,
  currentGameState,
  decisions: {
    actDecision,
    checkStaffingDecision,
    checkProductionDecision,
    fiveSDecision,
    projectsDecision,
    investmentsDecision,
  },
}) {
  const round = currentGameState.round
  for (const decision of [
    actDecision, checkStaffingDecision, checkProductionDecision,
    fiveSDecision, projectsDecision, investmentsDecision,
  ]) {
    if (decision?.round != null && decision.round !== round) {
      throw new Error('Cannot confirm a decision from another round')
    }
  }

  const decisionGameState = {
    ...currentGameState,
    checkStaffingDecision,
    fiveSDecision,
    projectsDecision,
    investmentsDecision,
  }
  const batchSize = checkProductionDecision?.batchSize ??
    currentGameState.market?.batchSize ??
    factorySettings.production?.initialBatchSize ??
    20
  const plan = createInitialProductionPlan(decisionGameState, batchSize, actDecision, factorySettings)
  const preview = calculateProductionForecast(decisionGameState, plan, factorySettings)
  const forecast = calculateRoundForecast(decisionGameState, {
    market: {
      ...plan,
      productionQuantity: Math.min(plan.productionQuantity, preview.summary.plantCapacity),
    },
  }, factorySettings)

  const confirmation = advanceRoundState({
    gameState: currentGameState,
    forecast,
    totalRounds: factorySettings.game.totalRounds,
    checkProductionDecision: checkProductionDecision && { ...checkProductionDecision, round },
  })
  const { historyEntry, nextGameState } = confirmation
  return {
    ...confirmation,
    completion: nextGameState.completion ?? null,
    metrics: {
      capacity: forecast.summary.plantCapacity,
      production: historyEntry.production.actualProduction,
      deliveries: historyEntry.production.deliveries,
      inventorySales: forecast.summary.inventorySales,
      revenue: historyEntry.incomeStatement.revenue,
      result: historyEntry.incomeStatement.result,
      equity: historyEntry.finance.equity,
      knlRatio: forecast.forecast.factoryKnl.knl,
      inventoryTurnoverPerYear: calculateAnnualConfirmedInventoryTurnover(historyEntry),
    },
  }
}
