import { loadFiveSDecision, saveFiveSDecision } from '../five-s/decisionStore.js'
import { loadProjectsDecision, saveProjectsDecision } from '../projects/decisionStore.js'
import { calculateProjectCost } from '../../entities/lean-projects/model.js'
import { DEFAULT_FACTORY_SETTINGS } from '../../entities/factory-settings/defaultFactorySettings.js'
import {
  DEVELOPMENT_DEPARTMENTS, developmentKey, normalizeDevelopmentHours,
  isDevelopmentHoursValid,
} from '../../entities/development/model.js'

export function loadDevelopmentDecision(round) {
  const fiveS = loadFiveSDecision(round)
  const projects = loadProjectsDecision(round)
  const rawHours = {}
  for (const department of DEVELOPMENT_DEPARTMENTS) {
    rawHours[developmentKey(department.key, 'five-s')] = fiveS?.investedHours?.[department.key] ?? 0
  }
  for (const selection of projects?.selections ?? []) {
    const key = developmentKey(selection.department, selection.method)
    rawHours[key] = (rawHours[key] ?? 0) + selection.investedHours
  }
  const hours = normalizeDevelopmentHours(rawHours)
  return {
    hours,
    wasAdjusted: Object.entries(rawHours).some(([key, value]) => value !== (hours[key] ?? 0)),
  }
}

export function buildDevelopmentDecisions({ round, hours, factorySettings = DEFAULT_FACTORY_SETTINGS, savedAt }) {
  if (!Number.isInteger(round) || round < 1 || !isDevelopmentHoursValid(hours)) {
    throw new Error('Invalid development decision or capacity exceeded')
  }
  const timestamp = savedAt ?? new Date().toISOString()
  const investedHours = {}
  const selections = []
  for (const department of DEVELOPMENT_DEPARTMENTS) {
    investedHours[department.key] = hours[developmentKey(department.key, 'five-s')]
    for (const method of department.methods.filter((key) => key !== 'five-s')) {
      const invested = hours[developmentKey(department.key, method)]
      if (invested > 0) {
        selections.push({
          department: department.key,
          method,
          investedHours: invested,
          cost: calculateProjectCost(invested, factorySettings),
        })
      }
    }
  }
  return {
    fiveSDecision: {
      round, investedHours, savedAt: timestamp,
      usedFocusHours: Object.values(investedHours).reduce((sum, value) => sum + value, 0),
    },
    projectsDecision: {
      round, selections, savedAt: timestamp,
      usedFocusHours: selections.reduce((sum, selection) => sum + selection.investedHours, 0),
      totalCost: selections.reduce((sum, selection) => sum + selection.cost, 0),
    },
  }
}

export function saveDevelopmentDecision(options) {
  const decisions = buildDevelopmentDecisions(options)
  const storage = window.localStorage
  const keys = ['lean-challenge-five-s-decision', 'lean-challenge-projects-decision']
  const previous = keys.map((key) => storage.getItem(key))
  try {
    saveFiveSDecision(decisions.fiveSDecision)
    saveProjectsDecision(decisions.projectsDecision)
  } catch (error) {
    keys.forEach((key, index) => {
      if (previous[index] === null) {
        storage.removeItem(key)
      } else {
        storage.setItem(key, previous[index])
      }
    })
    throw error
  }
  return decisions
}