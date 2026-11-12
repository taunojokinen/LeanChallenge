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

// Luo uuden peli-istunnon game_sessions-tauluun.
export async function createGameSession({ gameId, playerName }) {
  const result = await pool.query(
    `INSERT INTO game_sessions (game_id, player_name, mode, started_at)
     VALUES ($1, $2, 'classroom', NOW())
     RETURNING id`,
    [gameId, playerName]
  )

  return result.rows[0]
}
