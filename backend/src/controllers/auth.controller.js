import argon2 from 'argon2'
import pool from '../db/pool.js'
import { findTeacherByUsername } from '../repositories/teachers.repository.js'
import {
  createSession,
  deleteSession,
  isRateLimited,
  recordLoginAttempt,
  clearLoginAttempts,
} from '../auth/sessionStore.js'
import { SESSION_COOKIE } from '../auth/authMiddleware.js'

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 8 * 60 * 60 * 1000, // 8 tuntia
  path: '/',
}

export async function login(req, res) {
  const { username, password } = req.body ?? {}

  if (!username || !password) {
    return res.status(400).json({
      status: 'error',
      message: 'Käyttäjätunnus ja salasana vaaditaan',
    })
  }

  const clientIp = req.ip ?? req.socket?.remoteAddress ?? 'unknown'

  if (isRateLimited(clientIp)) {
    return res.status(429).json({
      status: 'error',
      message: 'Liikaa kirjautumisyrityksiä. Yritä myöhemmin uudelleen.',
    })
  }

  try {
    const teacher = await findTeacherByUsername(username)

    // Tarkista salasana aina — myös silloin kun käyttäjää ei löydy —
    // jotta vastausaika ei paljasta onko tunnus olemassa.
    const passwordMatch = teacher
      ? await argon2.verify(teacher.password_hash, password)
      : await argon2.verify('$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', password)

    if (!teacher || !passwordMatch) {
      recordLoginAttempt(clientIp)
      return res.status(401).json({
        status: 'error',
        message: 'Virheellinen käyttäjätunnus tai salasana',
      })
    }

    clearLoginAttempts(clientIp)
    const token = createSession(teacher.id)

    res.cookie(SESSION_COOKIE, token, COOKIE_OPTIONS)
    res.json({
      id: teacher.id,
      username: teacher.username,
      displayName: teacher.display_name,
    })
  } catch (error) {
    console.error('Kirjautuminen epäonnistui:', error.message)
    res.status(500).json({
      status: 'error',
      message: 'Kirjautuminen epäonnistui',
    })
  }
}

export async function me(req, res) {
  if (!req.teacherId) {
    return res.status(401).json({
      status: 'error',
      message: 'Kirjautuminen vaaditaan',
    })
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, username, display_name FROM teachers WHERE id = $1',
      [req.teacherId]
    )
    const teacher = rows[0]

    if (!teacher) {
      return res.status(401).json({
        status: 'error',
        message: 'Kirjautuminen vaaditaan',
      })
    }

    res.json({
      id: teacher.id,
      username: teacher.username,
      displayName: teacher.display_name,
    })
  } catch (error) {
    console.error('Opettajan tietojen haku epäonnistui:', error.message)
    res.status(500).json({
      status: 'error',
      message: 'Tietojen hakeminen epäonnistui',
    })
  }
}

export function logout(req, res) {
  if (req.sessionToken) {
    deleteSession(req.sessionToken)
  }
  res.clearCookie(SESSION_COOKIE, { path: '/' })
  res.json({ status: 'ok' })
}
