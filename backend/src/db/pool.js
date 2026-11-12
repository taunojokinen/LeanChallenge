import pg from 'pg'

const { Pool } = pg

// Yhteyspooli lukee asetukset ympäristömuuttujista (.env-tiedosto).
// Tietokanta voi sijaita eri koneessa (esim. Raspberry Pi), joten
// isäntä ja portti ovat aina konfiguroitavissa.
const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
})

export default pool
