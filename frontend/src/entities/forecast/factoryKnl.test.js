import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateFactoryKnl } from './factoryKnl.js'

test('factory KNL uses one canonical K x N x L result', () => {
  const factory = calculateFactoryKnl({
    machining: { kPct: 88, nPct: 91, lPct: 76, capacityContainers: 1 },
    assembly: { kPct: 88, nPct: 91, lPct: 76, capacityContainers: 1 },
    shipping: { kPct: 88, nPct: 91, lPct: 76, capacityContainers: 1 },
  })

  assert.equal(factory.kPct, 88)
  assert.equal(factory.nPct, 91)
  assert.equal(factory.lPct, 76)
  assert.ok(Math.abs(factory.knl - 0.608608) < 1e-12)
  assert.equal(Math.round(factory.knl * 100), 61)
})
