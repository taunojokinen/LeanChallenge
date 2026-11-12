import pool from '../db/pool.js'

// Hakee kirjautuneen opettajan omat pelit.
// teacherId tulee palvelinpuolen istunnosta, ei asiakkaalta.
export async function findGamesByTeacherId(teacherId) {
  const result = await pool.query(
    `SELECT
       g.id,
       g.name,
       g.join_code,
       s.name AS setup_name
     FROM games g
     JOIN setup s ON g.setup_id = s.id
     WHERE g.teacher_id = $1
     ORDER BY g.created_at DESC`,
    [teacherId]
  )

  return result.rows
}

// Tarkistaa onko liittymiskoodi jo käytössä.
export async function isJoinCodeTaken(joinCode) {
  const result = await pool.query(
    'SELECT 1 FROM games WHERE join_code = $1',
    [joinCode]
  )
  return result.rows.length > 0
}

// Luo uuden pelin tietokantaan.
export async function createGame({ teacherId, setupId, name, joinCode }) {
  const result = await pool.query(
    `INSERT INTO games (teacher_id, setup_id, name, join_code)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, join_code`,
    [teacherId, setupId, name, joinCode]
  )

  return result.rows[0]
}

// Hakee setup-tason id:llä.
export async function findSetupById(setupId) {
  const result = await pool.query(
    'SELECT id, name FROM setup WHERE id = $1',
    [setupId]
  )
  return result.rows[0] ?? null
}
