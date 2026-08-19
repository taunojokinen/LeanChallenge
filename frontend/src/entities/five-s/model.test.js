import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getFiveSLevel,
  applyFiveSInvestment,
  applyFiveSDecay,
  calculateNextFiveSState,
  isFocusBudgetValid,
} from './model.js'

test('5S level thresholds map to exact integer levels', () => {
  assert.equal(getFiveSLevel(0), 0)
  assert.equal(getFiveSLevel(189), 1)
  assert.equal(getFiveSLevel(474), 2)
  assert.equal(getFiveSLevel(711), 3)
  assert.equal(getFiveSLevel(1066), 4)
  assert.equal(getFiveSLevel(1600), 5)
})

test('5S level interpolation returns around 2.53 for 600h', () => {
  const level = getFiveSLevel(600)
  assert.ok(level > 2.52 && level < 2.54)
})

test('0h investment applies 5 percent decay', () => {
  assert.equal(applyFiveSDecay(600), 570)

  const state = calculateNextFiveSState(600, 0)
  assert.equal(state.nextEffectiveHours, 570)
})

test('1h investment does not apply decay', () => {
  const state = calculateNextFiveSState(600, 1)
  assert.equal(state.nextEffectiveHours, 601)
})

test('effective hours are capped to 1600h upper bound', () => {
  assert.equal(applyFiveSInvestment(1599, 50), 1600)
})

test('focus budget validation rejects sums over 400h', () => {
  assert.equal(isFocusBudgetValid({ machining: 200, assembly: 150, shipping: 60 }, 400), false)
  assert.equal(isFocusBudgetValid({ machining: 200, assembly: 150, shipping: 50 }, 400), true)
})