import test from 'node:test'
import assert from 'node:assert/strict'
import { createInitialGameState } from '../factory-settings/initialGameState.js'
import { selectConfirmedKnlRounds } from './confirmedKnl.js'

// A: while planning round 1 (gameState.round === 1, no confirmed history yet), the latest
// confirmed round the player sees must be round 0 - the planning round itself is not yet history.
test('planning round 1 has confirmed round 0 as the latest confirmed reference', () => {
  const gameState = createInitialGameState()
  assert.equal(gameState.round, 1)

  const [, currentEntry] = selectConfirmedKnlRounds(gameState)

  assert.equal(currentEntry.round, 0)
})
