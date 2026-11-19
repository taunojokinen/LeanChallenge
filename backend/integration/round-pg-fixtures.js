import assert from 'node:assert/strict'
import { createClassroomToken, hashClassroomToken } from '../src/auth/classroomSession.js'
import { createRoundConfirmationInput } from '../../shared/test-fixtures/roundConfirmationCases.js'

async function transaction(pool, action) {
  const client = await pool.connect()
  let releaseError
  try {
    await client.query('BEGIN')
    const result = await action(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    try { await client.query('ROLLBACK') } catch (failure) { releaseError = failure }
    throw error
  } finally {
    client.release(releaseError)
  }
}

export async function createFixture(pool, settings, tag, name, scenario, owned, journal, options = {}) {
  const marker = `${tag}-${name}`
  const { gameState, factorySettings, decisions } = createRoundConfirmationInput(scenario)
  const round = gameState.round
  const version = options.version ?? '1'
  const token = createClassroomToken()
  const body = {
    roundNumber: round, expectedStateVersion: version,
    decisions: Object.fromEntries(Object.entries(decisions).map(([key, item]) => [
      key, item && Object.fromEntries(Object.entries(item).filter(([field]) => !['round', 'savedAt'].includes(field))),
    ])),
  }
  const fixture = await transaction(pool, async (db) => {
    const { rows: [{ id: gameId }] } = await db.query(`
      INSERT INTO public.games (teacher_id, setup_id, name, join_code)
      VALUES ($1, $2, $3, $3) RETURNING id::text`, [settings.teacher, settings.setup, marker])
    const { rows: [{ id: sessionId }] } = await db.query(`
      INSERT INTO public.game_sessions
        (game_id, mode, player_name, started_at, access_token_hash, access_token_expires_at,
         access_token_revoked_at, server_round_confirmation_enabled)
      VALUES ($1, 'classroom', $2, clock_timestamp(), $3,
              clock_timestamp() + CASE WHEN $4 THEN interval '-1 minute' ELSE interval '1 hour' END,
              CASE WHEN $5 THEN clock_timestamp() END, $6)
      RETURNING id::text`, [gameId, marker, hashClassroomToken(token), options.expired === true,
      options.revoked === true, options.enabled !== false])
    const entry = { marker, gameId, sessionId, round }
    journal(entry) // Persist the IDs before the fixture can commit.
    owned.push(entry)
    await db.query(`
      INSERT INTO public.classroom_game_states
        (session_id, schema_version, factory_settings, initial_game_state, current_game_state, state_version)
      VALUES ($1, 1, $2, $3, $3, $4)`, [sessionId, factorySettings, gameState, version])
    if (options.duplicate) {
      await db.query(`INSERT INTO public.round_results (game_session_id, round_number, production)
        VALUES ($1, $2, 0)`, [sessionId, round])
    }
    return entry
  })
  return { ...fixture, token, body: { ...body, sessionId: fixture.sessionId }, gameState, factorySettings }
}

export async function readFixture(pool, { sessionId }) {
  const { rows: [snapshot] } = await pool.query(`
    SELECT s.finished_at, s.completion_reason, c.state_version::text AS version,
           c.factory_settings, c.initial_game_state, c.current_game_state, c.updated_at::text,
           (SELECT coalesce(jsonb_agg(to_jsonb(d) - 'id' - 'game_session_id' - 'created_at'), '[]')
              FROM public.round_decisions d WHERE d.game_session_id = s.id) AS decisions,
           (SELECT coalesce(jsonb_agg(to_jsonb(r) - 'id' - 'game_session_id' - 'created_at' ||
               jsonb_build_object('knl', r.knl::text, 'inventory_turnover', r.inventory_turnover::text,
                 'revenue', r.revenue::text, 'result', r.result::text, 'equity', r.equity::text)), '[]')
              FROM public.round_results r WHERE r.game_session_id = s.id) AS results
    FROM public.game_sessions s JOIN public.classroom_game_states c ON c.session_id = s.id
    WHERE s.id = $1`, [sessionId])
  assert.ok(snapshot, 'Synteettinen pelitila puuttuu')
  return snapshot
}

export async function cleanupFixtures(pool, settings, owned) {
  await transaction(pool, async (db) => {
    for (const { marker, gameId, sessionId, round } of owned) {
      const { rows: [game] } = await db.query(`SELECT name, join_code, teacher_id::text, setup_id::text
        FROM public.games WHERE id = $1 FOR UPDATE`, [gameId])
      if (!game) {
        const { rowCount } = await db.query('SELECT 1 FROM public.game_sessions WHERE id = $1', [sessionId])
        assert.equal(rowCount, 0, 'Pelisuoritus löytyi ilman ajon omaa peliä')
        continue
      }
      assert.deepEqual(game, { name: marker, join_code: marker, teacher_id: settings.teacher, setup_id: settings.setup })
      const { rows } = await db.query(`SELECT id::text, player_name, mode FROM public.game_sessions
        WHERE game_id = $1 FOR UPDATE`, [gameId])
      assert.deepEqual(rows, [{ id: sessionId, player_name: marker, mode: 'classroom' }], 'Pelin viitteet eivät vastaa ajoa')
      for (const table of ['round_decisions', 'round_results']) {
        const { rowCount } = await db.query(`SELECT 1 FROM public.${table}
          WHERE game_session_id = $1 AND round_number IS DISTINCT FROM $2`, [sessionId, round])
        assert.equal(rowCount, 0, 'Testisuorituksella on odottamaton kierrosrivi')
        await db.query(`DELETE FROM public.${table} WHERE game_session_id = $1 AND round_number = $2`, [sessionId, round])
      }
      await db.query('DELETE FROM public.classroom_game_states WHERE session_id = $1', [sessionId])
      const session = await db.query(`DELETE FROM public.game_sessions
        WHERE id = $1 AND game_id = $2 AND player_name = $3 AND mode = 'classroom'`, [sessionId, gameId, marker])
      assert.equal(session.rowCount, 1)
      const removed = await db.query(`DELETE FROM public.games
        WHERE id = $1 AND name = $2 AND join_code = $2 AND teacher_id = $3 AND setup_id = $4`,
      [gameId, marker, settings.teacher, settings.setup])
      assert.equal(removed.rowCount, 1)
    }
  })
}
