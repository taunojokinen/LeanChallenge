import { getSession } from './sessionStore.js'

const SESSION_COOKIE = 'lc_session'

// Lue istunto evästeestä ja liitä opettajan id pyyntöön.
// Ei pakota kirjautumista — sitä varten on requireAuth.
export function attachSession(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE]
  if (token) {
    const session = getSession(token)
    if (session) {
      req.teacherId = session.teacherId
      req.sessionToken = token
    }
  }
  next()
}

// Estä pääsy, jos istuntoa ei ole tai se on vanhentunut.
export function requireAuth(req, res, next) {
  if (!req.teacherId) {
    return res.status(401).json({
      status: 'error',
      message: 'Kirjautuminen vaaditaan',
    })
  }
  next()
}

// Perustason CSRF-suojaus: tilaa muuttaville pyynnöille (POST, PUT, DELETE)
// vaaditaan custom header, jota selain ei lähetä cross-origin-ilman CORS-sääntöjä.
export function csrfProtection(req, res, next) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS']
  if (safeMethods.includes(req.method)) {
    return next()
  }

  if (req.headers['x-requested-with'] !== 'XMLHttpRequest') {
    return res.status(403).json({
      status: 'error',
      message: 'Pyyntö hylätty',
    })
  }
  next()
}

export { SESSION_COOKIE }
