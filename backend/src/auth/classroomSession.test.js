import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import app from '../app.js'
import pool from '../db/pool.js'
import { classroomCookieOptions, createClassroomToken, hashClassroomToken } from './classroomSession.js'

test('classroom tokens are random and only their SHA-256 digest is stored', () => {
  const first = createClassroomToken()
  const second = createClassroomToken()
  assert.match(first, /^[A-Za-z0-9_-]{43}$/)
  assert.notEqual(first, second)
  assert.deepEqual(hashClassroomToken(first), createHash('sha256').update(first).digest())
  assert.equal(hashClassroomToken(first).length, 32)
})

test('classroom cookie is usable locally and secure in production', () => {
  const original = process.env.NODE_ENV
  try {
    process.env.NODE_ENV = 'development'
    assert.equal(classroomCookieOptions().secure, false)
    process.env.NODE_ENV = 'production'
    assert.equal(classroomCookieOptions().secure, true)
    assert.equal(classroomCookieOptions().httpOnly, true)
  } finally {
    if (original === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = original
  }
})

test('joining issues isolated cookies and session authorization checks id, expiry and revocation', async () => {
  const originalQuery = pool.query
  const originalConnect = pool.connect
  const originalEnv = process.env.NODE_ENV
  const sessions = new Map()
  const states = new Map()
  let nextId = 9007199254740993n
  let lookupCount = 0
  let failLookup = false
  process.env.NODE_ENV = 'production'
  pool.query = async (sql, params) => {
    if (sql.includes('FROM games g')) {
      return {
        rows: [{
          id: '1',
          name: 'Test',
          join_code: 'LEAN-TEST',
          setup_id: '1',
          fixed_costs_quarter: '400000',
          initial_equity: '2073975',
          new_machine_price: '500000',
          setup_time_hours: '40',
          initial_batch_size: '20',
          factory_area_m2: '4250',
          knl_time_constant_hours: '300',
          good_quality_threshold: '75',
          excellent_quality_threshold: '80',
        }],
      }
    }
    if (sql.includes('SELECT id FROM game_sessions')) {
      lookupCount++
      if (failLookup) throw new Error('test database unavailable')
      assert.match(sql, /access_token_expires_at > NOW\(\)/)
      assert.match(sql, /access_token_revoked_at IS NULL/)
      assert.match(sql, /mode = 'classroom'/)
      const session = sessions.get(params[0])
      return { rows: session && !session.expired && !session.revoked && session.hash.equals(params[1])
        ? [{ id: params[0] }] : [] }
    }
    throw new Error('Unexpected query')
  }
  pool.connect = async () => {
    let snapshot
    return {
      async query(sql, params = []) {
        if (sql === 'BEGIN') {
          snapshot = {
            sessions: new Map(sessions),
            states: new Map(states),
          }
          return { rows: [] }
        }
        if (sql.includes('INSERT INTO game_sessions')) {
          assert.match(sql, /NOW\(\) \+ INTERVAL '30 days'/)
          const id = String(nextId++)
          sessions.set(id, { hash: params[2], player: params[1], expired: false, revoked: false })
          return { rows: [{ id }] }
        }
        if (sql.includes('INSERT INTO public.classroom_game_states')) {
          const id = params[0]
          assert.equal(states.has(id), false)
          const initialGameState = JSON.parse(params[2])
          states.set(id, {
            factorySettings: JSON.parse(params[1]),
            initialGameState,
            currentGameState: initialGameState,
          })
          return { rows: [] }
        }
        if (sql === 'COMMIT') return { rows: [] }
        if (sql === 'ROLLBACK') {
          sessions.clear()
          states.clear()
          for (const [id, session] of snapshot.sessions) sessions.set(id, session)
          for (const [id, state] of snapshot.states) states.set(id, state)
          return { rows: [] }
        }
        throw new Error(`Unexpected transaction query: ${sql}`)
      },
      release() {},
    }
  }
  const server = app.listen(0, '127.0.0.1')
  try {
    await new Promise((resolve) => server.once('listening', resolve))
    const base = `http://127.0.0.1:${server.address().port}`
    const join = () => fetch(`${base}/api/games/join/LEAN-TEST`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ playerName: 'Same name' }),
    })
    const first = await join()
    const firstCookie = first.headers.get('set-cookie')
    const firstBody = await first.json()
    const second = await join()
    const secondCookie = second.headers.get('set-cookie')
    const secondBody = await second.json()
    assert.equal(first.status, 200)
    assert.equal(second.status, 200)
    assert.equal(firstBody.sessionId, '9007199254740993')
    assert.notEqual(firstBody.sessionId, secondBody.sessionId)
    assert.equal(sessions.get(firstBody.sessionId).player, sessions.get(secondBody.sessionId).player)
    assert.equal(states.size, 2)
    assert.deepEqual(states.get(firstBody.sessionId).initialGameState,
      states.get(firstBody.sessionId).currentGameState)
    assert.match(firstCookie, /HttpOnly/i)
    assert.match(firstCookie, /Secure/i)
    assert.match(firstCookie, /SameSite=Lax/i)
    assert.match(firstCookie, /Max-Age=2592000/i)
    assert.equal(first.headers.get('cache-control'), 'no-store')
    const cookie1 = firstCookie.split(';')[0]
    const cookie2 = secondCookie.split(';')[0]
    assert.notEqual(cookie1, cookie2)
    const rawToken = decodeURIComponent(cookie1.split('=')[1])
    assert.deepEqual(sessions.get(firstBody.sessionId).hash, hashClassroomToken(rawToken))
    assert.equal(JSON.stringify(firstBody).includes(rawToken), false)

    const verify = (id, cookie) => fetch(`${base}/api/games/sessions/${id}`, {
      headers: cookie ? { Cookie: cookie } : {},
    })
    const valid = await verify(firstBody.sessionId, cookie1)
    assert.equal(valid.status, 200)
    assert.equal(valid.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await valid.json(), { sessionId: firstBody.sessionId })
    assert.equal((await verify(firstBody.sessionId, cookie2)).status, 401)
    assert.equal((await verify(secondBody.sessionId, cookie1)).status, 401)
    assert.equal((await verify(firstBody.sessionId)).status, 401)
    assert.equal((await verify('9223372036854775808', cookie1)).status, 401)
    const count = lookupCount
    assert.equal((await verify(firstBody.sessionId, 'lc_classroom_session=invalid')).status, 401)
    assert.equal(lookupCount, count)
    sessions.get(firstBody.sessionId).expired = true
    assert.equal((await verify(firstBody.sessionId, cookie1)).status, 401)
    sessions.get(firstBody.sessionId).expired = false
    sessions.get(firstBody.sessionId).revoked = true
    assert.equal((await verify(firstBody.sessionId, cookie1)).status, 401)
    failLookup = true
    const unavailable = await verify(firstBody.sessionId, cookie1)
    assert.equal(unavailable.status, 503)
    assert.equal((await unavailable.json()).message, 'Pelisuorituksen tarkistus epäonnistui')
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    pool.query = originalQuery
    pool.connect = originalConnect
    if (originalEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalEnv
  }
})
