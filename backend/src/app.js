import express from 'express'
import cookieParser from 'cookie-parser'
import pool from './db/pool.js'
import gamesRouter from './routes/games.routes.js'
import setupsRouter from './routes/setups.routes.js'
import authRouter from './routes/auth.routes.js'
import teacherGamesRouter from './routes/teacherGames.routes.js'
import { attachSession, csrfProtection } from './auth/authMiddleware.js'

const app = express()

// Mahdollistaa JSON-pyyntöjen ja evästeiden käsittelyn
app.use(express.json())
app.use(cookieParser())
app.use(attachSession)
app.use(csrfProtection)

app.use('/api/auth', authRouter)
app.use('/api/teacher/games', teacherGamesRouter)
app.use('/api/games', gamesRouter)
app.use('/api/setups', setupsRouter)

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Lean Challenge API',
  })
})

// Testaa tietokantayhteyden kevyellä SELECT 1 -kyselyllä
app.get('/api/health/db', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({
      status: 'ok',
      database: 'connected',
    })
  } catch (error) {
    // Älä paljasta yhteystietoja tai salasanoja virheilmoituksessa
    console.error('Tietokantayhteys epäonnistui:', error.message)
    res.status(503).json({
      status: 'error',
      database: 'unavailable',
      message: 'Tietokantaan ei saada yhteyttä',
    })
  }
})

export default app
