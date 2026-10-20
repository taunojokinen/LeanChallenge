import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEVELOPMENT_HELP_HIDDEN_KEY,
  DEVELOPMENT_HELP_SEEN_KEY,
  markDevelopmentHelpSeen,
  readDevelopmentHelpPreferences,
  saveDevelopmentHelpPreference,
  shouldAutoOpenDevelopmentHelp,
} from './helpPreferences.js'

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    values,
  }
}

test('automatically opens the help only before its first view and when not hidden', () => {
  assert.equal(shouldAutoOpenDevelopmentHelp({ seen: false, hidden: false }), true)
  assert.equal(shouldAutoOpenDevelopmentHelp({ seen: true, hidden: false }), false)
  assert.equal(shouldAutoOpenDevelopmentHelp({ seen: false, hidden: true }), false)
})

test('persists viewed and do-not-show preferences separately in local storage', () => {
  const storage = createStorage({ 'other-help-preference': 'true' })
  markDevelopmentHelpSeen(storage)
  saveDevelopmentHelpPreference(true, storage)

  assert.deepEqual(readDevelopmentHelpPreferences(storage), { seen: true, hidden: true })
  assert.equal(storage.values.get('other-help-preference'), 'true')
  assert.equal(storage.values.get(DEVELOPMENT_HELP_SEEN_KEY), 'true')
  assert.equal(storage.values.get(DEVELOPMENT_HELP_HIDDEN_KEY), 'true')
  assert.equal(shouldAutoOpenDevelopmentHelp(readDevelopmentHelpPreferences(storage)), false)
})

test('manual help remains available independently of the automatic display preference', () => {
  const storage = createStorage({ [DEVELOPMENT_HELP_HIDDEN_KEY]: 'true' })
  const preferences = readDevelopmentHelpPreferences(storage)

  assert.equal(shouldAutoOpenDevelopmentHelp(preferences), false)
  assert.equal(preferences.hidden, true)
})

test('reports unavailable storage instead of silently dropping preferences', () => {
  assert.throws(() => readDevelopmentHelpPreferences(null), /paikallinen tallennustila/)
  assert.throws(() => markDevelopmentHelpSeen(null), /paikallinen tallennustila/)
  assert.throws(() => saveDevelopmentHelpPreference(true, null), /paikallinen tallennustila/)
})
