import test from 'node:test'
import assert from 'node:assert/strict'
import { formatPercentChange } from './formatPercentChange.js'

test('percentage changes use one Finnish decimal and explicit direction signs', () => {
  assert.equal(formatPercentChange(92.13186476848428), '+92,1 %')
  assert.equal(formatPercentChange(-8.44), '−8,4 %')
  assert.equal(formatPercentChange(150), '+150,0 %')
  assert.equal(formatPercentChange(0), '0,0 %')
  assert.equal(formatPercentChange(-0.01), '0,0 %')
})

test('unavailable percentage changes do not display a number', () => {
  for (const value of [null, undefined, NaN, Infinity, -Infinity]) {
    assert.equal(formatPercentChange(value), '—')
  }
})
