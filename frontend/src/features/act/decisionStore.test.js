import test from 'node:test'
import assert from 'node:assert/strict'
import { loadActDecision, saveActDecision } from './decisionStore.js'

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

test('ACT no longer owns batchSize: saveActDecision does not persist a batchSize field', () => {
  const storage = createStorage()
  globalThis.window = { localStorage: storage }

  saveActDecision({ round: 2, price: 26000, productionQuantity: 150, addedVariations: 1, batchSize: 15 })
  const raw = JSON.parse(storage.getItem('lean-challenge-act-decision'))

  assert.equal(Object.prototype.hasOwnProperty.call(raw, 'batchSize'), false)
})

test('ACT no longer owns batchSize: loadActDecision ignores a legacy stored batchSize value', () => {
  const storage = createStorage()
  globalThis.window = { localStorage: storage }

  // Simulate a decision saved by an older version of the app that still wrote batchSize.
  storage.setItem(
    'lean-challenge-act-decision',
    JSON.stringify({ round: 3, price: 25000, productionQuantity: 100, addedVariations: 0, batchSize: 15, savedAt: 'x' }),
  )

  const loaded = loadActDecision(3)

  assert.equal(Object.prototype.hasOwnProperty.call(loaded, 'batchSize'), false)
  assert.equal(loaded.price, 25000)
  assert.equal(loaded.productionQuantity, 100)
})
