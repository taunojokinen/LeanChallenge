import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveCheckRoundLabels } from './roundLabels.js'

// H: planning round 1 must label CHECK's forecast/decision as round 1, not round 2.
test('planning round 1 labels the forecast as round 1 and the confirmed reference as round 0', () => {
  const { confirmedRound, planningRound } = resolveCheckRoundLabels(1)

  assert.equal(confirmedRound, 0)
  assert.equal(planningRound, 1)
})

test('planning round 2 labels the forecast as round 2 and the confirmed reference as round 1', () => {
  const { confirmedRound, planningRound } = resolveCheckRoundLabels(2)

  assert.equal(confirmedRound, 1)
  assert.equal(planningRound, 2)
})
