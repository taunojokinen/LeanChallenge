import test from 'node:test'
import assert from 'node:assert/strict'
import {
  loadCheckProductionDecision,
  saveCheckProductionDecision,
} from './decisionStore.js'

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

test('saveCheckProductionDecision persists a round-scoped production quantity decision', () => {
  globalThis.window = { localStorage: createStorage() }

  saveCheckProductionDecision({ round: 3, productionQuantity: 150 })
  const loaded = loadCheckProductionDecision(3)

  assert.equal(loaded.round, 3)
  assert.equal(loaded.productionQuantity, 150)
})

test('loadCheckProductionDecision returns null when the stored round does not match', () => {
  globalThis.window = { localStorage: createStorage() }

  saveCheckProductionDecision({ round: 4, productionQuantity: 200 })

  assert.equal(loadCheckProductionDecision(5), null)
})

test('loadCheckProductionDecision returns null when nothing has been saved', () => {
  globalThis.window = { localStorage: createStorage() }

  assert.equal(loadCheckProductionDecision(1), null)
})

test('saveCheckProductionDecision sanitizes negative or non-finite quantities to zero', () => {
  globalThis.window = { localStorage: createStorage() }

  saveCheckProductionDecision({ round: 2, productionQuantity: -50 })
  const loaded = loadCheckProductionDecision(2)

  assert.equal(loaded.productionQuantity, 0)
})

test('saveCheckProductionDecision persists batch size alongside production quantity', () => {
  globalThis.window = { localStorage: createStorage() }

  saveCheckProductionDecision({
    round: 3,
    productionQuantity: 150,
    batchSize: 5,
    targetFinishedGoodsInventory: 60,
  })
  const loaded = loadCheckProductionDecision(3)

  assert.equal(loaded.productionQuantity, 150)
  assert.equal(loaded.batchSize, 5)
  assert.equal(loaded.targetFinishedGoodsInventory, 60)
})

test('CHECK batchSize decision is round-scoped: a decision saved for round N is not returned for round N-1 or N+1', () => {
  globalThis.window = { localStorage: createStorage() }

  saveCheckProductionDecision({ round: 4, productionQuantity: 100, batchSize: 5 })

  assert.equal(loadCheckProductionDecision(3), null)
  assert.equal(loadCheckProductionDecision(5), null)
  assert.equal(loadCheckProductionDecision(4).batchSize, 5)
})

test('batchSize is optional and defaults to null when not provided', () => {
  globalThis.window = { localStorage: createStorage() }

  saveCheckProductionDecision({ round: 6, productionQuantity: 100 })
  const loaded = loadCheckProductionDecision(6)

  assert.equal(loaded.batchSize, null)
  assert.equal(loaded.targetFinishedGoodsInventory, null)
})
