import { buildLegacyFinancialHistory } from '../../entities/factory-settings/financialHistory.js'

export const TEACHER_TEST_GAME_MODE = 'teacher-test'
export const TEACHER_TEST_SESSION_STORAGE_KEY = 'lean-challenge-teacher-test-session-v1'
export const TEACHER_TEST_SESSION_VERSION = 1
export const QUEST_SESSION_STORAGE_KEY = 'lean-challenge-quest-session-v1'

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

function isSessionShapeValid(session, mode = TEACHER_TEST_GAME_MODE) {
  return session?.version === TEACHER_TEST_SESSION_VERSION
    && session.mode === mode
    && session.factorySettings && typeof session.factorySettings === 'object'
    && session.initialGameState && typeof session.initialGameState === 'object'
    && session.gameState && typeof session.gameState === 'object'
    && Number.isInteger(session.gameState.round)
    && typeof session.pathname === 'string'
}

function createGameSession({
  factorySettings,
  initialGameState,
  gameState = initialGameState,
  pathname = '/plan/cockpit',
}, mode) {
  const normalizedPathname = pathname === '/plan' ? '/plan/cockpit' : pathname

  return {
    version: TEACHER_TEST_SESSION_VERSION,
    mode,
    factorySettings: structuredClone(factorySettings),
    initialGameState: structuredClone(initialGameState),
    gameState: structuredClone(gameState),
    pathname: normalizedPathname,
    phase: PHASE_BY_PATH[normalizedPathname] ?? null,
    round: gameState.round,
    savedAt: new Date().toISOString(),
  }
}

function saveGameSession(session, storage, mode, key) {
  if (!isSessionShapeValid(session, mode)) {
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
  targetStorage.setItem(key, JSON.stringify(storedSession))
  return storedSession
}

function loadGameSession(storage, mode, key) {
  const targetStorage = resolveStorage(storage)
  if (!targetStorage) {
    return null
  }

  try {
    const serializedSession = targetStorage.getItem(key)
    if (!serializedSession) {
      return null
    }

    const session = JSON.parse(serializedSession)
    if (!isSessionShapeValid(session, mode)) {
      return null
    }

    if (!session.gameState.initialFinancialHistory) {
      const history = session.initialGameState.initialFinancialHistory ??
        buildLegacyFinancialHistory(session.factorySettings)
      session.initialGameState.initialFinancialHistory = structuredClone(history)
      session.gameState.initialFinancialHistory = structuredClone(history)
    }

    return structuredClone(session)
  } catch (error) {
    console.error('Pelisession palauttaminen epäonnistui.', error)
    return null
  }
}

export function saveTeacherTestGameSession(session, storage) {
  return saveGameSession(session, storage, TEACHER_TEST_GAME_MODE, TEACHER_TEST_SESSION_STORAGE_KEY)
}

export function createTeacherTestGameSession(options) {
  return createGameSession(options, TEACHER_TEST_GAME_MODE)
}

export function loadTeacherTestGameSession(storage) {
  return loadGameSession(storage, TEACHER_TEST_GAME_MODE, TEACHER_TEST_SESSION_STORAGE_KEY)
}

export function createQuestGameSession(options) {
  return createGameSession(options, 'quest')
}

export function saveQuestGameSession(session, storage) {
  return saveGameSession(session, storage, 'quest', QUEST_SESSION_STORAGE_KEY)
}

export function loadQuestGameSession(storage) {
  return loadGameSession(storage, 'quest', QUEST_SESSION_STORAGE_KEY)
}

export function clearQuestGameSession(storage) {
  resolveStorage(storage)?.removeItem(QUEST_SESSION_STORAGE_KEY)
}

export function clearTeacherTestGameSession(storage) {
  const targetStorage = resolveStorage(storage)
  targetStorage?.removeItem(TEACHER_TEST_SESSION_STORAGE_KEY)
}

export function isTeacherTestGamePath(pathname) {
  return Object.prototype.hasOwnProperty.call(PHASE_BY_PATH, pathname)
}
