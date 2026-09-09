import test from 'node:test'
import assert from 'node:assert/strict'
import { createInitialGameState } from '../../entities/factory-settings/initialGameState.js'
import {
  GAME_DECISION_STORAGE_KEYS,
  resetGameDecisionStorage,
} from './resetGameSession.js'

function createStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues))

  return {
    removeItem(key) {
      values.delete(key)
    },
    getItem(key) {
      return values.get(key) ?? null
    },
    has(key) {
      return values.has(key)
    },
  }
}

test('reset removes only Lean Cockpit decision storage keys', () => {
  const storage = createStorage({
    ...Object.fromEntries(GAME_DECISION_STORAGE_KEYS.map((key) => [key, 'old decision'])),
    'teacher-settings': 'keep me',
    unrelated: 'keep me too',
  })

  resetGameDecisionStorage(storage)

  GAME_DECISION_STORAGE_KEYS.forEach((key) => assert.equal(storage.has(key), false))
  assert.equal(storage.getItem('teacher-settings'), 'keep me')
  assert.equal(storage.getItem('unrelated'), 'keep me too')
})

test('new session starts at round one with empty runtime history', () => {
  const initialState = createInitialGameState()

  assert.equal(initialState.round, 1)
  assert.deepEqual(initialState.history ?? [], [])
})
