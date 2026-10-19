import test from 'node:test'
import assert from 'node:assert/strict'
import { GAME_INTRO_HIDDEN_KEY, isGameIntroHidden, saveGameIntroPreference } from './preferences.js'

test('intro is enabled by default and only the explicit preference suppresses it', () => {
  for (const value of [null, 'false', '', '1', 'invalid']) {
    assert.equal(isGameIntroHidden({ getItem: () => value }), false)
  }
  assert.equal(isGameIntroHidden({ getItem: () => 'true' }), true)
})

test('intro preference persists independently without changing game storage', () => {
  const values = new Map([['lean-challenge-quest-session-v1', 'existing game']])
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
  saveGameIntroPreference(true, storage)
  assert.equal(values.get(GAME_INTRO_HIDDEN_KEY), 'true')
  assert.equal(isGameIntroHidden(storage), true)
  saveGameIntroPreference(false, storage)
  assert.equal(isGameIntroHidden(storage), false)
  assert.equal(values.get('lean-challenge-quest-session-v1'), 'existing game')
  assert.equal(values.size, 2)
})

test('unavailable storage logs read errors and does not silently accept failed writes', (t) => {
  const error = new Error('Tallennus estetty')
  const logger = t.mock.method(console, 'error', () => {})
  const storage = {
    getItem() { throw error },
    setItem() { throw error },
  }
  assert.equal(isGameIntroHidden(storage), false)
  assert.equal(logger.mock.callCount(), 1)
  assert.equal(logger.mock.calls[0].arguments[1], error)
  assert.throws(() => saveGameIntroPreference(true, storage), /Tallennus estetty/)
})
