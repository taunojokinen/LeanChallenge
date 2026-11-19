import pool from '../db/pool.js'

// Hakee pelin ja sen setup-asetukset liittymiskoodilla.
// Kysely on parametrisoitu ($1), jotta SQL-injektio ei ole mahdollinen.
export async function findGameByJoinCode(joinCode) {
  const result = await pool.query(
    `SELECT
       g.id,
       g.name,
       g.join_code,
       s.id AS setup_id,
       s.name AS setup_name,
       s.version,
       s.fixed_costs_quarter,
       s.initial_equity,
       s.new_machine_price,
       s.setup_time_hours,
       s.initial_batch_size,
       s.factory_area_m2,
       s.knl_time_constant_hours,
       s.good_quality_threshold,
       s.excellent_quality_threshold,
       s.five_s_initial_multiplier,
       s.five_s_multiplier_time_constant,
       s.price_decline_percent_per_round
     FROM games g
     JOIN setup s ON g.setup_id = s.id
     WHERE g.join_code = $1`,
    [joinCode]
  )

  return result.rows[0] ?? null
}

// Luo luokkahuonepelisuorituksen ja sen alkutilan yhtenä transaktiona.
export async function createGameSessionWithInitialState({
  gameId,
  playerName,
  accessTokenHash,
  factorySettings,
  initialGameState,
}) {
  const client = await pool.connect()
  let transactionStarted = false

  try {
    await client.query('BEGIN')
    transactionStarted = true

    const result = await client.query(
      `INSERT INTO game_sessions (game_id, player_name, mode, started_at, access_token_hash, access_token_expires_at)
       VALUES ($1, $2, 'classroom', NOW(), $3, NOW() + INTERVAL '30 days')
       RETURNING id`,
      [gameId, playerName, accessTokenHash]
    )
    const session = result.rows[0]

    await client.query(
      `INSERT INTO public.classroom_game_states
         (session_id, schema_version, factory_settings, initial_game_state, current_game_state, state_version)
       VALUES ($1, 1, $2::jsonb, $3::jsonb, $3::jsonb, 1)`,
      [session.id, JSON.stringify(factorySettings), JSON.stringify(initialGameState)]
    )

    await client.query('COMMIT')
    transactionStarted = false
    return session
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK')
      } catch (rollbackError) {
        console.error('Luokkahuonepelin transaktion peruminen epäonnistui:', rollbackError.message)
      }
    }
    throw error
  } finally {
    client.release()
  }
}

export async function findAuthorizedGameSession(sessionId, accessTokenHash) {
  const result = await pool.query(
    `SELECT id FROM game_sessions
     WHERE id = $1 AND mode = 'classroom' AND access_token_hash = $2
       AND access_token_expires_at > NOW() AND access_token_revoked_at IS NULL`,
    [sessionId, accessTokenHash]
  )
  return result.rows[0] ?? null
}

export async function findAuthorizedClassroomState(accessTokenHash) {
  const result = await pool.query(
    `SELECT gs.id, gs.game_id, gs.player_name, gs.started_at, g.name AS game_name,
            state.session_id AS state_session_id, state.schema_version, state.factory_settings,
            state.initial_game_state, state.current_game_state, state.state_version
     FROM game_sessions gs
     JOIN games g ON g.id = gs.game_id
     LEFT JOIN public.classroom_game_states state ON state.session_id = gs.id
     WHERE gs.access_token_hash = $1 AND gs.mode = 'classroom'
       AND gs.access_token_expires_at > NOW() AND gs.access_token_revoked_at IS NULL
     LIMIT 2`,
    [accessTokenHash]
  )

  if (result.rows.length > 1) {
    throw new Error('Tunniste vastaa useaa luokkahuonepelisuoritusta')
  }
  return result.rows[0] ?? null
}
