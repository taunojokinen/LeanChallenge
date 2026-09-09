function cloneDepartments(departments) {
  return Object.fromEntries(
    Object.entries(departments ?? {}).map(([department, values]) => [department, { ...values }]),
  )
}

function cloneMethods(methods) {
  return Object.fromEntries(
    Object.entries(methods ?? {}).map(([department, values]) => [department, { ...values }]),
  )
}

/**
 * Selects only state that belongs in the next gameplay opening state.
 * Forecast totals, current-round history, and presentation metrics stay outside this shape.
 */
export function buildCanonicalCarryoverState({ round, closingState }) {
  const finance = closingState?.finance ?? {}
  const inventory = closingState?.inventory ?? {}

  return {
    round,
    market: { ...closingState.market },
    production: {
      machiningMachines: closingState.production.machiningMachines,
    },
    staffing: {
      assembly: closingState.staffing.assembly,
      shipping: closingState.staffing.shipping,
    },
    lean: {
      fiveS: {
        focusBudgetHours: closingState.lean.fiveS.focusBudgetHours,
        departments: cloneDepartments(closingState.lean.fiveS.departments),
      },
      methods: cloneMethods(closingState.lean.methods),
    },
    factory: { ...closingState.factory },
    investments: {
      setupAutomation: {
        installed: Boolean(closingState.investments.setupAutomation.installed),
      },
      automaticProcessMeasurement: {
        installed: Boolean(closingState.investments.automaticProcessMeasurement.installed),
      },
      conditionMonitoring: {
        installed: Boolean(closingState.investments.conditionMonitoring.installed),
      },
    },
    inventory: {
      finishedGoodsContainers: inventory.finishedGoodsContainers,
    },
    finance: {
      cash: finance.cash,
      bankLoans: finance.bankLoans,
      equity: finance.equity,
      otherLiabilities: finance.otherLiabilities,
      machineryBookValue: finance.machineryBookValue,
      buildingsBookValue: finance.buildingsBookValue,
      finishedGoodsInventoryBookValue: finance.finishedGoodsInventoryBookValue,
      rawMaterialInventoryBookValue: finance.rawMaterialInventoryBookValue,
    },
  }
}
