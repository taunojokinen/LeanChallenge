export const TEACHER_TEST_GAME_MODE = 'teacher-test'
export const TEACHER_TEST_SESSION_STORAGE_KEY = 'lean-challenge-teacher-test-session-v1'
export const TEACHER_TEST_SESSION_VERSION = 1

const PHASE_BY_PATH = {
  '/plan/cockpit': 'PLAN',
  '/plan/income': 'PLAN',
  '/plan/balance-sheet': 'PLAN',
  '/plan/development': 'PLAN',
  '/do': 'DO',
  '/do/investments': 'DO',
  '/check': 'CHECK',
  '/act': 'ACT',
  '/investments': 'ACT',
}

function resolveStorage(storage) {
  if (storage) {
    return storage
  }

  try {
    return globalThis.sessionStorage ?? null
  } catch {
    return null
  }
}

function isSessionShapeValid(session) {
  return session?.version === TEACHER_TEST_SESSION_VERSION
    && session.mode === TEACHER_TEST_GAME_MODE
    && session.factorySettings && typeof session.factorySettings === 'object'
    && session.initialGameState && typeof session.initialGameState === 'object'
    && session.gameState && typeof session.gameState === 'object'
    && Number.isInteger(session.gameState.round)
    && typeof session.pathname === 'string'
}

export function createTeacherTestGameSession({
  factorySettings,
  initialGameState,
  gameState = initialGameState,
  pathname = '/plan/cockpit',
}) {
  const normalizedPathname = pathname === '/plan' ? '/plan/cockpit' : pathname

  return {
    version: TEACHER_TEST_SESSION_VERSION,
    mode: TEACHER_TEST_GAME_MODE,
    factorySettings: structuredClone(factorySettings),
    initialGameState: structuredClone(initialGameState),
    gameState: structuredClone(gameState),
    pathname: normalizedPathname,
    phase: PHASE_BY_PATH[normalizedPathname] ?? null,
    round: gameState.round,
    savedAt: new Date().toISOString(),
  }
}

export function saveTeacherTestGameSession(session, storage) {
  if (!isSessionShapeValid(session)) {
    throw new Error('Opettajan testipelin sessio ei ole kelvollinen.')
  }

  const targetStorage = resolveStorage(storage)
  if (!targetStorage) {
    throw new Error('Selaimen istuntotallennus ei ole käytettävissä.')
  }

  const storedSession = {
    ...structuredClone(session),
    phase: PHASE_BY_PATH[session.pathname] ?? null,
    round: session.gameState.round,
    savedAt: new Date().toISOString(),
  }
  targetStorage.setItem(TEACHER_TEST_SESSION_STORAGE_KEY, JSON.stringify(storedSession))
  return storedSession
}

export function loadTeacherTestGameSession(storage) {
  const targetStorage = resolveStorage(storage)
  if (!targetStorage) {
    return null
  }

  try {
    const serializedSession = targetStorage.getItem(TEACHER_TEST_SESSION_STORAGE_KEY)
    if (!serializedSession) {
      return null
    }

    const session = JSON.parse(serializedSession)
    if (!isSessionShapeValid(session)) {
      return null
    }

    return structuredClone(session)
  } catch {
    return null
  }
}

export function clearTeacherTestGameSession(storage) {
  const targetStorage = resolveStorage(storage)
  targetStorage?.removeItem(TEACHER_TEST_SESSION_STORAGE_KEY)
}

export function isTeacherTestGamePath(pathname) {
  return Object.prototype.hasOwnProperty.call(PHASE_BY_PATH, pathname)
}