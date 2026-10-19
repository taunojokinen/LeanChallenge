export function calculateConfirmedInventoryTurnover(entry) {
  const inventory = entry?.inventory?.finishedGoodsContainers
  const deliveries = entry?.production?.deliveries
  if (inventory == null || deliveries == null
    || !Number.isFinite(Number(inventory)) || !Number.isFinite(Number(deliveries))
    || Number(inventory) <= 0) return null
  return Number(deliveries) / Number(inventory)
}

export function calculateAnnualConfirmedInventoryTurnover(entry) {
  const turnover = calculateConfirmedInventoryTurnover(entry)
  return turnover == null ? null : turnover * 4
}
