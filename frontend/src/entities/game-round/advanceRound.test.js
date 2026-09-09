import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_FACTORY_SETTINGS } from '../factory-settings/defaultFactorySettings.js'
import { createInitialGameState } from '../factory-settings/initialGameState.js'
import { calculateRoundForecast } from '../forecast/model.js'
import { advanceRoundState } from './advanceRound.js'

function createRoundOneForecast(overrides = {}) {
  const gameState = createInitialGameState()
  const effectiveGameState = {
    ...gameState,
    ...overrides,
  }
  const forecast = calculateRoundForecast(
    effectiveGameState,
    {
      market: {
        price: 25500,
        addedVariations: 1,
        productionQuantity: 100,
      },
    },
    DEFAULT_FACTORY_SETTINGS,
  )

  return { gameState: effectiveGameState, forecast }
}

test('advances round one to round two from canonical closing state', () => {
  const { gameState, forecast } = createRoundOneForecast()
  const result = advanceRoundState({
    gameState,
    forecast,
    totalRounds: 12,
  })

  assert.equal(result.nextGameState.round, 2)
  assert.equal(result.confirmedRound, 1)
  assert.equal(result.isGameComplete, false)
  assert.equal(result.nextGameState.market.price, forecast.closingState.canonical.market.price)
  assert.equal(result.nextGameState.finance.bankLoans, forecast.closingState.canonical.finance.bankLoans)
  assert.equal(result.nextGameState.inventory.finishedGoodsContainers, forecast.closingState.canonical.inventory.finishedGoodsContainers)
})

test('does not carry derived, history, decision, or snapshot fields', () => {
  const { gameState, forecast } = createRoundOneForecast()
  const result = advanceRoundState({ gameState, forecast, totalRounds: 12 })
  const nextState = result.nextGameState

  assert.equal('machining' in nextState.staffing, false)
  assert.equal('finishedGoodsBookValue' in nextState.inventory, false)
  assert.equal('inventoryBookValue' in nextState.finance, false)
  assert.equal('fixedAssets' in nextState.finance, false)
  assert.equal('totalAssets' in nextState.finance, false)
  assert.equal('totalLiabilitiesAndEquity' in nextState.finance, false)
  assert.equal('incomeStatement' in nextState.finance, false)
  assert.equal('overdraft' in nextState.finance, false)
  assert.equal('productionQuantity' in nextState, false)
  assert.equal('forecast' in nextState, false)
  assert.equal('investmentsSnapshot' in nextState, false)
  assert.equal('fiveSDecision' in nextState, false)
})

test('history entry matches forecast and is not duplicated for the same round', () => {
  const { gameState, forecast } = createRoundOneForecast()
  const first = advanceRoundState({ gameState, forecast, totalRounds: 12 })
  const second = advanceRoundState({
    gameState: {
      ...gameState,
      history: first.nextGameState.history,
    },
    forecast,
    totalRounds: 12,
  })

  assert.equal(first.historyEntry.round, 1)
  assert.equal(first.historyEntry.incomeStatement.result, forecast.forecast.finance.result)
  assert.equal(first.historyEntry.finance.cash, forecast.closingState.canonical.finance.cash)
  assert.equal(first.historyEntry.market.activeVariations, forecast.forecast.market.totalVariations)
  assert.equal(second.nextGameState.history.length, 1)
})

test('round twelve is confirmed without creating round thirteen', () => {
  const { gameState, forecast } = createRoundOneForecast({ round: 12 })
  const result = advanceRoundState({ gameState, forecast, totalRounds: 12 })

  assert.equal(result.nextGameState.round, 12)
  assert.equal(result.isGameComplete, true)
  assert.equal(result.isGameOver, result.nextGameState.finance.equity <= 0)
  assert.equal(result.nextGameState.history.length, 1)
})

test('non-positive closing equity marks game over without changing formulas', () => {
  const { gameState, forecast } = createRoundOneForecast()
  const losingForecast = {
    ...forecast,
    closingState: {
      ...forecast.closingState,
      canonical: {
        ...forecast.closingState.canonical,
        finance: {
          ...forecast.closingState.canonical.finance,
          equity: 0,
        },
      },
    },
  }
  const result = advanceRoundState({ gameState, forecast: losingForecast, totalRounds: 12 })

  assert.equal(result.isGameOver, true)
  assert.equal(result.isGameComplete, true)
  assert.equal(result.nextGameState.round, 1)
})

test('round chain carries finance, lean, machines, and variations into round two', () => {
  const { gameState, forecast } = createRoundOneForecast({
    fiveSDecision: {
      round: 1,
      investedHours: { machining: 100, assembly: 80, shipping: 60 },
    },
    projectsDecision: {
      round: 1,
      selections: [{ department: 'machining', method: 'smed', investedHours: 20 }],
    },
    investmentsDecision: {
      round: 1,
      investments: [{ type: 'new-machine', quantity: 1 }],
    },
  })
  const advanced = advanceRoundState({ gameState, forecast, totalRounds: 12 })
  const roundTwoForecast = calculateRoundForecast(advanced.nextGameState)

  assert.equal(roundTwoForecast.forecast.finance.openingInterestBearingDebt, advanced.nextGameState.finance.bankLoans)
  assert.equal(roundTwoForecast.forecast.finance.interest, advanced.nextGameState.finance.bankLoans * roundTwoForecast.forecast.finance.roundInterestRate)
  assert.equal(roundTwoForecast.forecast.staffing.machining, advanced.nextGameState.production.machiningMachines * DEFAULT_FACTORY_SETTINGS.production.workersPerMachine)
  assert.equal(roundTwoForecast.forecast.market.activeVariationCount, advanced.nextGameState.market.activeVariations)
  assert.equal(roundTwoForecast.closingState.lean.methods.machining.smed >= advanced.nextGameState.lean.methods.machining.smed, true)
})

test('requires canonical closing state', () => {
  assert.throws(
    () => advanceRoundState({
      gameState: createInitialGameState(),
      forecast: {},
      totalRounds: 12,
    }),
    /closingState\.canonical/,
  )
})
