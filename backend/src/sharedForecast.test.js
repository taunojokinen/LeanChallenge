import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateKNL } from '../../shared/forecast/knl.js'
import { calculateFactoryKnl } from '../../shared/forecast/factoryKnl.js'
import { calculateDevelopedKnlValue } from '../../shared/forecast/knlDevelopment.js'

test('backend imports shared KNL calculations as ES modules', () => {
  assert.equal(calculateKNL(80, 90, 95), 0.684)
  assert.deepEqual(calculateFactoryKnl({
    machining: { kPct: 80, nPct: 90, lPct: 95, capacityContainers: 100 },
  }), { kPct: 80, nPct: 90, lPct: 95, knl: 0.684 })
  assert.equal(calculateDevelopedKnlValue({
    x0: 0.65,
    cumulativeHours: 400,
    knlMaximum: 0.95,
    knlHalfLifeHours: 400,
  }), 0.8)
})
