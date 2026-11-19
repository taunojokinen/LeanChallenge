import { createHash, randomBytes } from 'node:crypto'
import { findAuthorizedGameSession } from '../repositories/games.repository.js'

export const CLASSROOM_SESSION_COOKIE = 'lc_classroom_session'
export const CLASSROOM_SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000

export function createClassroomToken() {
  return randomBytes(32).toString('base64url')
}

export function hashClassroomToken(token) {
  return createHash('sha256').update(token, 'utf8').digest()
}

export function classroomCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: CLASSROOM_SESSION_MAX_AGE,
    path: '/',
  }
}

export async function requireClassroomSession(req, res, next) {
  res.set('Cache-Control', 'no-store')
  const token = req.cookies?.[CLASSROOM_SESSION_COOKIE]
  const id = req.params.sessionId
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token) ||
      typeof id !== 'string' || !/^[1-9]\d{0,18}$/.test(id) ||
      BigInt(id) > 9223372036854775807n) {
    return res.status(401).json({ status: 'error', message: 'Pelisuorituksen valtuutus epäonnistui' })
  }

  try {
    const session = await findAuthorizedGameSession(id, hashClassroomToken(token))
    if (!session) {
      return res.status(401).json({ status: 'error', message: 'Pelisuorituksen valtuutus epäonnistui' })
    }
    req.classroomSessionId = String(session.id)
    next()
  } catch (error) {
    console.error('Pelisuorituksen valtuutuksen tarkistus epäonnistui:', error.message)
    res.status(503).json({ status: 'error', message: 'Pelisuorituksen tarkistus epäonnistui' })
  }
}
