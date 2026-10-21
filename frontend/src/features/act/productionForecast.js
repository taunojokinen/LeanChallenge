import { calculateRoundForecast } from '../../entities/forecast/model.js'

export function createInitialProductionPlan(gameState, batchSize, actDecision, factorySettings) {
  const price = actDecision?.price ?? gameState.market?.price ?? 25000
  const addedVariations = actDecision?.addedVariations ?? 0
  const baseForecast = calculateRoundForecast(
    gameState,
    { market: { price, addedVariations, batchSize } },
    factorySettings,
  )

  return {
    price,
    batchSize,
    addedVariations: baseForecast.decisions.market.addedVariations,
    productionQuantity: Math.min(baseForecast.summary.plantCapacity, Math.max(0,
      actDecision?.productionQuantity ??
        gameState.market?.productionQuantity ??
        Math.min(baseForecast.summary.demand, baseForecast.summary.plantCapacity),
    )),
    useFinishedGoodsInventoryForDeliveries: actDecision?.useFinishedGoodsInventoryForDeliveries ?? false,
  }
}

export function calculateProductionForecast(gameState, market, factorySettings) {
  const requestedForecast = calculateRoundForecast(gameState, { market }, factorySettings)
  const clampedQuantity = Math.min(market.productionQuantity, requestedForecast.summary.plantCapacity)

  return clampedQuantity === market.productionQuantity
    ? requestedForecast
    : calculateRoundForecast(gameState, {
        market: { ...market, productionQuantity: clampedQuantity },
      }, factorySettings)
}
