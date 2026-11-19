import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateRoundConfirmation } from '../../shared/game-round/confirmRound.js'
import {
  createRoundConfirmationInput,
  roundConfirmationCases,
} from '../../shared/test-fixtures/roundConfirmationCases.js'
import expectedRounds from '../../shared/test-fixtures/roundConfirmationExpected.json' with { type: 'json' }

function deepFreeze(value) {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

for (const scenario of roundConfirmationCases) {
  test(`server-side round confirmation matches ACT: ${scenario.name}`, () => {
    const { gameState: currentGameState, factorySettings, decisions } = createRoundConfirmationInput(scenario)
    const input = { currentGameState, factorySettings, decisions }
    const original = structuredClone(input)
    const expected = expectedRounds[scenario.name]
    const confirmation = calculateRoundConfirmation(deepFreeze(input))

    assert.deepEqual(confirmation.nextGameState, {
      ...expected.nextGameState,
      initialFinancialHistory: original.currentGameState.initialFinancialHistory,
    })
    assert.deepEqual(confirmation.metrics, expected.metrics)
    assert.equal(confirmation.confirmedRound, original.currentGameState.round)
    assert.deepEqual(confirmation.historyEntry, expected.nextGameState.history.at(-1))
    assert.deepEqual(confirmation.completion, expected.nextGameState.completion ?? null)
    assert.equal(confirmation.isGameComplete, Boolean(expected.nextGameState.completion))
    assert.equal(confirmation.isGameOver, expected.nextGameState.completion?.reason === 'bankruptcy')
    assert.equal(confirmation.nextGameState.historySeed, original.currentGameState.historySeed)
    assert.deepEqual(input, original)
  })
}

test('confirmation binds decisions without a round to the current round and rejects stale ones', () => {
  const { gameState: currentGameState, factorySettings, decisions } = createRoundConfirmationInput(roundConfirmationCases[0])
  const input = { currentGameState, factorySettings, decisions }
  const { batchSize } = decisions.checkProductionDecision
  assert.deepEqual(calculateRoundConfirmation({
    ...input,
    decisions: { ...decisions, checkProductionDecision: { batchSize } },
  }), calculateRoundConfirmation(input))
  assert.throws(() => calculateRoundConfirmation({
    ...input,
    decisions: { ...decisions, checkProductionDecision: { batchSize, round: 2 } },
  }), /decision from another round/)
})
