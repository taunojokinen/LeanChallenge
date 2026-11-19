import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import app from '../app.js'
import pool from '../db/pool.js'
import { createClassroomToken, hashClassroomToken } from '../auth/classroomSession.js'
import {
  createRoundConfirmationInput, roundConfirmationCases,
} from '../../../shared/test-fixtures/roundConfirmationCases.js'
import expectedRounds from '../../../shared/test-fixtures/roundConfirmationExpected.json' with { type: 'json' }

const sessionId = '9007199254740993'
const initialVersion = '9007199254740994'
const nextVersion = '9007199254740995'
const token = createClassroomToken()
const tokenHash = hashClassroomToken(token)
const one = (row) => ({ rowCount: 1, rows: [row] })
const none = { rowCount: 0, rows: [] }

function fixture(scenario = roundConfirmationCases[0]) {
  const { gameState, factorySettings, decisions } = createRoundConfirmationInput(scenario)
  return {
    body: {
      sessionId, roundNumber: gameState.round, expectedStateVersion: initialVersion,
      decisions: Object.fromEntries(Object.entries(decisions).map(([key, decision]) => {
        if (!decision) return [key, null]
        const { round, savedAt, ...fields } = decision
        assert.equal(round, gameState.round)
        assert.equal(typeof savedAt, 'string')
        return [key, fields]
      })),
    },
    row: { schema_version: 1, factory_settings: factorySettings, current_game_state: gameState, state_version: initialVersion },
  }
}

// Model transaction-local writes and a queue for the session row lock. No live database is used.
function fakeDatabase(t, row, options = {}) {
  const db = { row, attempts: [], writes: [], releases: 0 }
  let lock = Promise.resolve()
  t.mock.method(pool, 'connect', async () => {
    const staged = []
    let unlock
    let transaction = false
    return {
      async query(sql, params) {
        db.attempts.push(sql)
        if (sql === 'BEGIN ISOLATION LEVEL READ COMMITTED') {
          assert.equal(transaction, false)
          transaction = true
          return
        }
        assert.equal(transaction, true)
        if (sql === 'ROLLBACK' || sql === 'COMMIT') {
          if (sql === 'COMMIT') {
            db.writes.push(...staged)
            for (const [kind, args] of staged) {
              if (kind === 'state') db.row = { ...db.row, current_game_state: args[1], state_version: nextVersion }
              if (kind === 'session') db.completionReason = args[1]
            }
          }
          unlock?.()
          transaction = false
          return
        }
        if (sql.startsWith('SELECT id FROM public.game_sessions')) {
          assert.match(sql, /mode = 'classroom' AND access_token_hash = \$2\s+FOR UPDATE/)
          if (params[0] !== sessionId || !params[1].equals(tokenHash)) return none
          const previous = lock
          lock = new Promise((resolve) => { unlock = resolve })
          await previous
          return one({ id: sessionId })
        }
        assert.ok(unlock, 'session row must be locked before reading state or writing')
        assert.equal(params[0], sessionId)
        if (sql.includes('FOR UPDATE')) {
          assert.match(sql, /FROM public\.classroom_game_states WHERE session_id = \$1 FOR UPDATE/)
          return db.row ? one(db.row) : none
        }
        if (sql.startsWith('SELECT finished_at')) {
          assert.match(sql, /access_token_expires_at > clock_timestamp\(\) AND access_token_revoked_at IS NULL/)
          assert.match(sql, /COALESCE\(to_jsonb\(gs\)->'server_round_confirmation_enabled' = 'true'::jsonb, false\)/)
          return one({
            authorized: options.authorized ?? true,
            enabled: options.enabled ?? true,
            finished_at: db.completionReason ? new Date() : null,
            completion_reason: db.completionReason,
          })
        }
        const match = /^(?:INSERT INTO|UPDATE) public\.(round_decisions|round_results|classroom_game_states|game_sessions)\b/.exec(sql)
        assert.ok(match, sql)
        const kind = { round_decisions: 'decisions', round_results: 'result', classroom_game_states: 'state', game_sessions: 'session' }[match[1]]
        if (kind === options.failAt) throw Object.assign(new Error('simulated write failure'), { code: 'XX000' })
        if (kind === 'decisions' || kind === 'result') {
          assert.match(sql, /ON CONFLICT \(game_session_id, round_number\) DO NOTHING/)
        }
        if (kind === options.duplicateAt) return none
        if (kind === 'state') {
          assert.match(sql, /SET current_game_state = \$2, state_version = state_version \+ 1, updated_at = clock_timestamp\(\)/)
          assert.match(sql, /WHERE session_id = \$1 AND state_version = \$3/)
          assert.equal(params[2], db.row.state_version)
          assert.doesNotMatch(sql, /initial_game_state/)
        }
        staged.push([kind, params])
        return one({ state_version: nextVersion })
      },
      release() {
        assert.equal(transaction, false)
        db.releases++
      },
    }
  })
  return db
}

test('classroom round confirmation HTTP API', async (t) => {
  const server = app.listen(0, '127.0.0.1')
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())))
  await once(server, 'listening')
  async function post(body, { cookie = token, csrf = true } = {}) {
    const headers = { 'Content-Type': 'application/json' }
    if (cookie !== null) headers.Cookie = `lc_classroom_session=${cookie}`
    if (csrf) headers['X-Requested-With'] = 'XMLHttpRequest'
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/games/sessions/current/rounds/confirm`, {
      method: 'POST', headers, body: JSON.stringify(body),
    })
    if (csrf) assert.equal(response.headers.get('cache-control'), 'no-store')
    return { status: response.status, body: await response.json() }
  }

  for (const scenario of roundConfirmationCases) {
    await t.test(`writes the full ACT reference state and reports: ${scenario.name}`, async (t) => {
      const { body, row } = fixture(scenario)
      const db = fakeDatabase(t, row)
      const expected = expectedRounds[scenario.name]
      const state = { ...expected.nextGameState, initialFinancialHistory: row.current_game_state.initialFinancialHistory }
      const completion = state.completion ?? null
      const confirmed = await post(body)
      assert.deepEqual(confirmed, {
        status: 200,
        body: { sessionId, confirmedRound: body.roundNumber, stateVersion: nextVersion, currentGameState: state, metrics: expected.metrics, completion },
      })
      const bound = (decision) => decision && { ...decision, round: body.roundNumber }
      const decisions = body.decisions
      const { knlRatio, production, revenue, result, equity, inventoryTurnoverPerYear } = expected.metrics
      assert.deepEqual(db.writes, [
        ['decisions', [sessionId, body.roundNumber, bound(decisions.actDecision), bound(decisions.checkStaffingDecision),
          bound(decisions.checkProductionDecision), bound(decisions.investmentsDecision), bound(decisions.fiveSDecision),
          bound(decisions.projectsDecision)]],
        ['result', [sessionId, body.roundNumber, knlRatio * 100, production, revenue, result, equity, inventoryTurnoverPerYear]],
        ['state', [sessionId, state, initialVersion]],
        ...(completion ? [['session', [sessionId, completion.reason === 'bankruptcy' ? 'bankruptcy' : 'completed']]] : []),
      ])
      assert.equal(db.attempts.at(-1), 'COMMIT')
      assert.equal(db.releases, 1)
      if (completion) {
        assert.equal((await post({ ...body, expectedStateVersion: nextVersion })).body.code, 'GAME_COMPLETE')
        assert.equal(db.writes.length, 4)
      }
    })
  }

  await t.test('rejects invalid cookies, missing CSRF header and malformed decisions before connecting', async (t) => {
    const { body, row } = fixture()
    const db = fakeDatabase(t, row)
    assert.equal((await post(body, { csrf: false })).status, 403)
    assert.equal((await post(body, { cookie: null })).status, 401)
    assert.equal((await post(body, { cookie: 'invalid' })).status, 401)
    const act = body.decisions.actDecision
    for (const invalidBody of [
      { ...body, sessionId: Number(sessionId) },
      { ...body, sessionId: '092' },
      { ...body, sessionId: `${sessionId}\n` },
      { ...body, expectedStateVersion: '9223372036854775808' },
      { ...body, roundNumber: '1' },
      { ...body, currentGameState: {} },
      { ...body, decisions: { ...body.decisions, forecast: {} } },
      { ...body, decisions: { ...body.decisions, actDecision: { ...act, price: -1 } } },
      { ...body, decisions: { ...body.decisions, actDecision: { ...act, round: 2 } } },
      { ...body, decisions: { ...body.decisions, checkStaffingDecision: { staffing: { assembly: 1 } } } },
    ]) {
      assert.equal((await post(invalidBody)).body.code, 'INVALID_CONFIRMATION')
    }
    assert.deepEqual(db.attempts, [])
  })

  for (const [name, options, override, cookie, status, code] of [
    ['wrong session', {}, { sessionId: '7' }, token, 401, 'UNAUTHORIZED'],
    ['wrong token', {}, {}, createClassroomToken(), 401, 'UNAUTHORIZED'],
    ['expired or revoked', { authorized: false }, {}, token, 401, 'UNAUTHORIZED'],
    ['old session with stored state at version 1', { enabled: false }, { expectedStateVersion: '1' }, token, 403, 'SERVER_CONFIRMATION_DISABLED'],
    ['missing state', { missingState: true }, {}, token, 409, 'STATE_UNAVAILABLE'],
    ['stale version', {}, { expectedStateVersion: '1' }, token, 409, 'STALE_STATE'],
    ['wrong round', {}, { roundNumber: 2 }, token, 409, 'WRONG_ROUND'],
    ['pre-existing decisions', { duplicateAt: 'decisions' }, {}, token, 409, 'ROUND_ALREADY_CONFIRMED'],
    ['pre-existing results', { duplicateAt: 'result' }, {}, token, 409, 'ROUND_ALREADY_CONFIRMED'],
    ['result write fails', { failAt: 'result' }, {}, token, 503, 'CONFIRMATION_UNAVAILABLE'],
    ['state write fails', { failAt: 'state' }, {}, token, 503, 'CONFIRMATION_UNAVAILABLE'],
    ['completion write fails', { failAt: 'session', final: true }, {}, token, 503, 'CONFIRMATION_UNAVAILABLE'],
  ]) {
    await t.test(`${name} leaves no committed changes`, async (t) => {
      const { body, row } = fixture(options.final ? roundConfirmationCases[6] : undefined)
      if (options.enabled === false) row.state_version = '1'
      const db = fakeDatabase(t, options.missingState ? null : row, options)
      const response = await post({ ...body, ...override }, { cookie })
      assert.equal(response.status, status)
      assert.equal(response.body.code, code)
      assert.equal(Object.hasOwn(response.body, 'currentGameState'), false)
      assert.deepEqual(db.writes, [])
      assert.equal(db.attempts.at(-1), 'ROLLBACK')
      assert.equal(db.releases, 1)
    })
  }

  await t.test('rejects decisions that do not fit the locked game state or settings', async (t) => {
    const { body, row } = fixture()
    const db = fakeDatabase(t, row)
    for (const decisions of [
      { checkProductionDecision: { batchSize: 21 } },
      { actDecision: { ...body.decisions.actDecision, price: 25001 } },
      { fiveSDecision: { investedHours: { machining: 100, assembly: 100, shipping: 100 } },
        projectsDecision: { selections: [{ department: 'machining', method: 'smed', investedHours: 101 }] } },
      { projectsDecision: { selections: [{ department: 'shipping', method: 'smed', investedHours: 100 }] } },
      { checkStaffingDecision: { staffing: { assembly: 10000, shipping: 10 } } },
      { investmentsDecision: { investments: [{ type: 'new-machine', quantity: 10000 }] } },
    ]) {
      const response = await post({ ...body, decisions: { ...body.decisions, ...decisions } })
      assert.equal(response.status, 400)
    }
    assert.equal(db.attempts.some((sql) => /^(INSERT|UPDATE)/.test(sql)), false)
    assert.deepEqual(db.writes, [])
  })

  await t.test('simultaneous and repeated submissions cannot confirm the same round twice', async (t) => {
    const { body, row } = fixture()
    const db = fakeDatabase(t, row)
    const replies = await Promise.all([post(body), post(body)])
    assert.deepEqual(replies.map(({ status }) => status).sort(), [200, 409])
    assert.equal(replies.find(({ status }) => status === 409).body.code, 'STALE_STATE')
    assert.equal((await post(body)).body.code, 'STALE_STATE')
    assert.deepEqual(db.writes.map(([kind]) => kind), ['decisions', 'result', 'state'])
    assert.equal(db.attempts.filter((sql) => sql === 'COMMIT').length, 1)
    assert.equal(db.releases, 3)
  })
})
