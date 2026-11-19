import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { appendFileSync, mkdtempSync } from 'node:fs'
import { once } from 'node:events'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { setTimeout as delay } from 'node:timers/promises'
import express from 'express'
import pg from 'pg'
import { roundConfirmationCases } from '../../shared/test-fixtures/roundConfirmationCases.js'
import expectedRounds from '../../shared/test-fixtures/roundConfirmationExpected.json' with { type: 'json' }
import { database, pgOptions, readSettings, verifyConnection, verifyPrivileges, verifySchema } from './round-pg-guard.js'

const route = '/api/games/sessions/current/rounds/confirm'
const caseName = (name) => /^[a-z0-9-]+$/.test(name)
let stage = 'käynnistys'

async function approve(settings, tag) {
  const phrase = `VARMUUSKOPIO OTETTU ${tag}`
  const terminal = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await terminal.question(
      `Kohde: Pedasus / ${database} (${settings.mode})\n` +
      `Yhteysosoite: ${settings.address}:${settings.port}; odotettu PostgreSQL-osoite: ${settings.serverAddress}:${settings.serverPort}\n` +
      `Roolit: ${settings.app.user}, ${settings.fixture.user}\n` +
      `Varmista kohde ja tuore varmuuskopio. Hyväksy kirjoittava ajo: ${phrase}\n> `,
    )
    assert.ok(answer === phrase, 'Ajokohtaista hyväksyntää ei annettu')
  } finally {
    terminal.close()
  }
}

async function assertStored(db, f, reference, reply, readFixture) {
  assert.equal(reply.status, 200)
  const version = (BigInt(f.body.expectedStateVersion) + 1n).toString()
  const expectedState = { ...reference.nextGameState, initialFinancialHistory: f.gameState.initialFinancialHistory }
  const completion = expectedState.completion ?? null
  assert.deepEqual(reply.body, {
    sessionId: f.sessionId, confirmedRound: f.round, stateVersion: version,
    currentGameState: expectedState, metrics: reference.metrics, completion,
  })
  const snap = await readFixture(db, f)
  assert.equal(snap.version, version)
  assert.deepEqual(snap.current_game_state, expectedState)
  assert.deepEqual(snap.initial_game_state, f.gameState)
  assert.deepEqual(snap.factory_settings, f.factorySettings)
  assert.equal(snap.completion_reason, completion?.reason === 'round-limit' ? 'completed' : completion?.reason ?? null)
  assert.equal(Boolean(snap.finished_at), Boolean(completion))
  const roundDecision = (key) => f.body.decisions[key] && { ...f.body.decisions[key], round: f.round }
  assert.deepEqual(snap.decisions, [{
    round_number: f.round, act_decision: roundDecision('actDecision'),
    check_staffing_decision: roundDecision('checkStaffingDecision'),
    check_production_decision: roundDecision('checkProductionDecision'),
    five_s_decision: roundDecision('fiveSDecision'), projects_decision: roundDecision('projectsDecision'),
    investments_decision: roundDecision('investmentsDecision'),
  }])
  const m = reference.metrics
  const { rows } = await db.query(`SELECT $1::numeric(6,2)::text AS knl,
    $2::numeric(14,2)::text AS revenue, $3::numeric(14,2)::text AS result,
    $4::numeric(14,2)::text AS equity, $5::numeric(10,2)::text AS inventory_turnover`,
  [m.knlRatio * 100, m.revenue, m.result, m.equity, m.inventoryTurnoverPerYear])
  assert.deepEqual(snap.results, [{ ...rows[0], round_number: f.round, production: m.production }])
}

async function concurrently(db, f, post, tag, role) {
  const blocker = await db.connect()
  const pending = []
  let releaseError
  try {
    await blocker.query('BEGIN')
    assert.equal((await blocker.query(`SELECT id FROM public.game_sessions
      WHERE id = $1 AND game_id = $2 AND player_name = $3 FOR UPDATE`, [f.sessionId, f.gameId, f.marker])).rowCount, 1)
    for (let i = 0; i < 2; i++) {
      pending.push(post(f))
      // Attach rejection handlers before polling for the locks.
      void pending.at(-1).catch(() => {})
    }
    let observed = false
    for (const until = Date.now() + 5000; Date.now() < until; await delay(50)) {
      const { rows } = await db.query(`SELECT pid, pg_blocking_pids(pid) AS blockers
        FROM pg_stat_activity WHERE application_name = $1 AND usename = $2`, [`${tag}-app`, role])
      const waiting = new Set([blocker.processID])
      for (let pass = 0; pass < rows.length; pass++) {
        for (const row of rows) {
          if (row.blockers.some((pid) => waiting.has(pid))) waiting.add(row.pid)
        }
      }
      if (waiting.size === 3) { observed = true; break }
    }
    assert.ok(observed, 'Kahta eri PostgreSQL-yhteyttä ei havaittu odottamassa testirivin lukkoa')
  } finally {
    try { await blocker.query('ROLLBACK') } catch (error) { releaseError = error }
    blocker.release(releaseError)
    await Promise.allSettled(pending)
    if (releaseError) throw releaseError
  }
  return Promise.all(pending)
}

async function run() {
  assert.ok(process.argv.length === 3 && process.argv[2] === '--live-pg' &&
    process.stdin.isTTY && process.stdout.isTTY, 'Käytä erillistä integraatiokomentoa vuorovaikutteisessa päätteessä')
  const settings = readSettings(process.env)
  const tag = `LC-ROUND-IT-${randomUUID()}`
  await approve(settings, tag)

  const appOptions = pgOptions(settings, settings.app, `${tag}-app`)
  Object.assign(process.env, {
    DB_HOST: appOptions.host, DB_PORT: String(appOptions.port), DB_NAME: database,
    DB_USER: appOptions.user, DB_PASSWORD: appOptions.password,
  })
  const { default: appPool } = await import('../src/db/pool.js')
  Object.assign(appPool.options, appOptions, {
    onConnect: (client) => verifyConnection(client, settings, settings.app),
  })
  const fixtures = new pg.Pool({
    ...pgOptions(settings, settings.fixture, `${tag}-data`),
    onConnect: (client) => verifyConnection(client, settings, settings.fixture),
  })
  for (const pool of [appPool, fixtures]) {
    pool.on('error', (error) => console.error(`Testiyhteys katkesi (${error.code ?? 'yhteysvirhe'})`))
  }
  const owned = []
  let server
  let journalPath
  let cleanup
  try {
    stage = 'kohde-, skeema- ja käyttöoikeustarkistukset'
    await verifySchema(fixtures)
    await verifyPrivileges(appPool, fixtures)
    const { rows: [parents] } = await fixtures.query(`SELECT
      EXISTS (SELECT FROM public.teachers WHERE id=$1) AS teacher,
      EXISTS (SELECT FROM public.setup WHERE id=$2) AS setup`, [settings.teacher, settings.setup])
    assert.ok(parents.teacher && parents.setup, 'Synteettiset viiterivit puuttuvat')

    const { createFixture, readFixture, cleanupFixtures } = await import('./round-pg-fixtures.js')
    cleanup = () => cleanupFixtures(fixtures, settings, owned)
    const { createClassroomToken, hashClassroomToken } = await import('../src/auth/classroomSession.js')
    const { confirmClassroomRound, parseRoundConfirmation } = await import('../src/services/classroomRound.js')
    const { default: app } = await import('../src/app.js')
    journalPath = join(mkdtempSync(join(tmpdir(), 'lean-round-pg-')), 'fixtures.jsonl')
    const journal = (entry) => appendFileSync(journalPath, `${JSON.stringify(entry)}\n`, { flush: true })
    journal({
      tag, database, mode: settings.mode, address: settings.address, port: settings.port,
      serverAddress: settings.serverAddress, serverPort: settings.serverPort, teacher: settings.teacher, setup: settings.setup,
    })
    console.log(`Ajo: ${tag}\nAjoluettelo: ${journalPath}`)
    const allowed = new Set()
    const make = async (name, scenario = roundConfirmationCases[0], options) => {
      assert.ok(caseName(name))
      const f = await createFixture(fixtures, settings, tag, name, scenario, owned, journal, options)
      allowed.add(f.sessionId)
      return f
    }
    const local = express()
    local.post(route, express.json(), (req, res, next) => {
      if (!allowed.has(req.body?.sessionId)) return res.sendStatus(404)
      next()
    }, app)
    server = local.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const post = async (f, overrides = {}, token = f.token) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}${route}`, {
        method: 'POST', signal: AbortSignal.timeout(18000),
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest',
          Cookie: `lc_classroom_session=${token}` },
        body: JSON.stringify({ ...f.body, ...overrides }),
      })
      assert.equal(response.headers.get('cache-control'), 'no-store')
      return { status: response.status, body: await response.json() }
    }
    const expectCode = (reply, status, code) => {
      assert.equal(reply.status, status)
      assert.equal(reply.body.code, code)
      assert.ok(!Object.hasOwn(reply.body, 'currentGameState'))
    }

    for (const scenario of roundConfirmationCases) {
      stage = `ACT-vertailu: ${scenario.name}`
      const f = await make(scenario.name, scenario, scenario === roundConfirmationCases[0] ? { version: '9007199254740993' } : undefined)
      const reference = expectedRounds[scenario.name]
      await assertStored(fixtures, f, reference, await post(f), readFixture)
      const saved = await readFixture(fixtures, f)
      expectCode(await post(f), 409, reference.nextGameState.completion ? 'GAME_COMPLETE' : 'STALE_STATE')
      assert.deepEqual(await readFixture(fixtures, f), saved)
      console.log(`OK ${stage}`)
    }

    stage = 'vanhentunut versio ja olemassa oleva kierrosrivi'
    const stale = await make('stale')
    const staleBefore = await readFixture(fixtures, stale)
    expectCode(await post(stale, { expectedStateVersion: '2' }), 409, 'STALE_STATE')
    assert.deepEqual(await readFixture(fixtures, stale), staleBefore)
    const duplicate = await make('duplicate', undefined, { duplicate: true })
    const duplicateBefore = await readFixture(fixtures, duplicate)
    expectCode(await post(duplicate), 409, 'ROUND_ALREADY_CONFIRMED')
    assert.deepEqual(await readFixture(fixtures, duplicate), duplicateBefore)
    console.log(`OK ${stage}`)

    stage = 'valtuutus'
    const denied = await make('disabled', undefined, { enabled: false })
    const expired = await make('expired', undefined, { expired: true })
    const revoked = await make('revoked', undefined, { revoked: true })
    const auth = await make('auth')
    const authFixtures = [denied, expired, revoked, auth]
    const before = await Promise.all(authFixtures.map((f) => readFixture(fixtures, f)))
    expectCode(await post(denied), 403, 'SERVER_CONFIRMATION_DISABLED')
    for (const f of [expired, revoked]) expectCode(await post(f), 401, 'UNAUTHORIZED')
    for (const token of ['invalid', createClassroomToken(), denied.token]) {
      expectCode(await post(auth, {}, token), 401, 'UNAUTHORIZED')
    }
    assert.deepEqual(await Promise.all(authFixtures.map((f) => readFixture(fixtures, f))), before)
    console.log(`OK ${stage}`)

    stage = 'rinnakkaisuus ja rivitason lukitus'
    const parallel = await make('parallel')
    const replies = await concurrently(fixtures, parallel, post, tag, settings.app.user)
    assert.deepEqual(replies.map((reply) => reply.status).sort(), [200, 409])
    expectCode(replies.find((reply) => reply.status === 409), 409, 'STALE_STATE')
    await assertStored(fixtures, parallel, expectedRounds['batch-10'],
      replies.find((reply) => reply.status === 200), readFixture)
    console.log(`OK ${stage}`)

    stage = 'BIGINT-ylivuoto ja rollback'
    const overflow = await make('overflow', undefined, { version: '9223372036854775807' })
    const snapshot = await readFixture(fixtures, overflow)
    await assert.rejects(confirmClassroomRound({
      ...parseRoundConfirmation(overflow.body), accessTokenHash: hashClassroomToken(overflow.token),
    }), { code: '22003', routine: 'int84pl' })
    assert.deepEqual(await readFixture(fixtures, overflow), snapshot)
    expectCode(await post(overflow), 503, 'CONFIRMATION_UNAVAILABLE')
    assert.deepEqual(await readFixture(fixtures, overflow), snapshot)
    console.log(`OK ${stage}`)
  } finally {
    try {
      if (server?.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
      if (owned.length) {
        await cleanup()
        console.log('Ajon synteettiset rivit siivottu.')
      }
    } catch (error) {
      console.error(`Automaattinen siivous epäonnistui; tarkista ajoluettelo: ${journalPath}`)
      throw error
    } finally {
      await Promise.all([fixtures.end(), appPool.end()])
    }
  }
}

run().catch((error) => {
  // Do not emit PostgreSQL details, failing requests or assertion operands.
  console.error(`Integraatioajo keskeytyi: ${stage} (${error.code ?? error.name})`)
  if (stage === 'käynnistys') console.error('Tarkista vuorovaikutteinen pääte, LC_IT_* -asetukset ja ajokohtainen hyväksyntä.')
  process.exitCode = 1
})
