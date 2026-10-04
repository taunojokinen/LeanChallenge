import test from 'node:test'
import assert from 'node:assert/strict'
import { loadProjectsDecision, saveProjectsDecision } from './decisionStore.js'

function createStorage() {
  const values = new Map()

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null
    },
    setItem(key, value) {
      values.set(key, value)
    },
    removeItem(key) {
      values.delete(key)
    },
  }
}

test('incremental auto-persisted selections are readable on a simulated remount without an explicit save', () => {
  globalThis.window = { localStorage: createStorage() }

  saveProjectsDecision({
    round: 2,
    selections: [{ department: 'machining', method: 'smed', investedHours: 50, cost: 5000 }],
  })
  saveProjectsDecision({
    round: 2,
    selections: [
      { department: 'machining', method: 'smed', investedHours: 50, cost: 5000 },
      { department: 'assembly', method: 'tpm', investedHours: 30, cost: 3000 },
    ],
  })

  const reloaded = loadProjectsDecision(2)

  assert.equal(reloaded.selections.length, 2)
  assert.equal(reloaded.usedFocusHours, 80)
})

test('a decision saved for the previous round is not returned for the new round', () => {
  globalThis.window = { localStorage: createStorage() }

  saveProjectsDecision({
    round: 2,
    selections: [{ department: 'machining', method: 'smed', investedHours: 50, cost: 5000 }],
  })

  assert.equal(loadProjectsDecision(3), null)
})
