import { calculateNextFiveSState } from '../five-s/model.js'
import { canFinanceInvestment } from '../investments/model.js'

const HOURS_PER_MACHINE_PER_ROUND = 1040
const HOURS_PER_WORKER_PER_ROUND = 1040
const MACHINING_NORM_HOURS_PER_CONTAINER = 6
const ASSEMBLY_NORM_HOURS_PER_CONTAINER = 90
const SHIPPING_NORM_HOURS_PER_CONTAINER = 10

const PRICE_REFERENCE = 25000
const DEMAND_REFERENCE_PER_VARIATION = 10
const PRICE_ELASTICITY = -4

const STAFF_COST_PER_ROUND = 12500
const MATERIAL_COST_PER_SOLD_CONTAINER = 10000
const FIXED_COST_PER_ROUND = 750000
const INTEREST_RATE_PER_ROUND = 0.0125

const MACHINERY_DEPRECIATION_PER_ROUND = 0.05
const BUILDING_DEPRECIATION_PER_ROUND = 0.025

const FINISHED_GOODS_VALUE_PER_CONTAINER = 20000
const FINISHED_GOODS_AREA_PER_CONTAINER = 15
const ASSEMBLY_AREA_PER_WORKER = 25

const MIN_COMPONENT_PCT = 0
const MAX_COMPONENT_PCT = 95

const DEFAULT_MARKET_DECISION = {
  price: PRICE_REFERENCE,
  runsPerVariation: 2,
  newVariations: 0,
  activeVariationCount: 1,
}

const PHASE_KEY_TO_DEPARTMENT = {
  machining: 'machining',
  assembly: 'assembly',
  dispatch: 'shipping',
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function toNonNegativeInt(value, fallback = 0) {
  return Math.max(0, Math.round(toNumber(value, fallback)))
}

export function calculateKNL(kPct, nPct, lPct) {
  return (toNumber(kPct) / 100) * (toNumber(nPct) / 100) * (toNumber(lPct) / 100)
}

export function calculateDemandPerVariation(price) {
  const safePrice = Math.max(1, toNumber(price, PRICE_REFERENCE))
  const demand = DEMAND_REFERENCE_PER_VARIATION * (safePrice / PRICE_REFERENCE) ** PRICE_ELASTICITY
  return Math.max(0, Math.round(demand))
}

export function calculateAllowedNewVariations(qualityPct) {
  const quality = toNumber(qualityPct)

  if (quality < 75) {
    return 0
  }

  if (quality < 80) {
    return 1
  }

  return 2
}

function calculateLearningComponent(basePct, effectiveHours, maxPct = 95) {
  const safeBase = toNumber(basePct)
  const safeMax = Math.max(safeBase, toNumber(maxPct, 95))
  const safeHours = Math.max(0, toNumber(effectiveHours))

  // Shared curve: approaches maxPct asymptotically, near 90% around 2000h when base is 70%.
  const curveRatio = 1 - Math.exp(-safeHours / 1200)
  return clamp(safeBase + (safeMax - safeBase) * curveRatio, MIN_COMPONENT_PCT, MAX_COMPONENT_PCT)
}

function calculateSmedChangeoverHours(smedHours, automationReductionMinutes = 0) {
  const safeHours = Math.max(0, toNumber(smedHours))
  const baselineHours = 0.5 + 7.5 * Math.exp(-safeHours / 450)
  const automatedHours = baselineHours - toNumber(automationReductionMinutes) / 60
  return Math.max(0.5, automatedHours)
}

function calculateTpmDowntimeLoss(tpmHours) {
  const safeHours = Math.max(0, toNumber(tpmHours))
  return 0.01 + 0.09 * Math.exp(-safeHours / 450)
}

function summarizeProjectsDecision(projectsDecision, projectsSnapshot) {
  const hoursByDepartmentAndMethod = {}

  const baseLevels = {}
  projectsSnapshot.departments.forEach((department) => {
    baseLevels[department.key] = {}
    department.methods.forEach((method) => {
      baseLevels[department.key][method.key] = toNumber(method.effectiveHours)
    })
  })

  const selections = Array.isArray(projectsDecision?.selections) ? projectsDecision.selections : []

  selections.forEach((selection) => {
    const department = String(selection.department || '').trim()
    const method = String(selection.method || '').trim()

    if (!department || !method) {
      return
    }

    if (!hoursByDepartmentAndMethod[department]) {
      hoursByDepartmentAndMethod[department] = {}
    }

    const currentHours = hoursByDepartmentAndMethod[department][method] || 0
    hoursByDepartmentAndMethod[department][method] = currentHours + toNonNegativeInt(selection.investedHours)
  })

  const mergedLevels = {}
  Object.entries(baseLevels).forEach(([departmentKey, methods]) => {
    mergedLevels[departmentKey] = {}

    Object.entries(methods).forEach(([methodKey, baseHours]) => {
      const decisionHours = hoursByDepartmentAndMethod[departmentKey]?.[methodKey] || 0
      mergedLevels[departmentKey][methodKey] = baseHours + decisionHours
    })
  })

  return {
    selections,
    mergedLevels,
  }
}

function summarizeInvestmentsDecision(investmentsDecision, investmentsSnapshot) {
  const result = {
    newMachines: 0,
    expansions: 0,
    automationMachineCount: 0,
    automaticProcessMeasurement: Boolean(
      investmentsSnapshot.investments.automaticProcessMeasurement.installed,
    ),
    conditionMonitoring: Boolean(investmentsSnapshot.investments.conditionMonitoring.installed),
    totalCost: 0,
  }

  const rows = Array.isArray(investmentsDecision?.investments) ? investmentsDecision.investments : []

  rows.forEach((row) => {
    const type = String(row.type || '').trim()
    const quantity = Math.max(1, toNonNegativeInt(row.quantity, 1))
    const cost = toNonNegativeInt(row.cost)

    if (type === investmentsSnapshot.investments.newMachine.type) {
      result.newMachines += quantity
    } else if (type === investmentsSnapshot.investments.factoryExpansion.type) {
      result.expansions += quantity
    } else if (type === investmentsSnapshot.investments.moldChangeAutomation.type) {
      result.automationMachineCount += 1
    } else if (type === investmentsSnapshot.investments.automaticProcessMeasurement.type) {
      result.automaticProcessMeasurement = true
    } else if (type === investmentsSnapshot.investments.conditionMonitoring.type) {
      result.conditionMonitoring = true
    }

    result.totalCost += cost
  })

  return result
}

function resolveStaffing(investmentsSnapshot, staffingDecision, machineCount) {
  const baselineAssembly = toNonNegativeInt(
    investmentsSnapshot.factory.assemblyWorkers,
    25,
  )
  const baselineShipping = toNonNegativeInt(
    investmentsSnapshot.factory.shippingWorkers,
    5,
  )

  const assembly =
    staffingDecision && staffingDecision.assembly != null
      ? toNonNegativeInt(staffingDecision.assembly)
      : baselineAssembly
  const shipping =
    staffingDecision && staffingDecision.shipping != null
      ? toNonNegativeInt(staffingDecision.shipping)
      : baselineShipping

  return {
    machining: toNonNegativeInt(machineCount) * 5,
    assembly,
    shipping,
    baseline: {
      assembly: baselineAssembly,
      shipping: baselineShipping,
    },
  }
}

function calculateDepartmentMetrics({
  key,
  machineCount,
  staffing,
  fiveSEffectiveHours,
  methodHours,
  switches,
  automationMachineCount,
  conditionMonitoring,
  automaticProcessMeasurement,
}) {
  const fiveSContribution = fiveSEffectiveHours / 3
  const smedHours = toNumber(methodHours.smed) + fiveSContribution
  const tpmHours = toNumber(methodHours.tpm) + fiveSContribution
  const methodDevHours = toNumber(methodHours['method-development']) + fiveSContribution
  const qualityHours = toNumber(methodHours.spc) + toNumber(methodHours['poka-yoke']) + fiveSContribution

  if (key === 'machining') {
    const automationShare = machineCount > 0 ? automationMachineCount / machineCount : 0
    const averageAutomationReductionMinutes = 10 * clamp(automationShare, 0, 1)
    const changeoverHours = calculateSmedChangeoverHours(smedHours, averageAutomationReductionMinutes)
    const downtimeLoss = calculateTpmDowntimeLoss(tpmHours)
    const switchLoss = machineCount > 0 ? (switches * changeoverHours) / (machineCount * HOURS_PER_MACHINE_PER_ROUND) : 0

    const availabilityPct = clamp(
      (1 - downtimeLoss - Math.max(0, switchLoss)) * 100 + (conditionMonitoring ? 2 : 0),
      50,
      MAX_COMPONENT_PCT,
    )
    const speedPct = calculateLearningComponent(90, methodDevHours, 95)
    const qualityPct = clamp(
      calculateLearningComponent(70, qualityHours, 95) + (automaticProcessMeasurement ? 2 : 0),
      MIN_COMPONENT_PCT,
      MAX_COMPONENT_PCT,
    )

    const knl = calculateKNL(availabilityPct, speedPct, qualityPct)
    const theoreticalCapacityHours = machineCount * HOURS_PER_MACHINE_PER_ROUND
    const effectiveCapacityHours = theoreticalCapacityHours * knl
    const capacityContainers = Math.floor(effectiveCapacityHours / MACHINING_NORM_HOURS_PER_CONTAINER)

    return {
      kPct: availabilityPct,
      nPct: speedPct,
      lPct: qualityPct,
      knl,
      capacityContainers,
      changeoverHours,
    }
  }

  if (key === 'assembly') {
    const availabilityPct = clamp(
      calculateLearningComponent(70, smedHours + tpmHours, 95) + (conditionMonitoring ? 2 : 0),
      MIN_COMPONENT_PCT,
      MAX_COMPONENT_PCT,
    )
    const speedPct = calculateLearningComponent(70, methodDevHours, 95)
    const qualityPct = clamp(
      calculateLearningComponent(70, qualityHours, 95) + (automaticProcessMeasurement ? 2 : 0),
      MIN_COMPONENT_PCT,
      MAX_COMPONENT_PCT,
    )
    const knl = calculateKNL(availabilityPct, speedPct, qualityPct)
    const effectiveHours = staffing.assembly * HOURS_PER_WORKER_PER_ROUND * knl
    const capacityContainers = Math.floor(effectiveHours / ASSEMBLY_NORM_HOURS_PER_CONTAINER)

    return {
      kPct: availabilityPct,
      nPct: speedPct,
      lPct: qualityPct,
      knl,
      capacityContainers,
      changeoverHours: 0,
    }
  }

  const availabilityPct = clamp(
    calculateLearningComponent(70, smedHours + tpmHours, 95) + (conditionMonitoring ? 2 : 0),
    MIN_COMPONENT_PCT,
    MAX_COMPONENT_PCT,
  )
  const speedPct = calculateLearningComponent(70, methodDevHours, 95)
  const qualityPct = clamp(
    calculateLearningComponent(70, qualityHours, 95) + (automaticProcessMeasurement ? 2 : 0),
    MIN_COMPONENT_PCT,
    MAX_COMPONENT_PCT,
  )
  const knl = calculateKNL(availabilityPct, speedPct, qualityPct)
  const effectiveHours = staffing.shipping * HOURS_PER_WORKER_PER_ROUND * knl
  const capacityContainers = Math.floor(effectiveHours / SHIPPING_NORM_HOURS_PER_CONTAINER)

  return {
    kPct: availabilityPct,
    nPct: speedPct,
    lPct: qualityPct,
    knl,
    capacityContainers,
    changeoverHours: 0,
  }
}

function calculateScenario({
  investmentsSnapshot,
  projectsSnapshot,
  fiveSSnapshot,
  balanceSheetSnapshot,
  decisions,
  staffingDecision,
  applyDoDecisions,
}) {
  const market = {
    ...DEFAULT_MARKET_DECISION,
    ...(decisions.market || {}),
  }

  const projects = summarizeProjectsDecision(
    applyDoDecisions ? decisions.projectsDecision : null,
    projectsSnapshot,
  )
  const investments = summarizeInvestmentsDecision(
    applyDoDecisions ? decisions.investmentsDecision : null,
    investmentsSnapshot,
  )

  const machineCountBase = toNonNegativeInt(investmentsSnapshot.factory.machiningMachineCount)
  const machineCount = machineCountBase + investments.newMachines
  const totalArea =
    toNonNegativeInt(investmentsSnapshot.factory.totalAreaM2) + investments.expansions * 1000

  const staffing = resolveStaffing(investmentsSnapshot, staffingDecision, machineCount)

  const fiveSHoursByDepartment = {
    machining: toNumber(fiveSSnapshot.departments.find((item) => item.key === 'machining')?.fiveSEffectiveHours),
    assembly: toNumber(fiveSSnapshot.departments.find((item) => item.key === 'assembly')?.fiveSEffectiveHours),
    shipping: toNumber(fiveSSnapshot.departments.find((item) => item.key === 'shipping')?.fiveSEffectiveHours),
  }

  if (applyDoDecisions) {
    const invested = decisions.fiveSDecision?.investedHours || {}

    fiveSHoursByDepartment.machining = calculateNextFiveSState(
      fiveSHoursByDepartment.machining,
      invested.machining,
    ).nextEffectiveHours
    fiveSHoursByDepartment.assembly = calculateNextFiveSState(
      fiveSHoursByDepartment.assembly,
      invested.assembly,
    ).nextEffectiveHours
    fiveSHoursByDepartment.shipping = calculateNextFiveSState(
      fiveSHoursByDepartment.shipping,
      invested.shipping,
    ).nextEffectiveHours
  }

  const projectedQualityAverage =
    (calculateLearningComponent(70, (projects.mergedLevels.machining?.spc || 0) + fiveSHoursByDepartment.machining / 3, 95) +
      calculateLearningComponent(70, (projects.mergedLevels.assembly?.['poka-yoke'] || 0) + fiveSHoursByDepartment.assembly / 3, 95) +
      calculateLearningComponent(70, (projects.mergedLevels.shipping?.['poka-yoke'] || 0) + fiveSHoursByDepartment.shipping / 3, 95)) /
    3

  const allowedNewVariations = calculateAllowedNewVariations(projectedQualityAverage)
  const selectedNewVariations = clamp(toNonNegativeInt(market.newVariations), 0, allowedNewVariations)
  const activeVariationCount = Math.max(1, toNonNegativeInt(market.activeVariationCount, 1))
  const totalVariations = activeVariationCount + selectedNewVariations
  const runsPerVariation = Math.max(1, toNonNegativeInt(market.runsPerVariation, 2))
  const productionRuns = totalVariations * runsPerVariation
  const switches = productionRuns

  const machiningMetrics = calculateDepartmentMetrics({
    key: 'machining',
    machineCount,
    staffing,
    fiveSEffectiveHours: fiveSHoursByDepartment.machining,
    methodHours: projects.mergedLevels.machining || {},
    switches,
    automationMachineCount: investments.automationMachineCount,
    conditionMonitoring: investments.conditionMonitoring,
    automaticProcessMeasurement: investments.automaticProcessMeasurement,
  })

  const assemblyMetrics = calculateDepartmentMetrics({
    key: 'assembly',
    machineCount,
    staffing,
    fiveSEffectiveHours: fiveSHoursByDepartment.assembly,
    methodHours: projects.mergedLevels.assembly || {},
    switches,
    automationMachineCount: investments.automationMachineCount,
    conditionMonitoring: investments.conditionMonitoring,
    automaticProcessMeasurement: investments.automaticProcessMeasurement,
  })

  const shippingMetrics = calculateDepartmentMetrics({
    key: 'shipping',
    machineCount,
    staffing,
    fiveSEffectiveHours: fiveSHoursByDepartment.shipping,
    methodHours: projects.mergedLevels.shipping || {},
    switches,
    automationMachineCount: investments.automationMachineCount,
    conditionMonitoring: investments.conditionMonitoring,
    automaticProcessMeasurement: investments.automaticProcessMeasurement,
  })

  const capacityByDepartment = {
    machining: machiningMetrics.capacityContainers,
    assembly: assemblyMetrics.capacityContainers,
    shipping: shippingMetrics.capacityContainers,
  }

  const bottleneckKey = Object.entries(capacityByDepartment).reduce(
    (smallestKey, [key, value]) => (value < capacityByDepartment[smallestKey] ? key : smallestKey),
    'machining',
  )

  const plantCapacity = capacityByDepartment[bottleneckKey]

  const demandPerVariation = calculateDemandPerVariation(market.price)
  const demand = Math.max(0, Math.round(demandPerVariation * totalVariations))
  const deliveries = Math.max(0, Math.min(demand, plantCapacity))
  const lostSalesUnits = Math.max(0, demand - deliveries)

  const batches = Math.max(1, productionRuns)
  const batchSize = deliveries / batches
  const averageFinishedGoodsInventory = (totalVariations * batchSize) / 2
  const finishedGoodsValue = averageFinishedGoodsInventory * FINISHED_GOODS_VALUE_PER_CONTAINER
  const finishedGoodsArea = averageFinishedGoodsInventory * FINISHED_GOODS_AREA_PER_CONTAINER

  const machineArea = machineCount * 250
  const assemblyArea = staffing.assembly * ASSEMBLY_AREA_PER_WORKER
  const dispatchArea = toNonNegativeInt(investmentsSnapshot.factory.dispatchM2)
  const officeArea = toNonNegativeInt(investmentsSnapshot.factory.officeAndSocialM2)
  const usedArea = machineArea + assemblyArea + dispatchArea + officeArea + finishedGoodsArea
  const freeFactorySpace = totalArea - usedArea

  const revenue = deliveries * toNumber(market.price, PRICE_REFERENCE)
  const materials = deliveries * MATERIAL_COST_PER_SOLD_CONTAINER
  const totalPersonnel = staffing.machining + staffing.assembly + staffing.shipping
  const labor = totalPersonnel * STAFF_COST_PER_ROUND
  const fixedCosts = FIXED_COST_PER_ROUND

  const baseFinishedGoodsContainers = toNumber(investmentsSnapshot.factory.finishedGoodsContainers)
  const inventoryChange =
    (averageFinishedGoodsInventory - baseFinishedGoodsContainers) * FINISHED_GOODS_VALUE_PER_CONTAINER

  const machineryBase = toNumber(balanceSheetSnapshot.assets.machinery)
  const buildingsBase = toNumber(balanceSheetSnapshot.assets.buildings)
  const machineryInvestments =
    investments.newMachines * toNumber(investmentsSnapshot.investments.newMachine.unitCost) +
    investments.automationMachineCount * toNumber(investmentsSnapshot.investments.moldChangeAutomation.unitCost) +
    (investments.automaticProcessMeasurement
      ? toNumber(investmentsSnapshot.investments.automaticProcessMeasurement.unitCost)
      : 0) +
    (investments.conditionMonitoring
      ? toNumber(investmentsSnapshot.investments.conditionMonitoring.unitCost)
      : 0)
  const buildingInvestments =
    investments.expansions * toNumber(investmentsSnapshot.investments.factoryExpansion.unitCost)

  const depreciation =
    (machineryBase + machineryInvestments) * MACHINERY_DEPRECIATION_PER_ROUND +
    (buildingsBase + buildingInvestments) * BUILDING_DEPRECIATION_PER_ROUND

  const financing = canFinanceInvestment(investments.totalCost, {
    cashBalance: toNumber(balanceSheetSnapshot.assets.cash),
    bankLoanDebt: toNumber(balanceSheetSnapshot.liabilities.bankLoans),
    equity:
      toNumber(balanceSheetSnapshot.assets.machinery) +
      toNumber(balanceSheetSnapshot.assets.buildings) +
      toNumber(balanceSheetSnapshot.assets.cash) +
      toNumber(balanceSheetSnapshot.assets.inventory) -
      toNumber(balanceSheetSnapshot.liabilities.bankLoans),
  })

  const interest = financing.debtAfter * INTEREST_RATE_PER_ROUND

  const result = revenue - materials - labor - fixedCosts + inventoryChange - depreciation - interest

  return {
    market: {
      price: toNumber(market.price, PRICE_REFERENCE),
      demandPerVariation,
      selectedNewVariations,
      allowedNewVariations,
      activeVariationCount,
      totalVariations,
      runsPerVariation,
    },
    knl: {
      machining: machiningMetrics,
      assembly: assemblyMetrics,
      shipping: shippingMetrics,
      totalQualityAverage: projectedQualityAverage,
    },
    staffing,
    capacityByDepartment,
    bottleneckKey,
    plantCapacity,
    demand,
    deliveries,
    lostSalesUnits,
    productionRuns,
    switches,
    batchSize,
    inventory: {
      averageFinishedGoodsInventory,
      finishedGoodsValue,
      finishedGoodsArea,
      baseFinishedGoodsContainers,
      inventoryChange,
    },
    space: {
      totalArea,
      machineArea,
      assemblyArea,
      dispatchArea,
      officeArea,
      usedArea,
      freeFactorySpace,
    },
    finance: {
      revenue,
      materials,
      labor,
      fixedCosts,
      inventoryChange,
      depreciation,
      interest,
      result,
    },
    investments,
  }
}

function buildCurrentStateFromProductionSnapshot(productionSnapshot) {
  if (!productionSnapshot || !Array.isArray(productionSnapshot.phases)) {
    return null
  }

  const knl = {
    machining: null,
    assembly: null,
    shipping: null,
  }

  const capacityByDepartment = {
    machining: 0,
    assembly: 0,
    shipping: 0,
  }

  productionSnapshot.phases.forEach((phase) => {
    const departmentKey = PHASE_KEY_TO_DEPARTMENT[phase.key]

    if (!departmentKey) {
      return
    }

    const kPct = toNumber(phase.availabilityPct)
    const nPct = toNumber(phase.speedPct)
    const lPct = toNumber(phase.qualityPct)
    const phaseKnl = calculateKNL(kPct, nPct, lPct)
    const capacityContainers = Math.floor(toNumber(phase.maxCapacity) * phaseKnl)

    knl[departmentKey] = {
      kPct,
      nPct,
      lPct,
      knl: phaseKnl,
      capacityContainers,
      changeoverHours: 0,
    }
    capacityByDepartment[departmentKey] = capacityContainers
  })

  const bottleneckKey = Object.entries(capacityByDepartment).reduce(
    (smallestKey, [key, value]) => (value < capacityByDepartment[smallestKey] ? key : smallestKey),
    'machining',
  )

  return {
    knl,
    capacityByDepartment,
    bottleneckKey,
    plantCapacity: capacityByDepartment[bottleneckKey],
  }
}

function buildInsights(currentScenario, forecastScenario) {
  const insights = []

  if (forecastScenario.bottleneckKey !== currentScenario.bottleneckKey) {
    const labels = {
      machining: 'Koneistus',
      assembly: 'Koonta',
      shipping: 'Lähettämö',
    }

    insights.push(
      `Pullonkaula siirtyi osastolle ${labels[forecastScenario.bottleneckKey]}. Kapasiteetin optimointi kannattaa kohdistaa sinne.`,
    )
  }

  if (forecastScenario.knl.machining.changeoverHours < currentScenario.knl.machining.changeoverHours) {
    insights.push('SMED- ja automaatiopanostukset lyhensivät vaihtoaikaa, mikä nosti koneistuksen käytettävyyttä.')
  }

  if (forecastScenario.staffing.assembly > currentScenario.staffing.assembly) {
    insights.push('Koonnan lisähenkilöstö kasvatti kapasiteettia, mutta nosti samalla henkilöstökustannusta ja tilankäyttöä.')
  }

  if (forecastScenario.inventory.averageFinishedGoodsInventory < currentScenario.inventory.averageFinishedGoodsInventory) {
    insights.push('Pienempi eräkoko laski keskimääräistä valmistuotevarastoa ja vapautti tehdastilaa.')
  }

  if (insights.length < 2) {
    insights.push('Toimitukset määräytyvät pullonkaulan mukaan: kapasiteetti määrittää myyntipotentiaalin kierroksella.')
  }

  if (insights.length < 2) {
    insights.push('Kysyntäjoustossa pienikin hinnanmuutos voi vaikuttaa kysyntään voimakkaasti.')
  }

  return insights.slice(0, 4)
}

export function calculateRoundForecast(gameState, decisions = {}) {
  const baseActiveVariationCount = toNonNegativeInt(
    gameState.productionSnapshot?.market?.activeVariations,
    1,
  )

  const resolvedDecisions = {
    fiveSDecision: gameState.fiveSDecision || null,
    projectsDecision: gameState.projectsDecision || null,
    investmentsDecision: gameState.investmentsDecision || null,
    market: {
      ...DEFAULT_MARKET_DECISION,
      activeVariationCount: baseActiveVariationCount,
      ...(gameState.marketDecision || {}),
      ...(decisions.market || {}),
    },
  }

  const currentScenario = calculateScenario({
    investmentsSnapshot: gameState.investmentsSnapshot,
    projectsSnapshot: gameState.projectsSnapshot,
    fiveSSnapshot: gameState.fiveSSnapshot,
    balanceSheetSnapshot: gameState.balanceSheetSnapshot,
    decisions: resolvedDecisions,
    staffingDecision: null,
    applyDoDecisions: false,
  })

  const forecastScenario = calculateScenario({
    investmentsSnapshot: gameState.investmentsSnapshot,
    projectsSnapshot: gameState.projectsSnapshot,
    fiveSSnapshot: gameState.fiveSSnapshot,
    balanceSheetSnapshot: gameState.balanceSheetSnapshot,
    decisions: resolvedDecisions,
    staffingDecision: decisions.staffing || gameState.checkStaffingDecision?.staffing || null,
    applyDoDecisions: true,
  })

  const departmentLabels = {
    machining: 'Koneistus',
    assembly: 'Koonta',
    shipping: 'Lähettämö',
  }

  const currentFromSnapshot = buildCurrentStateFromProductionSnapshot(gameState.productionSnapshot)
  const currentState = currentFromSnapshot || currentScenario

  return {
    round: gameState.round,
    decisions: {
      fiveS: resolvedDecisions.fiveSDecision?.investedHours || {
        machining: 0,
        assembly: 0,
        shipping: 0,
      },
      projects: resolvedDecisions.projectsDecision?.selections || [],
      investments: resolvedDecisions.investmentsDecision?.investments || [],
      market: {
        price: resolvedDecisions.market.price,
        runsPerVariation: resolvedDecisions.market.runsPerVariation,
        activeVariationCount: forecastScenario.market.activeVariationCount,
        totalVariations: forecastScenario.market.totalVariations,
        selectedNewVariations: forecastScenario.market.selectedNewVariations,
        allowedNewVariations: forecastScenario.market.allowedNewVariations,
      },
    },
    current: currentState,
    forecast: forecastScenario,
    summary: {
      bottleneckKey: forecastScenario.bottleneckKey,
      bottleneckLabel: departmentLabels[forecastScenario.bottleneckKey],
      demand: forecastScenario.demand,
      deliveries: forecastScenario.deliveries,
      lostSalesUnits: forecastScenario.lostSalesUnits,
      plantCapacity: forecastScenario.plantCapacity,
      revenue: forecastScenario.finance.revenue,
      result: forecastScenario.finance.result,
      finishedGoodsInventory: forecastScenario.inventory.averageFinishedGoodsInventory,
      freeFactorySpace: forecastScenario.space.freeFactorySpace,
    },
    insights: buildInsights(currentScenario, forecastScenario),
  }
}
