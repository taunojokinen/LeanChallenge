import test from 'node:test'
import assert from 'node:assert/strict'
import { getPhaseSequence, getCurrentPhaseLabel, getPhaseProgress } from './pdca.js'

test('phase sequence starts with PLAN and loops through all phases', () => {
  const sequence = getPhaseSequence(1)
  assert.deepEqual(sequence, ['PLAN', 'DO', 'CHECK', 'ACT'])
})

test('current phase label is derived from round and phase index', () => {
  assert.equal(getCurrentPhaseLabel(1, 2), 'CHECK')
  assert.equal(getCurrentPhaseLabel(3, 0), 'PLAN')
})

test('phase progress uses round and phase index correctly', () => {
  assert.equal(getPhaseProgress(3, 1), 'Kierros 3 · DO')
})
