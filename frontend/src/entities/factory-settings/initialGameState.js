import { DEFAULT_FACTORY_SETTINGS } from './defaultFactorySettings.js'

function toNonNegativeInt(value, fallback = 0) {
  const numeric = Number(value)

  if (!Number.isFinite(numeric)) {
    return Math.max(0, Math.round(Number(fallback) || 0))
  }

  return Math.max(0, Math.round(numeric))
}

export function createInitialGameState(factorySettings = DEFAULT_FACTORY_SETTINGS) {
  const settings = factorySettings ?? DEFAULT_FACTORY_SETTINGS
  const initialState = settings.initialState ?? DEFAULT_FACTORY_SETTINGS.initialState
  const nextState = structuredClone(initialState)

  const workersPerMachine = toNonNegativeInt(settings.production?.workersPerMachine, 5)
  const machineCount = toNonNegativeInt(nextState.production?.machiningMachines, 0)
  const existingMachining = nextState.staffing?.machining

  nextState.staffing = {
    machining:
      existingMachining == null
        ? machineCount * workersPerMachine
        : toNonNegativeInt(existingMachining, machineCount * workersPerMachine),
    assembly: toNonNegativeInt(nextState.staffing?.assembly, 0),
    shipping: toNonNegativeInt(nextState.staffing?.shipping, 0),
  }

  return nextState
}