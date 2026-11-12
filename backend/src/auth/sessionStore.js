import crypto from 'node:crypto'

// In-memory istuntosäilö. Istunnot katoavat palvelimen uudelleenkäynnistyksessä,
// mikä on hyväksyttävää tässä vaiheessa. Tuotannossa voidaan myöhemmin siirtää
// esim. Redis-tauluun ilman rajapintamuutoksia.
const sessions = new Map()

// Kirjautumisyritysten rajoitus: max 5 yritystä / 15 min / IP
const loginAttempts = new Map()
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

const SESSION_TTL_MS = 8 * 60 * 60 * 1000 // 8 tuntia

export function createSession(teacherId) {
  const token = crypto.randomBytes(32).toString('hex')
  sessions.set(token, {
    teacherId,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  })
  return token
}

export function getSession(token) {
  const session = sessions.get(token)
  if (!session) return null
  if (Date.now() > session.expiresAt) {
    sessions.delete(token)
    return null
  }
  return session
}

export function deleteSession(token) {
  sessions.delete(token)
}

export function isRateLimited(ip) {
  const now = Date.now()
  const attempts = loginAttempts.get(ip) ?? []
  const recent = attempts.filter((t) => now - t < WINDOW_MS)
  loginAttempts.set(ip, recent)
  return recent.length >= MAX_ATTEMPTS
}

export function recordLoginAttempt(ip) {
  const now = Date.now()
  const attempts = loginAttempts.get(ip) ?? []
  attempts.push(now)
  loginAttempts.set(ip, attempts)
}

export function clearLoginAttempts(ip) {
  loginAttempts.delete(ip)
}

// Testien tarvitsema resetointi
export function _resetForTests() {
  sessions.clear()
  loginAttempts.clear()
}
