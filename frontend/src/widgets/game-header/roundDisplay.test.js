import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatConfirmedKpiRound,
  formatGameplayRound,
  getConfirmedRound,
} from './roundDisplay.js'

test('header displays gameplay round and previous confirmed KPI round', () => {
  assert.equal(formatGameplayRound(1, 12), 'Kierros 1 / 12')
  assert.equal(formatConfirmedKpiRound(1), 'KPI:t vahvistettu kierrokselta 0')
  assert.equal(formatGameplayRound(2, 12), 'Kierros 2 / 12')
  assert.equal(formatConfirmedKpiRound(2), 'KPI:t vahvistettu kierrokselta 1')
  assert.equal(formatGameplayRound(12, 12), 'Kierros 12 / 12')
  assert.equal(getConfirmedRound(12), 11)
})
