import test from 'node:test'
import assert from 'node:assert/strict'
import { selectLatestConfirmedRounds } from './confirmedRounds.js'

test('selects baseline rounds when runtime history is empty', () => {
  const selected = selectLatestConfirmedRounds({
    baselineEntries: [{ round: -1 }, { round: 0 }],
    runtimeEntries: [],
  })

  assert.deepEqual(selected.map((entry) => entry.round), [-1, 0])
})

test('selects the two latest confirmed runtime rounds', () => {
  const selected = selectLatestConfirmedRounds({
    baselineEntries: [{ round: -1 }, { round: 0 }],
    runtimeEntries: [{ round: 1 }, { round: 2 }, { round: 3 }],
  })

  assert.deepEqual(selected.map((entry) => entry.round), [2, 3])
})

test('runtime entries replace duplicate baseline rounds', () => {
  const selected = selectLatestConfirmedRounds({
    baselineEntries: [{ round: -1 }, { round: 0 }],
    runtimeEntries: [{ round: 0, source: 'runtime' }, { round: 1 }],
  })

  assert.equal(selected[0].source, 'runtime')
})
