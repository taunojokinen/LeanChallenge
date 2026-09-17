import { calculateNextFiveSState } from '../five-s/model.js'
import { canFinanceInvestment } from '../investments/model.js'
import { calculateFinancingStructure } from '../factory-settings/financingStructure.js'
import { DEFAULT_FACTORY_SETTINGS } from '../factory-settings/defaultFactorySettings.js'
import { buildCanonicalCarryoverState } from './carryover.js'
import { calculateFactoryKnl } from './factoryKnl.js'
import { calculateKNL } from './knl.js'

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

const MACHINERY_DEPRECIATION_PER_ROUND = 0.05
const BUILDING_DEPRECIATION_PER_ROUND = 0.025

const FINISHED_GOODS_VALUE_PER_CONTAINER = 20000
const FINISHED_GOODS_AREA_PER_CONTAINER = 15
const ASSEMBLY_AREA_PER_WORKER = 25
const RAW_MATERIAL_INVENTORY_SHARE = 0.4

const MIN_COMPONENT_PCT = 0
const MAX_COMPONENT_PCT = 95

const DEFAULT_MARKET_DECISION = {
  price: PRICE_REFERENCE,
  runsPerVariation: 2,
  newVariations: 0,
  addedVariations: 0,
  productionQuantity: null,
  batchSize: null,
  targetFinishedGoodsInventory: null,
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

function normalizePercentValue(value, fallback = 95) {
  const numeric = toNumber(value, fallback)

  if (numeric <= 1) {
    return numeric * 100
  }

  return numeric
}

export { calculateKNL } from './knl.js'

export function calculateDemandPerVariation(price, factorySettings = DEFAULT_FACTORY_SETTINGS) {
  const settings = factorySettings ?? DEFAULT_FACTORY_SETTINGS
  const referencePrice = toNumber(settings.market.referencePrice, PRICE_REFERENCE)
  const demandPerVariation = toNumber(
    settings.market.baseDemandPerVariation,
    DEMAND_REFERENCE_PER_VARIATION,
  )
  const priceElasticity = toNumber(settings.market.priceElasticity, PRICE_ELASTICITY)
  const safePrice = Math.max(1, toNumber(price, referencePrice))
  const demand = demandPerVariation * (safePrice / referencePrice) ** priceElasticity
  return Math.max(0, Math.round(demand))
}

export function calculateAllowedNewVariations(qualityPct, factorySettings = DEFAULT_FACTORY_SETTINGS) {
  const settings = factorySettings ?? DEFAULT_FACTORY_SETTINGS
  const variationRules = settings.variationRules ?? DEFAULT_FACTORY_SETTINGS.variationRules
  const quality = toNumber(qualityPct)
  const zeroThreshold = toNumber(variationRules.minimumQualityForZeroAdditionalVariations, 0.75) * 100
  const oneVariationThreshold = toNumber(variationRules.oneVariationMinQuality, 0.75) * 100

  if (quality < zeroThreshold) {
    return 0
  }

  if (quality < oneVariationThreshold) {
    return 1
  }

  return 2
}

function calculateLearningComponent(basePct, effectiveHours, maxPct = 95, curveHours = 1200) {
  const safeBase = toNumber(basePct)
  const safeMax = Math.max(safeBase, normalizePercentValue(maxPct, 95))
  const safeHours = Math.max(0, toNumber(effectiveHours))
  const safeCurveHours = Math.max(1, toNumber(curveHours, 1200))

  // Shared curve: approaches maxPct asymptotically, near 90% around 2000h when base is 70%.
  const curveRatio = 1 - Math.exp(-safeHours / safeCurveHours)
  return clamp(safeBase + (safeMax - safeBase) * curveRatio, MIN_COMPONENT_PCT, MAX_COMPONENT_PCT)
}

function calculateSmedChangeoverHours(smedHours, automationReductionMinutes = 0, smedSettings = null) {
  const settings = smedSettings ?? DEFAULT_FACTORY_SETTINGS.lean.smed
  const safeHours = Math.max(0, toNumber(smedHours))
  const initialSetupHours = toNumber(settings.initialSetupTimeHours, 8)
  const minimumSetupHours = toNumber(settings.minimumSetupTimeHours, 0.5)
  const decayHours = Math.max(1, toNumber(settings.decayHours, 450))
  const baselineHours = minimumSetupHours + (initialSetupHours - minimumSetupHours) * Math.exp(-safeHours / decayHours)
  const automatedHours = baselineHours - toNumber(automationReductionMinutes) / 60
  return Math.max(minimumSetupHours, automatedHours)
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
  const setupAutomation = investmentsSnapshot.investments.moldChangeAutomation
  const result = {
    newMachines: 0,
    expansions: 0,
    automationMachineCount: 0,
    setupAutomationInstalled: Boolean(
      setupAutomation.installed ||
        (Array.isArray(setupAutomation.installedMachineIds) &&
          setupAutomation.installedMachineIds.length > 0),
    ),
    setupAutomationPurchased: false,
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
    let cost = 0

    if (type === investmentsSnapshot.investments.newMachine.type) {
      result.newMachines += quantity
      cost = quantity * toNumber(investmentsSnapshot.investments.newMachine.unitCost)
    } else if (type === investmentsSnapshot.investments.factoryExpansion.type) {
      result.expansions += quantity
      cost = quantity * toNumber(investmentsSnapshot.investments.factoryExpansion.unitCost)
    } else if (type === investmentsSnapshot.investments.moldChangeAutomation.type) {
      if (!result.setupAutomationPurchased) {
        result.automationMachineCount = 1
        result.setupAutomationInstalled = true
        result.setupAutomationPurchased = true
        cost = toNumber(investmentsSnapshot.investments.moldChangeAutomation.unitCost)
      }
    } else if (type === investmentsSnapshot.investments.automaticProcessMeasurement.type) {
      result.automaticProcessMeasurement = true
      cost = toNumber(investmentsSnapshot.investments.automaticProcessMeasurement.unitCost)
    } else if (type === investmentsSnapshot.investments.conditionMonitoring.type) {
      result.conditionMonitoring = true
      cost = toNumber(investmentsSnapshot.investments.conditionMonitoring.unitCost)
    }

    result.totalCost += cost
  })

  return result
}

function resolveStaffing(investmentsSnapshot, staffingDecision, machineCount, workersPerMachine = 5) {
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
    machining: toNonNegativeInt(machineCount) * toNonNegativeInt(workersPerMachine, 5),
    assembly,
    shipping,
    baseline: {
      assembly: baselineAssembly,
      shipping: baselineShipping,
    },
  }
}

function buildProjectsSnapshotFromGameState(gameState, factorySettings) {
  const settings = factorySettings ?? DEFAULT_FACTORY_SETTINGS
  const methodSettings = settings.lean?.methods ?? DEFAULT_FACTORY_SETTINGS.lean.methods
  const methodFallbackHours = {
    machining: {
      smed: 0,
      tpm: 0,
      spc: 0,
    },
    assembly: {
      'method-development': toNonNegativeInt(methodSettings.fixedHours, 50),
      tpm: 0,
      'poka-yoke': 0,
    },
    shipping: {
      'method-development': toNonNegativeInt(methodSettings.fixedHours, 50),
      tpm: 0,
      'poka-yoke': 0,
    },
  }

  const stateMethods = gameState.lean?.methods ?? {}
  const withFallback = (departmentKey, methodKey) => {
    const methodValue = stateMethods?.[departmentKey]?.[methodKey]
    return toNumber(methodValue, methodFallbackHours[departmentKey][methodKey])
  }

  return {
    round: toNonNegativeInt(gameState.round, 1),
    departments: [
      {
        key: 'machining',
        methods: [
          { key: 'smed', effectiveHours: withFallback('machining', 'smed') },
          { key: 'tpm', effectiveHours: withFallback('machining', 'tpm') },
          { key: 'spc', effectiveHours: withFallback('machining', 'spc') },
        ],
      },
      {
        key: 'assembly',
        methods: [
          {
            key: 'method-development',
            effectiveHours: withFallback('assembly', 'method-development'),
          },
          { key: 'tpm', effectiveHours: withFallback('assembly', 'tpm') },
          { key: 'poka-yoke', effectiveHours: withFallback('assembly', 'poka-yoke') },
        ],
      },
      {
        key: 'shipping',
        methods: [
          {
            key: 'method-development',
            effectiveHours: withFallback('shipping', 'method-development'),
          },
          { key: 'tpm', effectiveHours: withFallback('shipping', 'tpm') },
          { key: 'poka-yoke', effectiveHours: withFallback('shipping', 'poka-yoke') },
        ],
      },
    ],
  }
}

function buildFiveSSnapshotFromGameState(gameState, factorySettings) {
  const settings = factorySettings ?? DEFAULT_FACTORY_SETTINGS
  const fiveSSettings = settings.lean?.fiveS ?? DEFAULT_FACTORY_SETTINGS.lean.fiveS
  const stateFiveS = gameState.lean?.fiveS ?? {}
  const stateDepartments = stateFiveS.departments ?? {}
  const weights = fiveSSettings.currentDepartmentWeights ?? DEFAULT_FACTORY_SETTINGS.lean.fiveS.currentDepartmentWeights

  const buildDepartment = (key, label) => ({
    key,
    name: label,
    fiveSEffectiveHours: toNumber(stateDepartments?.[key]?.effectiveHours),
    weight: toNumber(stateDepartments?.[key]?.weight, toNumber(weights?.[key])),
  })

  return {
    round: toNonNegativeInt(gameState.round, 1),
    focusBudgetHours: toNumber(stateFiveS.focusBudgetHours, toNumber(fiveSSettings.maxHours, 1600) / 4),
    departments: [
      buildDepartment('machining', 'Koneistus'),
      buildDepartment('assembly', 'Koonta'),
      buildDepartment('shipping', 'Lähettämö'),
    ],
    benefits: [],
  }
}

function buildInvestmentsSnapshotFromGameState(gameState, factorySettings) {
  const settings = factorySettings ?? DEFAULT_FACTORY_SETTINGS
  const configuredInvestments = settings.investments ?? DEFAULT_FACTORY_SETTINGS.investments
  const stateInvestments = gameState.investments ?? {}
  const setupAutomationState = stateInvestments.setupAutomation ?? {}
  const processMeasurementState = stateInvestments.automaticProcessMeasurement ?? {}
  const conditionMonitoringState = stateInvestments.conditionMonitoring ?? {}

  return {
    round: toNonNegativeInt(gameState.round, 1),
    factory: {
      totalAreaM2: toNonNegativeInt(gameState.factory?.totalAreaM2, 0),
      officeAndSocialM2: toNonNegativeInt(gameState.factory?.officeAndSocialM2, 0),
      machiningMachineCount: toNonNegativeInt(gameState.production?.machiningMachines, 0),
      assemblyWorkers: toNonNegativeInt(gameState.staffing?.assembly, 0),
      shippingWorkers: toNonNegativeInt(gameState.staffing?.shipping, 0),
      dispatchM2: toNonNegativeInt(gameState.factory?.dispatchM2, 0),
      finishedGoodsContainers: Math.max(0, toNumber(gameState.inventory?.finishedGoodsContainers, 0)),
    },
    investments: {
      newMachine: {
        type: configuredInvestments.newMachine?.type || 'new-machine',
        unitCost: toNumber(configuredInvestments.newMachine?.price, 500000),
      },
      factoryExpansion: {
        type: configuredInvestments.factoryExpansion?.type || 'factory-expansion',
        unitCost: toNumber(configuredInvestments.factoryExpansion?.price, 1000000),
      },
      moldChangeAutomation: {
        type: configuredInvestments.setupAutomation?.type || 'mold-change-automation',
        unitCost: toNumber(configuredInvestments.setupAutomation?.price, 250000),
        installed: Boolean(
          setupAutomationState.installed ||
            (Array.isArray(setupAutomationState.installedMachineIds) &&
              setupAutomationState.installedMachineIds.length > 0),
        ),
        installedMachineIds: Array.isArray(setupAutomationState.installedMachineIds)
          ? [...setupAutomationState.installedMachineIds]
          : [],
      },
      automaticProcessMeasurement: {
        type:
          configuredInvestments.automaticProcessMeasurement?.type ||
          'automatic-process-measurement',
        unitCost: toNumber(configuredInvestments.automaticProcessMeasurement?.price, 250000),
        installed: Boolean(processMeasurementState.installed),
      },
      conditionMonitoring: {
        type: configuredInvestments.conditionMonitoring?.type || 'condition-monitoring',
        unitCost: toNumber(configuredInvestments.conditionMonitoring?.price, 200000),
        installed: Boolean(conditionMonitoringState.installed),
      },
    },
  }
}

function buildBalanceSheetSnapshotFromGameState(gameState) {
  const legacyFinancials = gameState.financials?.balanceSheet
  const finance = gameState.finance ?? {}
  const legacyAssets = legacyFinancials?.assets ?? {}
  const legacyEquityAndLiabilities = legacyFinancials?.equityAndLiabilities ?? {}

  const machinery = toNumber(
    finance.machineryBookValue,
    toNumber(legacyAssets.machineryAndEquipment, toNumber(legacyAssets.machinery)),
  )
  const buildings = toNumber(finance.buildingsBookValue, toNumber(legacyAssets.buildings))
  const cash = toNumber(finance.cash, toNumber(legacyAssets.cash))
  const inventory = toNumber(
    finance.inventoryBookValue,
    toNumber(legacyAssets.finishedGoodsInventory, toNumber(legacyAssets.inventory)),
  )
  const bankLoans = toNumber(finance.bankLoans, toNumber(legacyEquityAndLiabilities.bankLoans))
  const overdraft = toNumber(finance.overdraft, toNumber(legacyEquityAndLiabilities.overdraft))
  const equity = toNumber(
    finance.equity,
    machinery + buildings + cash + inventory - bankLoans - overdraft,
  )

  return {
    round: toNonNegativeInt(gameState.round, 1),
    assets: {
      machinery,
      buildings,
      cash,
      inventory,
    },
    liabilities: {
      bankLoans,
      overdraft,
      equity,
    },
  }
}

function resolveForecastSnapshotInputs(gameState, factorySettings) {
  return {
    investmentsSnapshot:
      gameState.investmentsSnapshot || buildInvestmentsSnapshotFromGameState(gameState, factorySettings),
    projectsSnapshot:
      gameState.projectsSnapshot || buildProjectsSnapshotFromGameState(gameState, factorySettings),
    fiveSSnapshot: gameState.fiveSSnapshot || buildFiveSSnapshotFromGameState(gameState, factorySettings),
    balanceSheetSnapshot:
      gameState.balanceSheetSnapshot || buildBalanceSheetSnapshotFromGameState(gameState),
    productionSnapshot: gameState.productionSnapshot || null,
  }
}

function calculateDepartmentMetrics({
  key,
  machineCount,
  staffing,
  fiveSEffectiveHours,
  methodHours,
  changeoversPerMachine,
  totalChangeovers,
  batchSize,
  setupAutomationInstalled,
  conditionMonitoring,
  automaticProcessMeasurement,
  settings,
}) {
  const productionSettings = settings.production ?? DEFAULT_FACTORY_SETTINGS.production
  const leanSettings = settings.lean ?? DEFAULT_FACTORY_SETTINGS.lean
  const fiveSSettings = leanSettings.fiveS ?? DEFAULT_FACTORY_SETTINGS.lean.fiveS
  const smedSettings = leanSettings.smed ?? DEFAULT_FACTORY_SETTINGS.lean.smed
  const qualitySettings = leanSettings.quality ?? DEFAULT_FACTORY_SETTINGS.lean.quality
  const performanceSettings = leanSettings.performance ?? DEFAULT_FACTORY_SETTINGS.lean.performance
  const machiningNormHoursPerContainer = toNumber(
    productionSettings.departments?.machining?.normHoursPerContainer,
    MACHINING_NORM_HOURS_PER_CONTAINER,
  )
  const assemblyNormHoursPerContainer = toNumber(
    productionSettings.departments?.assembly?.normHoursPerContainer,
    ASSEMBLY_NORM_HOURS_PER_CONTAINER,
  )
  const shippingNormHoursPerContainer = toNumber(
    productionSettings.departments?.shipping?.normHoursPerContainer,
    SHIPPING_NORM_HOURS_PER_CONTAINER,
  )
  const hoursPerMachinePerRound = toNumber(
    productionSettings.hoursPerMachinePerRound,
    HOURS_PER_MACHINE_PER_ROUND,
  )
  const hoursPerWorkerPerRound = toNumber(
    productionSettings.hoursPerWorkerPerRound,
    HOURS_PER_WORKER_PER_ROUND,
  )
  const fiveSContributionDivisor = Math.max(1, toNumber(fiveSSettings.contributionDivisor, 3))
  const qualityMaxPct = normalizePercentValue(qualitySettings.maxPct, MAX_COMPONENT_PCT)
  const performanceMaxPct = normalizePercentValue(performanceSettings.maxPerformance, MAX_COMPONENT_PCT)
  const defaultLearningBasePct = toNumber(performanceSettings.defaultBasePct, 70)
  const machiningBasePct = normalizePercentValue(performanceSettings.machiningBasePct, 90)
  const learningCurveHours = toNumber(qualitySettings.curveHours, 1200)

  const fiveSContribution = fiveSEffectiveHours / fiveSContributionDivisor
  const smedHours = toNumber(methodHours.smed) + fiveSContribution
  const tpmHours = toNumber(methodHours.tpm) + fiveSContribution
  const methodDevHours = toNumber(methodHours['method-development']) + fiveSContribution
  const qualityHours = toNumber(methodHours.spc) + toNumber(methodHours['poka-yoke']) + fiveSContribution

  if (key === 'machining') {
    const averageAutomationReductionMinutes = setupAutomationInstalled
      ? toNumber(smedSettings.automationReductionMinutesPerMachine, 10)
      : 0
    // Setup time comes from the existing SMED curve; changeover count comes from the batch-size decision.
    const setupTimeHours = calculateSmedChangeoverHours(smedHours, averageAutomationReductionMinutes, smedSettings)
    const changeoverHoursPerMachine = changeoversPerMachine * setupTimeHours
    const otherDowntimeRate = toNumber(productionSettings.departments?.machining?.otherDowntimeRate, 0.24)
    const otherDowntimeHoursPerMachine = hoursPerMachinePerRound * otherDowntimeRate
    const rawAvailability = hoursPerMachinePerRound > 0
      ? (hoursPerMachinePerRound - otherDowntimeHoursPerMachine - changeoverHoursPerMachine) / hoursPerMachinePerRound
      : 0

    const availabilityPct = clamp(
      clamp(rawAvailability, 0, 1) * 100 + (conditionMonitoring ? 2 : 0),
      0,
      100,
    )
    const speedPct = calculateLearningComponent(machiningBasePct, methodDevHours, performanceMaxPct, learningCurveHours)
    const qualityPct = clamp(
      calculateLearningComponent(defaultLearningBasePct, qualityHours, qualityMaxPct, learningCurveHours) + (automaticProcessMeasurement ? 2 : 0),
      MIN_COMPONENT_PCT,
      MAX_COMPONENT_PCT,
    )

    const knl = calculateKNL(availabilityPct, speedPct, qualityPct)
    const theoreticalCapacityHours = machineCount * hoursPerMachinePerRound
    const effectiveCapacityHours = theoreticalCapacityHours * knl
    const capacityContainers = Math.floor(effectiveCapacityHours / machiningNormHoursPerContainer)

    return {
      kPct: availabilityPct,
      nPct: speedPct,
      lPct: qualityPct,
      knl,
      capacityContainers,
      // changeoverHours keeps its original meaning: per-event setup duration (SMED output), not the per-machine total.
      changeoverHours: setupTimeHours,
      batchSize,
      totalChangeovers,
      changeoversPerMachine,
      setupTimeHours,
      changeoverHoursPerMachine,
      otherDowntimeHoursPerMachine,
    }
  }

  if (key === 'assembly') {
    const availabilityPct = clamp(
      calculateLearningComponent(defaultLearningBasePct, smedHours + tpmHours, performanceMaxPct, learningCurveHours) + (conditionMonitoring ? 2 : 0),
      MIN_COMPONENT_PCT,
      MAX_COMPONENT_PCT,
    )
    const speedPct = calculateLearningComponent(defaultLearningBasePct, methodDevHours, performanceMaxPct, learningCurveHours)
    const qualityPct = clamp(
      calculateLearningComponent(defaultLearningBasePct, qualityHours, qualityMaxPct, learningCurveHours) + (automaticProcessMeasurement ? 2 : 0),
      MIN_COMPONENT_PCT,
      MAX_COMPONENT_PCT,
    )
    const knl = calculateKNL(availabilityPct, speedPct, qualityPct)
    const effectiveHours = staffing.assembly * hoursPerWorkerPerRound * knl
    const capacityContainers = Math.floor(effectiveHours / assemblyNormHoursPerContainer)

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
    calculateLearningComponent(defaultLearningBasePct, smedHours + tpmHours, performanceMaxPct, learningCurveHours) + (conditionMonitoring ? 2 : 0),
    MIN_COMPONENT_PCT,
    MAX_COMPONENT_PCT,
  )
  const speedPct = calculateLearningComponent(defaultLearningBasePct, methodDevHours, performanceMaxPct, learningCurveHours)
  const qualityPct = clamp(
    calculateLearningComponent(defaultLearningBasePct, qualityHours, qualityMaxPct, learningCurveHours) + (automaticProcessMeasurement ? 2 : 0),
    MIN_COMPONENT_PCT,
    MAX_COMPONENT_PCT,
  )
  const knl = calculateKNL(availabilityPct, speedPct, qualityPct)
  const effectiveHours = staffing.shipping * hoursPerWorkerPerRound * knl
  const capacityContainers = Math.floor(effectiveHours / shippingNormHoursPerContainer)

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
  factorySettings,
}) {
  const settings = factorySettings ?? DEFAULT_FACTORY_SETTINGS
  const leanSettings = settings.lean ?? DEFAULT_FACTORY_SETTINGS.lean
  const fiveSSettings = leanSettings.fiveS ?? DEFAULT_FACTORY_SETTINGS.lean.fiveS
  const smedSettings = leanSettings.smed ?? DEFAULT_FACTORY_SETTINGS.lean.smed
  const tpmSettings = leanSettings.tpm ?? DEFAULT_FACTORY_SETTINGS.lean.tpm
  const qualitySettings = leanSettings.quality ?? DEFAULT_FACTORY_SETTINGS.lean.quality
  const performanceSettings = leanSettings.performance ?? DEFAULT_FACTORY_SETTINGS.lean.performance
  const inventorySettings = settings.inventory ?? DEFAULT_FACTORY_SETTINGS.inventory
  const factorySettingsSection = settings.factory ?? DEFAULT_FACTORY_SETTINGS.factory
  const productionSettings = settings.production ?? DEFAULT_FACTORY_SETTINGS.production
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
    toNonNegativeInt(investmentsSnapshot.factory.totalAreaM2) +
    investments.expansions * toNumber(factorySettingsSection.factoryExpansionM2, 1000)

  const staffing = resolveStaffing(
    investmentsSnapshot,
    staffingDecision,
    machineCount,
    productionSettings.workersPerMachine,
  )
  const fiveSContributionDivisor = Math.max(1, toNumber(fiveSSettings.contributionDivisor, 3))
  const qualityMaxPct = normalizePercentValue(qualitySettings.maxPct, MAX_COMPONENT_PCT)
  const performanceMaxPct = normalizePercentValue(performanceSettings.maxPerformance, MAX_COMPONENT_PCT)
  const defaultLearningBasePct = toNumber(performanceSettings.defaultBasePct, 70)
  const machiningBasePct = normalizePercentValue(performanceSettings.machiningBasePct, 90)
  const learningCurveHours = toNumber(qualitySettings.curveHours, 1200)

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
      settings,
    ).nextEffectiveHours
    fiveSHoursByDepartment.assembly = calculateNextFiveSState(
      fiveSHoursByDepartment.assembly,
      invested.assembly,
      settings,
    ).nextEffectiveHours
    fiveSHoursByDepartment.shipping = calculateNextFiveSState(
      fiveSHoursByDepartment.shipping,
      invested.shipping,
      settings,
    ).nextEffectiveHours
  }

  const projectedQualityAverage =
    (calculateLearningComponent(defaultLearningBasePct, (projects.mergedLevels.machining?.spc || 0) + fiveSHoursByDepartment.machining / fiveSContributionDivisor, qualityMaxPct, learningCurveHours) +
      calculateLearningComponent(defaultLearningBasePct, (projects.mergedLevels.assembly?.['poka-yoke'] || 0) + fiveSHoursByDepartment.assembly / fiveSContributionDivisor, qualityMaxPct, learningCurveHours) +
      calculateLearningComponent(defaultLearningBasePct, (projects.mergedLevels.shipping?.['poka-yoke'] || 0) + fiveSHoursByDepartment.shipping / fiveSContributionDivisor, qualityMaxPct, learningCurveHours)) /
    3

  const allowedNewVariations = calculateAllowedNewVariations(projectedQualityAverage, settings)
  const requestedNewVariations =
    market.addedVariations != null ? market.addedVariations : market.newVariations
  const selectedNewVariations = clamp(toNonNegativeInt(requestedNewVariations), 0, allowedNewVariations)
  const activeVariationCount = Math.max(1, toNonNegativeInt(market.activeVariationCount, 1))
  const totalVariations = activeVariationCount + selectedNewVariations
  const runsPerVariation = Math.max(
    1,
    toNonNegativeInt(market.runsPerVariation, inventorySettings.productionRunsPerVariationDefault ?? 2),
  )
  const productionRuns = totalVariations * runsPerVariation
  const switches = productionRuns

  // Demand is independent of capacity, so it can be resolved before department metrics
  // and used as the "planned production" reference when no explicit ACT decision exists.
  const demandPerVariation = calculateDemandPerVariation(market.price, settings)
  const demand = Math.max(0, Math.round(demandPerVariation * totalVariations))
  const hasPlannedProduction = market.productionQuantity != null
  const requestedProductionQuantity = hasPlannedProduction
    ? Math.max(0, toNonNegativeInt(market.productionQuantity))
    : demand

  const initialBatchSize = toNumber(productionSettings.initialBatchSize, 20)
  const minBatchSize = toNumber(productionSettings.minBatchSize, 1)
  const maxBatchSize = toNumber(productionSettings.maxBatchSize, 20)
  const requestedBatchSize = market.batchSize != null
    ? toNumber(market.batchSize, initialBatchSize)
    : initialBatchSize
  const machiningBatchSize = clamp(Math.round(requestedBatchSize), minBatchSize, maxBatchSize)
  const totalChangeovers = requestedProductionQuantity / machiningBatchSize
  const changeoversPerMachine = machineCount > 0 ? totalChangeovers / machineCount : 0

  const machiningMetrics = calculateDepartmentMetrics({
    key: 'machining',
    machineCount,
    staffing,
    fiveSEffectiveHours: fiveSHoursByDepartment.machining,
    methodHours: projects.mergedLevels.machining || {},
    changeoversPerMachine,
    totalChangeovers,
    batchSize: machiningBatchSize,
    setupAutomationInstalled: investments.setupAutomationInstalled,
    conditionMonitoring: investments.conditionMonitoring,
    automaticProcessMeasurement: investments.automaticProcessMeasurement,
    settings,
  })

  const assemblyMetrics = calculateDepartmentMetrics({
    key: 'assembly',
    machineCount,
    staffing,
    fiveSEffectiveHours: fiveSHoursByDepartment.assembly,
    methodHours: projects.mergedLevels.assembly || {},
    setupAutomationInstalled: investments.setupAutomationInstalled,
    conditionMonitoring: investments.conditionMonitoring,
    automaticProcessMeasurement: investments.automaticProcessMeasurement,
    settings,
  })

  const shippingMetrics = calculateDepartmentMetrics({
    key: 'shipping',
    machineCount,
    staffing,
    fiveSEffectiveHours: fiveSHoursByDepartment.shipping,
    methodHours: projects.mergedLevels.shipping || {},
    setupAutomationInstalled: investments.setupAutomationInstalled,
    conditionMonitoring: investments.conditionMonitoring,
    automaticProcessMeasurement: investments.automaticProcessMeasurement,
    settings,
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

  // requested/planned production is the player's plan (from CHECK/ACT or the demand fallback);
  // it is intentionally NOT capped by demand, only by capacity.
  const plannedProductionQuantity = clamp(requestedProductionQuantity, 0, plantCapacity)
  const actualProduction = plannedProductionQuantity
  const unusedCapacity = Math.max(0, plantCapacity - actualProduction)

  // The batch-size-driven quantity is a minimum operational/Lean buffer, not the physical stock level.
  const minimumFinishedGoodsInventory = machineCount > 0
    ? (totalVariations * machiningBatchSize) / (2 * machineCount)
    : 0
  const baseFinishedGoodsContainers = toNumber(investmentsSnapshot.factory.finishedGoodsContainers)
  const openingFinishedGoodsInventory = baseFinishedGoodsContainers
  const requestedFinishedGoodsInventory = market.targetFinishedGoodsInventory != null
    ? toNonNegativeInt(market.targetFinishedGoodsInventory)
    : minimumFinishedGoodsInventory
  const targetFinishedGoodsInventory = Math.max(
    minimumFinishedGoodsInventory,
    requestedFinishedGoodsInventory,
  )
  const requiredProduction = Math.max(
    0,
    demand + targetFinishedGoodsInventory - openingFinishedGoodsInventory,
  )
  const availableFinishedGoodsInventory = Math.max(
    0,
    openingFinishedGoodsInventory + actualProduction - targetFinishedGoodsInventory,
  )

  const deliveries = Math.max(0, Math.min(demand, availableFinishedGoodsInventory))
  const lostSalesUnits = Math.max(0, demand - deliveries)

  // Physical material balance: whatever was produced but not delivered stays in stock.
  const closingFinishedGoodsInventory = openingFinishedGoodsInventory + actualProduction - deliveries

  const finishedGoodsValue =
    closingFinishedGoodsInventory *
    toNumber(inventorySettings.finishedGoodsValuePerContainer, FINISHED_GOODS_VALUE_PER_CONTAINER)
  const finishedGoodsArea =
    minimumFinishedGoodsInventory *
    toNumber(inventorySettings.finishedGoodsSpacePerContainerM2, FINISHED_GOODS_AREA_PER_CONTAINER)

  const machineArea = machineCount * toNumber(factorySettingsSection.machineSpaceM2, 250)
  const assemblyArea = staffing.assembly * toNumber(factorySettingsSection.workerSpaceM2, 25)
  const dispatchArea = toNonNegativeInt(investmentsSnapshot.factory.dispatchM2)
  const officeArea = toNonNegativeInt(investmentsSnapshot.factory.officeAndSocialM2)
  const usedArea = machineArea + assemblyArea + dispatchArea + officeArea + finishedGoodsArea
  const freeFactorySpace = totalArea - usedArea

  const revenue = deliveries * toNumber(market.price, PRICE_REFERENCE)
  const materials = actualProduction * toNumber(
    settings.costs.materialCostPerContainer,
    MATERIAL_COST_PER_SOLD_CONTAINER,
  )
  const totalPersonnel = staffing.machining + staffing.assembly + staffing.shipping
  const roundFraction = toNumber(settings.game.monthsPerRound, 3) / 12
  const labor = totalPersonnel * toNumber(settings.costs.annualEmployeeCost, 50000) * roundFraction
  const fixedCosts = toNumber(settings.costs.annualFixedCosts, 3000000) * roundFraction

  const inventoryChange =
    (closingFinishedGoodsInventory - openingFinishedGoodsInventory) *
    toNumber(inventorySettings.finishedGoodsValuePerContainer, FINISHED_GOODS_VALUE_PER_CONTAINER)

  const machineryBase = toNumber(balanceSheetSnapshot.assets.machinery)
  const buildingsBase = toNumber(balanceSheetSnapshot.assets.buildings)
  const machineryInvestments =
    investments.newMachines * toNumber(investmentsSnapshot.investments.newMachine.unitCost) +
    (investments.setupAutomationPurchased
      ? toNumber(investmentsSnapshot.investments.moldChangeAutomation.unitCost)
      : 0) +
    (investments.automaticProcessMeasurement
      ? toNumber(investmentsSnapshot.investments.automaticProcessMeasurement.unitCost)
      : 0) +
    (investments.conditionMonitoring
      ? toNumber(investmentsSnapshot.investments.conditionMonitoring.unitCost)
      : 0)
  const buildingInvestments =
    investments.expansions * toNumber(investmentsSnapshot.investments.factoryExpansion.unitCost)

  const machineryDepreciation =
    (machineryBase + machineryInvestments) *
    toNumber(settings.finance.machineryDepreciationPerRound, MACHINERY_DEPRECIATION_PER_ROUND)
  const buildingDepreciation =
    (buildingsBase + buildingInvestments) *
    toNumber(settings.finance.buildingDepreciationPerRound, BUILDING_DEPRECIATION_PER_ROUND)
  const depreciation = machineryDepreciation + buildingDepreciation

  const financing = canFinanceInvestment(
    investments.totalCost,
    {
    cashBalance: toNumber(balanceSheetSnapshot.assets.cash),
    bankLoanDebt: toNumber(balanceSheetSnapshot.liabilities.bankLoans),
    equity:
      toNumber(balanceSheetSnapshot.assets.machinery) +
      toNumber(balanceSheetSnapshot.assets.buildings) +
      toNumber(balanceSheetSnapshot.assets.cash) +
      toNumber(balanceSheetSnapshot.assets.inventory) -
      toNumber(balanceSheetSnapshot.liabilities.bankLoans),
    },
    toNumber(settings.finance.maxDebtToEquity, 2),
  )

  const openingInterestBearingDebt = toNumber(
    balanceSheetSnapshot.liabilities?.bankLoans,
    toNumber(balanceSheetSnapshot.liabilities?.interestBearingDebt),
  )
  const roundInterestRate = toNumber(settings.finance.annualInterestRate, 0.05) * roundFraction
  const interest = openingInterestBearingDebt * roundInterestRate

  const result = revenue - materials - labor - fixedCosts + inventoryChange - depreciation - interest

  return {
    market: {
      price: toNumber(market.price, PRICE_REFERENCE),
      demandPerVariation,
      selectedNewVariations,
      allowedNewVariations,
      addedVariations: selectedNewVariations,
      activeVariationCount,
      totalVariations,
      runsPerVariation,
      productionQuantity: plannedProductionQuantity,
      batchSize: machiningBatchSize,
      targetFinishedGoodsInventory,
    },
    knl: {
      machining: machiningMetrics,
      assembly: assemblyMetrics,
      shipping: shippingMetrics,
      totalQualityAverage: projectedQualityAverage,
    },
    factoryKnl: calculateFactoryKnl({
      machining: machiningMetrics,
      assembly: assemblyMetrics,
      shipping: shippingMetrics,
    }),
    staffing,
    capacityByDepartment,
    bottleneckKey,
    plantCapacity,
    demand,
    requestedProductionQuantity,
    plannedProductionQuantity,
    actualProduction,
    deliveries,
    lostSalesUnits,
    unusedCapacity,
    productionRuns,
    switches,
    inventory: {
      minimumFinishedGoodsInventory,
      averageFinishedGoodsInventory: minimumFinishedGoodsInventory,
      openingFinishedGoodsInventory,
      requestedFinishedGoodsInventory,
      targetFinishedGoodsInventory,
      requiredProduction,
      availableFinishedGoodsInventory,
      closingFinishedGoodsInventory,
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
      openingInterestBearingDebt,
      roundInterestRate,
      interest,
      result,
      machineryDepreciation,
      buildingDepreciation,
    },
    investments,
    closingStateInputs: {
      fiveSHoursByDepartment,
      mergedLevels: projects.mergedLevels,
      machineCount,
      totalArea,
      expansions: investments.expansions,
      setupAutomationInstalled: investments.setupAutomationInstalled,
      automaticProcessMeasurement: investments.automaticProcessMeasurement,
      conditionMonitoring: investments.conditionMonitoring,
      machineryBase,
      buildingsBase,
      machineryInvestments,
      buildingInvestments,
      machineryDepreciation,
      buildingDepreciation,
    },
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

function buildClosingFinance(gameState, forecastScenario, normalizedInputs, factorySettings) {
  const finance = gameState.finance ?? {}
  const openingMachineryBookValue = toNumber(
    finance.machineryBookValue,
    normalizedInputs.balanceSheetSnapshot.assets.machinery,
  )
  const openingBuildingsBookValue = toNumber(
    finance.buildingsBookValue,
    normalizedInputs.balanceSheetSnapshot.assets.buildings,
  )
  const openingEquity = toNumber(
    finance.equity,
    normalizedInputs.balanceSheetSnapshot.liabilities.equity,
  )
  const closingFinishedGoodsInventoryBookValue = forecastScenario.inventory.finishedGoodsValue
  const closingRawMaterialInventoryBookValue = Math.round(
    Math.abs(forecastScenario.finance.materials) * RAW_MATERIAL_INVENTORY_SHARE,
  )
  const closingInventoryBookValue =
    closingFinishedGoodsInventoryBookValue + closingRawMaterialInventoryBookValue
  const closingMachineryBookValue =
    openingMachineryBookValue +
    forecastScenario.closingStateInputs.machineryInvestments -
    forecastScenario.closingStateInputs.machineryDepreciation
  const closingBuildingsBookValue =
    openingBuildingsBookValue +
    forecastScenario.closingStateInputs.buildingInvestments -
    forecastScenario.closingStateInputs.buildingDepreciation
  const closingEquity = openingEquity + forecastScenario.finance.result
  const fixedAssets = closingMachineryBookValue + closingBuildingsBookValue
  const nonCashAssets = fixedAssets + closingInventoryBookValue
  const financingStructure = calculateFinancingStructure({
    nonCashAssets,
    equity: closingEquity,
    rawMaterialCosts: forecastScenario.finance.materials,
    factorySettings,
  })
  const incomeStatement = {
    revenue: forecastScenario.finance.revenue,
    materials: forecastScenario.finance.materials,
    labor: forecastScenario.finance.labor,
    fixedCosts: forecastScenario.finance.fixedCosts,
    inventoryChange: forecastScenario.finance.inventoryChange,
    depreciation: forecastScenario.finance.depreciation,
    interest: forecastScenario.finance.interest,
    result: forecastScenario.finance.result,
  }

  return {
    cash: financingStructure.cash,
    bankLoans: financingStructure.interestBearingDebt,
    overdraft: 0,
    equity: closingEquity,
    otherLiabilities: financingStructure.otherLiabilities,
    machineryBookValue: closingMachineryBookValue,
    buildingsBookValue: closingBuildingsBookValue,
    finishedGoodsInventoryBookValue: closingFinishedGoodsInventoryBookValue,
    rawMaterialInventoryBookValue: closingRawMaterialInventoryBookValue,
    inventoryBookValue: closingInventoryBookValue,
    fixedAssets,
    totalAssets: financingStructure.totalAssets,
    totalLiabilitiesAndEquity: financingStructure.totalEquityAndLiabilities,
    incomeStatement,
  }
}

function buildClosingState(gameState, forecastScenario, normalizedInputs, factorySettings) {
  const closingInputs = forecastScenario.closingStateInputs
  const getFiveSDepartment = (departmentKey) =>
    normalizedInputs.fiveSSnapshot.departments.find((department) => department.key === departmentKey)

  return {
    market: {
      price: forecastScenario.market.price,
      activeVariations: forecastScenario.market.totalVariations,
      productionRunsPerVariation: forecastScenario.market.runsPerVariation,
      batchSize: forecastScenario.market.batchSize,
    },
    staffing: {
      machining: forecastScenario.staffing.machining,
      assembly: forecastScenario.staffing.assembly,
      shipping: forecastScenario.staffing.shipping,
    },
    lean: {
      fiveS: {
        focusBudgetHours: normalizedInputs.fiveSSnapshot.focusBudgetHours,
        departments: {
          machining: {
            effectiveHours: closingInputs.fiveSHoursByDepartment.machining,
            weight: getFiveSDepartment('machining')?.weight ?? 0,
          },
          assembly: {
            effectiveHours: closingInputs.fiveSHoursByDepartment.assembly,
            weight: getFiveSDepartment('assembly')?.weight ?? 0,
          },
          shipping: {
            effectiveHours: closingInputs.fiveSHoursByDepartment.shipping,
            weight: getFiveSDepartment('shipping')?.weight ?? 0,
          },
        },
      },
      methods: closingInputs.mergedLevels,
    },
    production: {
      machiningMachines: closingInputs.machineCount,
    },
    factory: {
      totalAreaM2: closingInputs.totalArea,
      dispatchM2: gameState.factory?.dispatchM2 ?? 0,
      officeAndSocialM2: gameState.factory?.officeAndSocialM2 ?? 0,
      expansionsCount:
        Number(gameState.factory?.expansionsCount ?? 0) + closingInputs.expansions,
    },
    investments: {
      setupAutomation: {
        installed: closingInputs.setupAutomationInstalled,
      },
      automaticProcessMeasurement: {
        installed: closingInputs.automaticProcessMeasurement,
      },
      conditionMonitoring: {
        installed: closingInputs.conditionMonitoring,
      },
    },
    inventory: {
      // Physical closing stock (opening + actualProduction - deliveries), not the Lean minimum metric.
      finishedGoodsContainers: forecastScenario.inventory.closingFinishedGoodsInventory,
      finishedGoodsBookValue: forecastScenario.inventory.finishedGoodsValue,
    },
    finance: buildClosingFinance(
      gameState,
      forecastScenario,
      normalizedInputs,
      factorySettings,
    ),
  }
}

export function calculateRoundForecast(gameState, decisions = {}, factorySettings = DEFAULT_FACTORY_SETTINGS) {
  const settings = factorySettings ?? DEFAULT_FACTORY_SETTINGS
  const normalizedInputs = resolveForecastSnapshotInputs(gameState, settings)
  const baseActiveVariationCount = toNonNegativeInt(
    gameState.market?.activeVariations,
    toNonNegativeInt(normalizedInputs.productionSnapshot?.market?.activeVariations, 1),
  )
  const baseRunsPerVariation = toNonNegativeInt(
    gameState.market?.productionRunsPerVariation,
    toNonNegativeInt(gameState.production?.productionRunsPerVariation, 2),
  )
  const basePrice = toNumber(
    gameState.market?.price,
    toNumber(settings.market.referencePrice, PRICE_REFERENCE),
  )
  // Canonical batchSize carries over from the previous round's closing state, same as price;
  // null here means "no carried-over decision yet" so calculateScenario falls back to initialBatchSize.
  const baseBatchSize = gameState.market?.batchSize != null
    ? toNumber(gameState.market.batchSize, null)
    : null
  // CHECK's next-round production decision is written directly onto gameState.market by
  // advanceRoundState (see checkProductionDecision); null means no decision yet, so
  // calculateScenario falls back to demand.
  const baseProductionQuantity = gameState.market?.productionQuantity != null
    ? toNumber(gameState.market.productionQuantity, null)
    : null

  const initialMarketFromState = {
    price: basePrice,
    runsPerVariation: Math.max(
      1,
      toNonNegativeInt(
        baseRunsPerVariation,
        toNumber(settings.inventory?.productionRunsPerVariationDefault, 2),
      ),
    ),
    activeVariationCount: Math.max(1, baseActiveVariationCount),
    batchSize: baseBatchSize,
    productionQuantity: baseProductionQuantity,
      targetFinishedGoodsInventory: gameState.market?.targetFinishedGoodsInventory != null
        ? toNumber(gameState.market.targetFinishedGoodsInventory, null)
        : null,
  }

  const resolvedDecisions = {
    fiveSDecision: gameState.fiveSDecision || null,
    projectsDecision: gameState.projectsDecision || null,
    investmentsDecision: gameState.investmentsDecision || null,
    market: {
      ...DEFAULT_MARKET_DECISION,
      ...initialMarketFromState,
      ...(gameState.marketDecision || {}),
      ...(decisions.market || {}),
    },
  }

  if (resolvedDecisions.market.newVariations == null && resolvedDecisions.market.addedVariations != null) {
    resolvedDecisions.market.newVariations = resolvedDecisions.market.addedVariations
  }

  if (
    resolvedDecisions.market.addedVariations == null &&
    resolvedDecisions.market.newVariations != null
  ) {
    resolvedDecisions.market.addedVariations = resolvedDecisions.market.newVariations
  }

  const currentScenario = calculateScenario({
    investmentsSnapshot: normalizedInputs.investmentsSnapshot,
    projectsSnapshot: normalizedInputs.projectsSnapshot,
    fiveSSnapshot: normalizedInputs.fiveSSnapshot,
    balanceSheetSnapshot: normalizedInputs.balanceSheetSnapshot,
    decisions: resolvedDecisions,
    staffingDecision: null,
    applyDoDecisions: false,
    factorySettings: settings,
  })

  const forecastScenario = calculateScenario({
    investmentsSnapshot: normalizedInputs.investmentsSnapshot,
    projectsSnapshot: normalizedInputs.projectsSnapshot,
    fiveSSnapshot: normalizedInputs.fiveSSnapshot,
    balanceSheetSnapshot: normalizedInputs.balanceSheetSnapshot,
    decisions: resolvedDecisions,
    staffingDecision: decisions.staffing || gameState.checkStaffingDecision?.staffing || null,
    applyDoDecisions: true,
    factorySettings: settings,
  })

  const departmentLabels = {
    machining: 'Koneistus',
    assembly: 'Koonta',
    shipping: 'Lähettämö',
  }

  const currentFromSnapshot = buildCurrentStateFromProductionSnapshot(normalizedInputs.productionSnapshot)
  const currentState = currentFromSnapshot || currentScenario
  const { closingStateInputs, ...forecastOutput } = forecastScenario
  const closingState = buildClosingState(
    gameState,
    { ...forecastOutput, closingStateInputs },
    normalizedInputs,
    settings,
  )
  closingState.canonical = buildCanonicalCarryoverState({
    round: gameState.round,
    closingState,
  })

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
        productionQuantity: forecastScenario.market.productionQuantity,
        batchSize: forecastScenario.market.batchSize,
        targetFinishedGoodsInventory: forecastScenario.market.targetFinishedGoodsInventory,
        activeVariationCount: forecastScenario.market.activeVariationCount,
        totalVariations: forecastScenario.market.totalVariations,
        addedVariations: forecastScenario.market.addedVariations,
        selectedNewVariations: forecastScenario.market.selectedNewVariations,
        allowedNewVariations: forecastScenario.market.allowedNewVariations,
      },
    },
    current: currentState,
    forecast: forecastOutput,
    closingState,
    summary: {
      bottleneckKey: forecastScenario.bottleneckKey,
      bottleneckLabel: departmentLabels[forecastScenario.bottleneckKey],
      demand: forecastScenario.demand,
      requestedProductionQuantity: forecastScenario.requestedProductionQuantity,
      productionQuantity: forecastScenario.plannedProductionQuantity,
      actualProduction: forecastScenario.actualProduction,
      unusedCapacity: forecastScenario.unusedCapacity,
      deliveries: forecastScenario.deliveries,
      lostSalesUnits: forecastScenario.lostSalesUnits,
      plantCapacity: forecastScenario.plantCapacity,
      revenue: forecastScenario.finance.revenue,
      result: forecastScenario.finance.result,
      finishedGoodsInventory: forecastScenario.inventory.closingFinishedGoodsInventory,
      openingFinishedGoodsInventory: forecastScenario.inventory.openingFinishedGoodsInventory,
      minimumFinishedGoodsInventory: forecastScenario.inventory.minimumFinishedGoodsInventory,
      targetFinishedGoodsInventory: forecastScenario.inventory.targetFinishedGoodsInventory,
      requiredProduction: forecastScenario.inventory.requiredProduction,
      availableFinishedGoodsInventory: forecastScenario.inventory.availableFinishedGoodsInventory,
      freeFactorySpace: forecastScenario.space.freeFactorySpace,
    },
    insights: buildInsights(currentScenario, forecastScenario),
  }
}
