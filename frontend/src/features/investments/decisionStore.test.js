import test from 'node:test'
import assert from 'node:assert/strict'
import { loadInvestmentsDecision, saveInvestmentsDecision } from './decisionStore.js'

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

// Regression for the "persist across navigation" task: InvestmentsPage now auto-persists every
// valid draft change, so a simulated sequence of edits must be readable on remount.
test('incremental auto-persisted draft edits are readable on a simulated remount without an explicit save', () => {
  globalThis.window = { localStorage: createStorage() }

  saveInvestmentsDecision({
    round: 5,
    investments: [{ type: 'new-machine', quantity: 1, cost: 500000 }],
  })
  saveInvestmentsDecision({
    round: 5,
    investments: [{ type: 'new-machine', quantity: 2, cost: 1000000 }],
  })

  const reloaded = loadInvestmentsDecision(5)

  assert.equal(reloaded.investments[0].quantity, 2)
})

test('a decision saved for the previous round is not returned for the new round', () => {
  globalThis.window = { localStorage: createStorage() }

  saveInvestmentsDecision({
    round: 5,
    investments: [{ type: 'new-machine', quantity: 1, cost: 500000 }],
  })

  assert.equal(loadInvestmentsDecision(6), null)
})

test('removed investments are discarded on both load and save', () => {
  globalThis.window = { localStorage: createStorage() }
  const investments = [
    { type: 'new-machine', quantity: 2 },
    { type: 'factory-expansion', quantity: 1 },
    { type: 'mold-change-automation', quantity: 1 },
    { type: 'automatic-process-measurement', quantity: 1 },
    { type: 'condition-monitoring', quantity: 1 },
  ]
  window.localStorage.setItem('lean-challenge-investments-decision', JSON.stringify({ round: 1, investments }))
  assert.deepEqual(loadInvestmentsDecision(1).investments.map((item) => item.type), ['new-machine', 'factory-expansion'])
  saveInvestmentsDecision({ round: 1, investments })
  assert.deepEqual(JSON.parse(window.localStorage.getItem('lean-challenge-investments-decision')).investments,
    [{ type: 'new-machine', quantity: 2 }, { type: 'factory-expansion', quantity: 1 }])
})
