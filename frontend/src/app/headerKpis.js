import { DEFAULT_FACTORY_SETTINGS } from '../entities/factory-settings/defaultFactorySettings.js'
import { buildInitialIncomeHistory } from '../entities/factory-settings/financialHistory.js'
import { calculateKNL, calculateDemandPerVariation } from '../entities/forecast/model.js'

const headerKpiMap = {
  oee: 'KNL',
  production: 'Tuotantomäärä',
  revenue: 'Liikevaihto',
  result: 'Tulos',
  inventoryTurnover: 'Varaston kiertonopeus',
}

function formatSignedPercent(delta) {
  const value = Number(delta) || 0
  const sign = value > 0 ? '+' : ''

  return `${sign}${value.toLocaleString('fi-FI', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} %`
}

function formatCurrency(value) {
  return `${Math.round(Number(value) || 0).toLocaleString('fi-FI')} €`
}

function formatContainers(value) {
  return `${Math.round(Number(value) || 0).toLocaleString('fi-FI')} kpl`
}

function formatKnl(value) {
  return `${Math.round((Number(value) || 0) * 100).toLocaleString('fi-FI')} %`
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function normalizePercentValue(value, fallback = 95) {
  const numeric = toNumber(value, fallback)

  if (numeric <= 1) {
    return numeric * 100
  }

  return numeric
}

function calculateLearningComponent(basePct, effectiveHours, maxPct = 95, curveHours = 1200) {
  const safeBase = toNumber(basePct)
  const safeMax = Math.max(safeBase, normalizePercentValue(maxPct, 95))
  const safeHours = Math.max(0, toNumber(effectiveHours))
  const safeCurveHours = Math.max(1, toNumber(curveHours, 1200))

  const curveRatio = 1 - Math.exp(-safeHours / safeCurveHours)
  return clamp(safeBase + (safeMax - safeBase) * curveRatio, 0, 95)
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

function calculateTpmDowntimeLoss(tpmHours, tpmSettings = null) {
  const settings = tpmSettings ?? DEFAULT_FACTORY_SETTINGS.lean.tpm
  const safeHours = Math.max(0, toNumber(tpmHours))
  const initialDowntimeRate = toNumber(settings.initialDowntimeRate, 0.1)
  const minimumDowntimeRate = toNumber(settings.minimumDowntimeRate, 0.01)
  const decayHours = Math.max(1, toNumber(settings.decayHours, 450))
  return minimumDowntimeRate + (initialDowntimeRate - minimumDowntimeRate) * Math.exp(-safeHours / decayHours)
}

function calculateMachiningKnl(gameState, factorySettings) {
  const settings = factorySettings ?? DEFAULT_FACTORY_SETTINGS
  const productionSettings = settings.production ?? DEFAULT_FACTORY_SETTINGS.production
  const leanSettings = settings.lean ?? DEFAULT_FACTORY_SETTINGS.lean
  const smedSettings = leanSettings.smed ?? DEFAULT_FACTORY_SETTINGS.lean.smed
  const tpmSettings = leanSettings.tpm ?? DEFAULT_FACTORY_SETTINGS.lean.tpm
  const qualitySettings = leanSettings.quality ?? DEFAULT_FACTORY_SETTINGS.lean.quality
  const performanceSettings = leanSettings.performance ?? DEFAULT_FACTORY_SETTINGS.lean.performance

  const machineCount = Math.max(0, toNumber(gameState.production?.machiningMachines, 0))
  const hoursPerMachinePerRound = toNumber(
    productionSettings.hoursPerMachinePerRound,
    DEFAULT_FACTORY_SETTINGS.production.hoursPerMachinePerRound,
  )
  const machiningNormHoursPerContainer = toNumber(
    productionSettings.departments?.machining?.normHoursPerContainer,
    DEFAULT_FACTORY_SETTINGS.production.departments.machining.normHoursPerContainer,
  )
  const fiveSContributionDivisor = Math.max(1, toNumber(leanSettings.fiveS?.contributionDivisor, 3))
  const fiveSEffectiveHours = toNumber(gameState.lean?.fiveS?.departments?.machining?.effectiveHours, 0)
  const methodHours = gameState.lean?.methods?.machining || {}
  const automationMachineIds = Array.isArray(gameState.investments?.setupAutomation?.installedMachineIds)
    ? gameState.investments.setupAutomation.installedMachineIds
    : []
  const automationMachineCount = automationMachineIds.length
  const automationShare = machineCount > 0 ? automationMachineCount / machineCount : 0
  const fiveSContribution = fiveSEffectiveHours / fiveSContributionDivisor
  const smedHours = toNumber(methodHours.smed) + fiveSContribution
  const tpmHours = toNumber(methodHours.tpm) + fiveSContribution
  const methodDevHours = toNumber(methodHours['method-development']) + fiveSContribution
  const qualityHours = toNumber(methodHours.spc) + toNumber(methodHours['poka-yoke']) + fiveSContribution
  const averageAutomationReductionMinutes =
    toNumber(smedSettings.automationReductionMinutesPerMachine, 10) * clamp(automationShare, 0, 1)
  const changeoverHours = calculateSmedChangeoverHours(smedHours, averageAutomationReductionMinutes, smedSettings)
  const downtimeLoss = calculateTpmDowntimeLoss(tpmHours, tpmSettings)
  const switchLoss = machineCount > 0 ? (0 * changeoverHours) / (machineCount * hoursPerMachinePerRound) : 0
  const availabilityPct = clamp((1 - downtimeLoss - Math.max(0, switchLoss)) * 100, 50, 95)
  const speedPct = calculateLearningComponent(
    normalizePercentValue(performanceSettings.machiningBasePct, 90),
    methodDevHours,
    normalizePercentValue(performanceSettings.maxPerformance, 95),
    qualitySettings.curveHours,
  )
  const qualityPct = clamp(
    calculateLearningComponent(
      normalizePercentValue(performanceSettings.defaultBasePct, 70),
      qualityHours,
      normalizePercentValue(qualitySettings.maxPct, 95),
      qualitySettings.curveHours,
    ),
    0,
    95,
  )

  return calculateKNL(availabilityPct, speedPct, qualityPct)
}

export function buildGameHeaderKpis(gameState, factorySettings = DEFAULT_FACTORY_SETTINGS) {
  const settings = factorySettings ?? DEFAULT_FACTORY_SETTINGS
  const incomeHistory = buildInitialIncomeHistory(gameState, settings)
  const currentIncome = incomeHistory.rows
  const resultAmount =
    currentIncome.revenue.amount +
    currentIncome.inventoryChange.amount -
    currentIncome.materials.amount -
    currentIncome.labor.amount -
    currentIncome.fixedCosts.amount -
    currentIncome.depreciation.amount -
    currentIncome.financingCosts.amount

  const salesAmount = currentIncome.sales.amount
  const inventoryContainers = Math.max(1, toNumber(gameState.inventory?.finishedGoodsContainers, 1))
  const inventoryTurnover = salesAmount / inventoryContainers
  const demandPerVariation = calculateDemandPerVariation(
    gameState.market?.price,
    settings,
  )
  const demand = demandPerVariation * Math.max(0, toNumber(gameState.market?.activeVariations, 0))
  const production = Math.min(demand, salesAmount)
  const machiningKnl = calculateMachiningKnl(gameState, settings)

  return [
    {
      key: 'oee',
      label: headerKpiMap.oee,
      value: formatKnl(machiningKnl),
      delta: formatSignedPercent(0),
    },
    {
      key: 'production',
      label: headerKpiMap.production,
      value: formatContainers(production),
      delta: formatSignedPercent(0),
    },
    {
      key: 'revenue',
      label: headerKpiMap.revenue,
      value: formatCurrency(currentIncome.revenue.amount),
      delta: formatSignedPercent(0),
    },
    {
      key: 'result',
      label: headerKpiMap.result,
      value: formatCurrency(resultAmount),
      delta: formatSignedPercent(0),
    },
    {
      key: 'inventoryTurnover',
      label: headerKpiMap.inventoryTurnover,
      value: `${inventoryTurnover.toLocaleString('fi-FI', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}x`,
      delta: '+0.0',
    },
  ]
}