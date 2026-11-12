import pool from '../db/pool.js'

// Hakee opettajan käyttäjätunnuksella. Palauttaa myös password_hash-kentän,
// jota käytetään vain salasanan tarkistukseen — sitä ei koskaan palauteta API:sta.
export async function findTeacherByUsername(username) {
  const result = await pool.query(
    `SELECT id, username, password_hash, display_name
     FROM teachers
     WHERE username = $1`,
    [username]
  )

  return result.rows[0] ?? null
}
