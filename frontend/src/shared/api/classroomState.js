import { DEFAULT_FACTORY_SETTINGS } from '../../../../shared/factory-settings/defaultFactorySettings.js'

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isPositiveInteger = (value) => Number.isSafeInteger(value) && value > 0

function matchesSettingsShape(value, template) {
  if (typeof template === 'number') return Number.isFinite(value)
  if (Array.isArray(template)) {
    return Array.isArray(value) && value.length > 0 &&
      value.every((item) => matchesSettingsShape(item, template[0]))
  }
  if (isRecord(template)) {
    return isRecord(value) && Object.entries(template)
      .every(([key, field]) => matchesSettingsShape(value[key], field))
  }
  return typeof value === typeof template
}

const { market, production, staffing, lean, factory, inventory } = DEFAULT_FACTORY_SETTINGS.initialState
const stateShape = {
  market, production, staffing: { ...staffing, machining: 0 }, lean, factory, inventory,
}

function isGameState(value, totalRounds) {
  return matchesSettingsShape(value, stateShape) &&
    isPositiveInteger(value.round) && value.round <= totalRounds &&
    Number.isInteger(value.historySeed) && value.historySeed >= 0 && value.historySeed <= 0xffffffff &&
    isRecord(value.finance) && Number.isFinite(value.finance.equity) &&
    isRecord(value.finance.incomeStatement) &&
    Array.isArray(value.initialFinancialHistory) && value.initialFinancialHistory.length > 0 &&
    value.initialFinancialHistory.every((entry) => isRecord(entry) && Number.isInteger(entry.round) &&
      isRecord(entry.incomeStatement) && isRecord(entry.finance) && Number.isFinite(entry.finance.equity)) &&
    (value.history === undefined || Array.isArray(value.history))
}

export async function fetchNewClassroomState(expectedSessionId, signal) {
  if (typeof expectedSessionId !== 'string' || !/^[1-9]\d*$/.test(expectedSessionId)) {
    throw new Error('Liittymisvastauksesta puuttuu kelvollinen pelisuorituksen tunniste.')
  }

  let response
  try {
    response = await fetch('/api/games/sessions/current', {
      cache: 'no-store',
      credentials: 'same-origin',
      signal,
    })
  } catch {
    throw new Error('Pelitilaa ei voitu hakea. Tarkista verkkoyhteys ja yritä tilahakua uudelleen.')
  }
  if (response.status === 401) throw new Error('Pelitilan haun valtuutus ei ole voimassa.')
  if (response.status === 404) throw new Error('Pelisuoritukselle ei löytynyt tallennettua tilaa.')
  if (!response.ok) throw new Error('Pelitilaa ei voitu hakea. Yritä tilahakua uudelleen.')

  let state
  try {
    state = await response.json()
  } catch {
    throw new Error('Palvelimen pelitilavastausta ei voitu lukea.')
  }
  if (state?.sessionId !== expectedSessionId) {
    throw new Error('Tallennetun pelitilan tunniste ei vastaa liittymisvastauksen tunnistetta.')
  }
  if (state.schemaVersion !== 1) throw new Error('Palvelimen pelitilan versiota ei tueta.')

  const { factorySettings, initialGameState, currentGameState } = state
  if (!matchesSettingsShape(factorySettings, DEFAULT_FACTORY_SETTINGS) ||
      !isPositiveInteger(factorySettings.game.totalRounds) ||
      !isGameState(initialGameState, factorySettings.game.totalRounds) ||
      !isGameState(currentGameState, factorySettings.game.totalRounds) ||
      initialGameState.historySeed !== currentGameState.historySeed) {
    throw new Error('Palvelimen tallentaman pelitilan rakenne ei kelpaa.')
  }
  return state
}
