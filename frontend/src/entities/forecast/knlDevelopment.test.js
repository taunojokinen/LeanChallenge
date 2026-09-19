import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateDevelopedKnlValue,
  calculateKChangeover,
  resolveDevelopmentLevel,
  splitFiveSHoursAcrossKnl,
} from './knlDevelopment.js'

function approx(actual, expected, tolerance = 1e-9) {
  assert.equal(Math.abs(actual - expected) <= tolerance, true, `expected ${actual} to be within ${tolerance} of ${expected}`)
}

// A) H = 0 -> X = X0
test('A) zero development hours returns the baseline value', () => {
  const value = calculateDevelopedKnlValue({ x0: 0.65, cumulativeHours: 0, knlMaximum: 0.95, knlHalfLifeHours: 400 })
  approx(value, 0.65)
})

// B) H = halfLifeHours halves the remaining gap to Xmax
test('B) one half-life halves the remaining gap to the maximum', () => {
  const value = calculateDevelopedKnlValue({ x0: 0.65, cumulativeHours: 400, knlMaximum: 0.95, knlHalfLifeHours: 400 })
  approx(value, 0.8)
})

// C) H = 800 (two half-lives) quarters the remaining gap
test('C) two half-lives quarter the remaining gap to the maximum', () => {
  const value = calculateDevelopedKnlValue({ x0: 0.65, cumulativeHours: 800, knlMaximum: 0.95, knlHalfLifeHours: 400 })
  approx(value, 0.875)
})

// D) a different starting value still works with the same curve
test('D) a different baseline value follows the same half-life curve', () => {
  const value = calculateDevelopedKnlValue({ x0: 0.8, cumulativeHours: 400, knlMaximum: 0.95, knlHalfLifeHours: 400 })
  approx(value, 0.875)
})

test('the developed value never exceeds knlMaximum, however large H gets', () => {
  const value = calculateDevelopedKnlValue({ x0: 0.65, cumulativeHours: 1_000_000, knlMaximum: 0.95, knlHalfLifeHours: 400 })
  assert.equal(value <= 0.95, true)
  approx(value, 0.95, 1e-6)
})

// E) 100h of machining 5S is split into exact thirds across K, N and L
test('E) 100 machining 5S hours split into exact thirds across K, N and L', () => {
  const { K, N, L } = splitFiveSHoursAcrossKnl(100)
  approx(K, 100 / 3)
  approx(N, 100 / 3)
  approx(L, 100 / 3)
  approx(K + N + L, 100)
})

// F) 5S never adds hours to K_changeover - splitFiveSHoursAcrossKnl simply has no changeover output.
test('F) the 5S split has no K_changeover component at all', () => {
  const split = splitFiveSHoursAcrossKnl(100)
  assert.equal('changeover' in split, false)
  assert.equal(Object.keys(split).sort().join(','), 'K,L,N')
})

// G) development levels
test('G) development level thresholds match baseHours=100, multiplier=1.5', () => {
  const settings = { baseHours: 100, multiplier: 1.5 }
  assert.equal(resolveDevelopmentLevel(99, settings), 0)
  assert.equal(resolveDevelopmentLevel(100, settings), 1)
  assert.equal(resolveDevelopmentLevel(149, settings), 1)
  assert.equal(resolveDevelopmentLevel(150, settings), 2)
  assert.equal(resolveDevelopmentLevel(225, settings), 3)
  assert.equal(resolveDevelopmentLevel(337.5, settings), 4)
  assert.equal(resolveDevelopmentLevel(506.25, settings), 5)
})

// H) K_changeover reference scenario
test('H) K_changeover: production 200, batchSize 20, setupTime 10h, 3 machines, 1040h/machine', () => {
  const { totalChangeovers, totalChangeoverHours, plannedMachineHours, kChangeover } = calculateKChangeover({
    productionQuantity: 200,
    batchSize: 20,
    setupTimeHours: 10,
    machineCount: 3,
    plannedHoursPerMachine: 1040,
  })

  assert.equal(totalChangeovers, 10)
  assert.equal(totalChangeoverHours, 100)
  assert.equal(plannedMachineHours, 3120)
  approx(kChangeover, 1 - 100 / 3120)
})

// I) same case with batchSize 1
test('I) K_changeover with batchSize 1 (many more, shorter changeovers)', () => {
  const { totalChangeovers, totalChangeoverHours, kChangeover } = calculateKChangeover({
    productionQuantity: 200,
    batchSize: 1,
    setupTimeHours: 10,
    machineCount: 3,
    plannedHoursPerMachine: 1040,
  })

  assert.equal(totalChangeovers, 200)
  assert.equal(totalChangeoverHours, 2000)
  approx(kChangeover, 1 - 2000 / 3120)
})

// J) machineCount does not change totalChangeovers, only plannedMachineHours
test('J) machineCount only grows plannedMachineHours, never totalChangeovers', () => {
  const threeMachines = calculateKChangeover({
    productionQuantity: 200,
    batchSize: 20,
    setupTimeHours: 10,
    machineCount: 3,
    plannedHoursPerMachine: 1040,
  })
  const fiveMachines = calculateKChangeover({
    productionQuantity: 200,
    batchSize: 20,
    setupTimeHours: 10,
    machineCount: 5,
    plannedHoursPerMachine: 1040,
  })

  assert.equal(threeMachines.totalChangeovers, fiveMachines.totalChangeovers)
  assert.equal(threeMachines.totalChangeoverHours, fiveMachines.totalChangeoverHours)
  assert.equal(fiveMachines.plannedMachineHours, 5200)
  assert.equal(fiveMachines.kChangeover > threeMachines.kChangeover, true)
})

test('K_changeover is clamped to [0, 1] even under extreme changeover loss', () => {
  const { kChangeover } = calculateKChangeover({
    productionQuantity: 200,
    batchSize: 1,
    setupTimeHours: 100,
    machineCount: 1,
    plannedHoursPerMachine: 1040,
  })

  assert.equal(kChangeover, 0)
})
