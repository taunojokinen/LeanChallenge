import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createSession,
  getSession,
  deleteSession,
  isRateLimited,
  recordLoginAttempt,
  clearLoginAttempts,
  _resetForTests,
} from './sessionStore.js'

test('createSession returns a token and getSession retrieves it', () => {
  _resetForTests()
  const token = createSession(42)
  assert.ok(typeof token === 'string')
  assert.equal(token.length, 64) // 32 bytes hex

  const session = getSession(token)
  assert.ok(session)
  assert.equal(session.teacherId, 42)
})

test('getSession returns null for unknown token', () => {
  _resetForTests()
  assert.equal(getSession('nonexistent'), null)
})

test('deleteSession removes the session', () => {
  _resetForTests()
  const token = createSession(1)
  deleteSession(token)
  assert.equal(getSession(token), null)
})

test('isRateLimited blocks after 5 attempts within window', () => {
  _resetForTests()
  const ip = '127.0.0.1'

  for (let i = 0; i < 5; i++) {
    assert.equal(isRateLimited(ip), false)
    recordLoginAttempt(ip)
  }

  assert.equal(isRateLimited(ip), true)
})

test('clearLoginAttempts resets the rate limit', () => {
  _resetForTests()
  const ip = '127.0.0.1'

  for (let i = 0; i < 5; i++) {
    recordLoginAttempt(ip)
  }
  assert.equal(isRateLimited(ip), true)

  clearLoginAttempts(ip)
  assert.equal(isRateLimited(ip), false)
})

test('different IPs have independent rate limits', () => {
  _resetForTests()

  for (let i = 0; i < 5; i++) {
    recordLoginAttempt('10.0.0.1')
  }
  assert.equal(isRateLimited('10.0.0.1'), true)
  assert.equal(isRateLimited('10.0.0.2'), false)
})
