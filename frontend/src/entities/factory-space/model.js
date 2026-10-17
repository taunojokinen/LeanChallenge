import { DEFAULT_FACTORY_SETTINGS } from '../factory-settings/defaultFactorySettings.js'

function nonNegative(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, number) : 0
}

export function calculateMinimumFinishedGoodsContainers({
  variations,
  batchSize,
  machineCount,
}) {
  const machines = nonNegative(machineCount)
  return machines > 0
    ? nonNegative(variations) * nonNegative(batchSize) / (2 * machines)
    : 0
}

export function calculateFactorySpace(quantities, factorySettings = DEFAULT_FACTORY_SETTINGS) {
  const settings = factorySettings ?? DEFAULT_FACTORY_SETTINGS
  const factory = settings.factory ?? DEFAULT_FACTORY_SETTINGS.factory
  const inventory = settings.inventory ?? DEFAULT_FACTORY_SETTINGS.inventory
  const machiningArea = nonNegative(quantities.machineCount) * nonNegative(
    factory.machineSpaceM2 ?? DEFAULT_FACTORY_SETTINGS.factory.machineSpaceM2,
  )
  const assemblyArea = nonNegative(quantities.assemblyWorkers) * nonNegative(
    factory.workerSpaceM2 ?? DEFAULT_FACTORY_SETTINGS.factory.workerSpaceM2,
  )
  const shippingArea = nonNegative(quantities.dispatchM2)
  const officeAndSocialArea = nonNegative(quantities.officeAndSocialM2)
  const finishedGoodsContainers = Math.max(
    nonNegative(quantities.finishedGoodsContainers),
    nonNegative(quantities.minimumFinishedGoodsContainers),
  )
  const finishedGoodsArea = finishedGoodsContainers
    * nonNegative(
      inventory.finishedGoodsSpacePerContainerM2
        ?? DEFAULT_FACTORY_SETTINGS.inventory.finishedGoodsSpacePerContainerM2,
    )
  const totalArea = nonNegative(quantities.totalAreaM2)
  const totalUsed = machiningArea + assemblyArea + shippingArea
    + officeAndSocialArea + finishedGoodsArea

  return {
    totalArea,
    machiningArea,
    assemblyArea,
    shippingArea,
    dispatchArea: shippingArea,
    officeAndSocialArea,
    officeArea: officeAndSocialArea,
    finishedGoodsContainers,
    finishedGoodsArea,
    totalUsed,
    freeArea: totalArea - totalUsed,
  }
}
