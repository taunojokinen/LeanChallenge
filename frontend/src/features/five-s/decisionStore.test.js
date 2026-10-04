import test from 'node:test'
import assert from 'node:assert/strict'
import { loadFiveSDecision, saveFiveSDecision } from './decisionStore.js'

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

test('incremental auto-persisted hours are readable on a simulated remount without an explicit save', () => {
  globalThis.window = { localStorage: createStorage() }

  saveFiveSDecision({ round: 4, investedHours: { machining: 10, assembly: 0, shipping: 0 } })
  saveFiveSDecision({ round: 4, investedHours: { machining: 10, assembly: 20, shipping: 0 } })
  saveFiveSDecision({ round: 4, investedHours: { machining: 10, assembly: 20, shipping: 30 } })

  const reloaded = loadFiveSDecision(4)

  assert.deepEqual(reloaded.investedHours, { machining: 10, assembly: 20, shipping: 30 })
})

test('a decision saved for the previous round is not returned for the new round', () => {
  globalThis.window = { localStorage: createStorage() }

  saveFiveSDecision({ round: 4, investedHours: { machining: 50, assembly: 0, shipping: 0 } })

  assert.equal(loadFiveSDecision(5), null)
})
