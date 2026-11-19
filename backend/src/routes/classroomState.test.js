import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import app from '../app.js'
import pool from '../db/pool.js'
import { createClassroomToken, hashClassroomToken } from '../auth/classroomSession.js'

test('current classroom state is read only and authorized solely by the classroom cookie', async (t) => {
  const token = createClassroomToken()
  const row = {
    id: '9007199254740993',
    game_id: '12',
    game_name: 'Lean',
    player_name: 'Pelaaja',
    started_at: new Date('2026-01-01T10:00:00Z'),
    state_session_id: '9007199254740993',
    schema_version: 1,
    factory_settings: { game: { totalRounds: 12 } },
    initial_game_state: { round: 1, historySeed: 0, initialFinancialHistory: [{ round: 0 }] },
    current_game_state: { round: 2, historySeed: 0 },
    state_version: '9007199254740994',
    access_token_hash: hashClassroomToken(token),
  }
  const queries = t.mock.method(pool, 'query', async () => ({ rows: [row] }))
  const server = app.listen(0, '127.0.0.1')
  t.after(() => new Promise((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve())))
  await once(server, 'listening')
  const url = `http://127.0.0.1:${server.address().port}/api/games/sessions/current`
  const get = async (value, query = '') => {
    const response = await fetch(url + query, {
      headers: value === undefined ? {} : { Cookie: `lc_classroom_session=${value}` },
    })
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(response.headers.get('set-cookie'), null)
    return { status: response.status, body: await response.json() }
  }
  const unauthorized = {
    status: 401,
    body: { status: 'error', message: 'Pelisuorituksen valtuutus epäonnistui' },
  }

  await t.test('missing or malformed cookie does not query the database', async () => {
    assert.deepEqual(await get(undefined, '?sessionId=7'), unauthorized)
    assert.deepEqual(await get('invalid'), unauthorized)
    assert.equal(queries.mock.callCount(), 0)
  })

  await t.test('returns exactly the stored snapshots and ignores a supplied session ID', async () => {
    const expected = {
      status: 200,
      body: {
        sessionId: row.id,
        gameId: row.game_id,
        gameName: row.game_name,
        playerName: row.player_name,
        startedAt: row.started_at.toISOString(),
        schemaVersion: 1,
        factorySettings: row.factory_settings,
        initialGameState: row.initial_game_state,
        currentGameState: row.current_game_state,
        stateVersion: row.state_version,
      },
    }
    assert.deepEqual(await get(token, '?sessionId=7'), expected)
    assert.deepEqual(await get(token), expected)
    assert.equal(queries.mock.callCount(), 2)
    for (const { arguments: [sql, params] } of queries.mock.calls) {
      assert.match(sql, /^SELECT\b/i)
      assert.match(sql, /LEFT JOIN public\.classroom_game_states state ON state\.session_id = gs\.id/)
      assert.match(sql, /gs\.access_token_hash = \$1 AND gs\.mode = 'classroom'/)
      assert.match(sql, /gs\.access_token_expires_at > NOW\(\) AND gs\.access_token_revoked_at IS NULL/)
      assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE)\b/i)
      assert.deepEqual(params, [hashClassroomToken(token)])
    }
  })

  await t.test('no authorized database match does not disclose state', async () => {
    queries.mock.mockImplementation(async () => ({ rows: [] }))
    const unmatchedToken = createClassroomToken()
    assert.deepEqual(await get(unmatchedToken), unauthorized)
    assert.deepEqual(queries.mock.calls.at(-1).arguments[1], [hashClassroomToken(unmatchedToken)])
    // The SQL predicates also yield no match for expired, revoked or non-classroom rows.
    assert.deepEqual(await get(token), unauthorized)
  })

  await t.test('an authorized legacy session gets a specific 404 without a write', async () => {
    queries.mock.mockImplementation(async () => ({ rows: [{ ...row, state_session_id: null }] }))
    const previousCount = queries.mock.callCount()
    assert.deepEqual(await get(token), {
      status: 404,
      body: {
        status: 'error',
        code: 'CLASSROOM_STATE_NOT_FOUND',
        message: 'Pelisuoritukselle ei ole tallennettu pelitilaa',
      },
    })
    assert.equal(queries.mock.callCount(), previousCount + 1)
    assert.match(queries.mock.calls.at(-1).arguments[0], /^SELECT\b/i)
  })

  await t.test('database errors and ambiguous matches do not disclose state', async () => {
    const unavailable = {
      status: 503,
      body: { status: 'error', message: 'Pelisuorituksen tilaa ei voitu hakea' },
    }
    queries.mock.mockImplementation(async () => { throw new Error('test database unavailable') })
    assert.deepEqual(await get(token), unavailable)
    queries.mock.mockImplementation(async () => ({ rows: [row, { ...row, id: '8' }] }))
    assert.deepEqual(await get(token), unavailable)
  })
})
