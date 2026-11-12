import pool from '../db/pool.js'

// Hakee kaikki vaikeustasot (setup-asetukset) tietokannasta.
export async function findAllSetups() {
  const result = await pool.query(
    `SELECT
       id,
       name,
       version,
       fixed_costs_quarter,
       initial_equity,
       new_machine_price,
       setup_time_hours,
       initial_batch_size,
       factory_area_m2,
       knl_time_constant_hours,
       good_quality_threshold,
       excellent_quality_threshold,
       five_s_initial_multiplier,
       five_s_multiplier_time_constant,
       price_decline_percent_per_round
     FROM setup
     ORDER BY id`
  )

  return result.rows
}
