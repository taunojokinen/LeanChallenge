import test from 'node:test'
import assert from 'node:assert/strict'
import { attachSession, requireAuth, csrfProtection, SESSION_COOKIE } from './authMiddleware.js'
import { createSession, _resetForTests } from './sessionStore.js'

function mockReq(overrides = {}) {
  return {
    cookies: {},
    headers: {},
    method: 'GET',
    ip: '127.0.0.1',
    ...overrides,
  }
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { res.statusCode = code; return res },
    json(data) { res.body = data; return res },
  }
  return res
}

test('attachSession sets teacherId for valid session cookie', () => {
  _resetForTests()
  const token = createSession(7)
  const req = mockReq({ cookies: { [SESSION_COOKIE]: token } })
  const res = mockRes()
  let nextCalled = false

  attachSession(req, res, () => { nextCalled = true })

  assert.equal(nextCalled, true)
  assert.equal(req.teacherId, 7)
  assert.equal(req.sessionToken, token)
})

test('attachSession does nothing without cookie', () => {
  _resetForTests()
  const req = mockReq()
  const res = mockRes()
  let nextCalled = false

  attachSession(req, res, () => { nextCalled = true })

  assert.equal(nextCalled, true)
  assert.equal(req.teacherId, undefined)
})

test('requireAuth allows authenticated requests', () => {
  const req = mockReq({ teacherId: 1 })
  const res = mockRes()
  let nextCalled = false

  requireAuth(req, res, () => { nextCalled = true })

  assert.equal(nextCalled, true)
  assert.equal(res.statusCode, 200)
})

test('requireAuth rejects unauthenticated requests', () => {
  const req = mockReq()
  const res = mockRes()
  let nextCalled = false

  requireAuth(req, res, () => { nextCalled = true })

  assert.equal(nextCalled, false)
  assert.equal(res.statusCode, 401)
  assert.equal(res.body.message, 'Kirjautuminen vaaditaan')
})

test('csrfProtection allows GET requests', () => {
  const req = mockReq({ method: 'GET' })
  const res = mockRes()
  let nextCalled = false

  csrfProtection(req, res, () => { nextCalled = true })

  assert.equal(nextCalled, true)
})

test('csrfProtection allows POST with X-Requested-With header', () => {
  const req = mockReq({
    method: 'POST',
    headers: { 'x-requested-with': 'XMLHttpRequest' },
  })
  const res = mockRes()
  let nextCalled = false

  csrfProtection(req, res, () => { nextCalled = true })

  assert.equal(nextCalled, true)
})

test('csrfProtection rejects POST without X-Requested-With header', () => {
  const req = mockReq({ method: 'POST', headers: {} })
  const res = mockRes()
  let nextCalled = false

  csrfProtection(req, res, () => { nextCalled = true })

  assert.equal(nextCalled, false)
  assert.equal(res.statusCode, 403)
})
