import test from 'node:test'
import assert from 'node:assert/strict'
import { createInitialGameState } from '../../entities/factory-settings/initialGameState.js'
import { createInitialFactoryState } from '../../entities/factory-settings/initialFactoryState.js'
import { DEFAULT_FACTORY_SETTINGS } from '../../entities/factory-settings/defaultFactorySettings.js'
import { calculateRoundForecast } from '../../entities/forecast/model.js'
import { buildInitialKnlHistory } from '../../entities/history/confirmedKnl.js'
import { buildInitialBalanceSheetHistory, buildCanonicalFinancialHistory } from '../../entities/factory-settings/financialHistory.js'
import { advanceRoundState } from '../../entities/game-round/advanceRound.js'
import {
  buildFactorySettingsSnapshot,
  createDefaultTeacherPreferences,
} from '../../entities/factory-settings/teacherGameSettings.js'
import {
  TEACHER_TEST_GAME_MODE,
  TEACHER_TEST_SESSION_STORAGE_KEY,
  TEACHER_TEST_SESSION_VERSION,
  clearTeacherTestGameSession,
  createTeacherTestGameSession,
  loadTeacherTestGameSession,
  saveTeacherTestGameSession,
  createQuestGameSession,
  saveQuestGameSession,
  loadQuestGameSession,
  clearQuestGameSession,
} from './teacherTestGameSession.js'

function createSessionStorage() {
  const values = new Map()
  return {
    getItem(key) {
      return values.get(key) ?? null
    },
    setItem(key, value) {
      values.set(key, value)
    },
    removeItem(key) {
      values.delete(key)
    },
  }
}

test('teacher game session stores version, mode, settings snapshot, start/current state, round and phase', () => {
  const storage = createSessionStorage()
  const initialGameState = createInitialGameState()
  const gameState = structuredClone(initialGameState)
  gameState.round = 3
  const factorySettings = structuredClone(DEFAULT_FACTORY_SETTINGS)
  factorySettings.knl.knlHalfLifeHours = 200
  const session = createTeacherTestGameSession({
    factorySettings,
    initialGameState,
    gameState,
    pathname: '/check',
  })

  saveTeacherTestGameSession(session, storage)
  const restored = loadTeacherTestGameSession(storage)
  assert.equal(restored.version, TEACHER_TEST_SESSION_VERSION)
  assert.equal(restored.mode, TEACHER_TEST_GAME_MODE)
  assert.equal(restored.factorySettings.knl.knlHalfLifeHours, 200)
  assert.equal(restored.initialGameState.round, 1)
  assert.equal(restored.gameState.round, 3)
  assert.equal(restored.round, 3)
  assert.equal(restored.phase, 'CHECK')
  assert.equal(restored.pathname, '/check')
})

test('a restored teacher session is isolated from later favorite changes', () => {
  const storage = createSessionStorage()
  const factorySettings = structuredClone(DEFAULT_FACTORY_SETTINGS)
  factorySettings.costs.annualFixedCosts = 2500000
  const initialGameState = createInitialGameState(factorySettings)
  const session = createTeacherTestGameSession({ factorySettings, initialGameState })

  saveTeacherTestGameSession(session, storage)
  factorySettings.costs.annualFixedCosts = 9000000
  initialGameState.finance.equity = 1

  const restored = loadTeacherTestGameSession(storage)
  assert.equal(restored.factorySettings.costs.annualFixedCosts, 2500000)
  assert.ok(Math.abs(restored.initialGameState.finance.equity - DEFAULT_FACTORY_SETTINGS.initialState.finance.equity) < 1e-7)
})

test('teacher test game uses selected quarterly fixed costs in its forecast', () => {
  const preferences = createDefaultTeacherPreferences()
  preferences.annualFixedCosts.position = 28
  const factorySettings = buildFactorySettingsSnapshot(preferences)
  const initialGameState = createInitialGameState(factorySettings)
  const session = createTeacherTestGameSession({ factorySettings, initialGameState })
  const forecast = calculateRoundForecast(session.gameState, {}, session.factorySettings)

  assert.equal(session.factorySettings.costs.annualFixedCosts, 3000000)
  assert.equal(forecast.forecast.finance.fixedCosts, 750000)
  assert.equal(DEFAULT_FACTORY_SETTINGS.costs.annualFixedCosts, 2000000)
})

test('Quest and teacher test games share the fixed starting values and teacher settings snapshot', () => {
  const teacherSettings = buildFactorySettingsSnapshot(createDefaultTeacherPreferences())
  const teacherInitialState = createInitialGameState(teacherSettings)
  const questInitialState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const fixedValues = (gameState, settings) => ({
    machineCount: gameState.production.machiningMachines,
    machiningTime: settings.production.departments.machining.normHoursPerContainer,
    variations: gameState.market.activeVariations,
    machiningStaff: gameState.staffing.machining,
  })

  assert.deepEqual(fixedValues(teacherInitialState, teacherSettings), {
    machineCount: 4,
    machiningTime: 12,
    variations: 20,
    machiningStaff: 20,
  })
  assert.deepEqual(fixedValues(questInitialState, DEFAULT_FACTORY_SETTINGS), fixedValues(teacherInitialState, teacherSettings))

  const teacherSession = createTeacherTestGameSession({
    factorySettings: teacherSettings,
    initialGameState: teacherInitialState,
  })
  const questSession = createQuestGameSession({
    factorySettings: DEFAULT_FACTORY_SETTINGS,
    initialGameState: questInitialState,
  })
  assert.deepEqual(
    fixedValues(teacherSession.initialGameState, teacherSession.factorySettings),
    fixedValues(questSession.initialGameState, questSession.factorySettings),
  )
  assert.equal(teacherSession.factorySettings.production.departments.machining.normHoursPerContainer, 12)
})

test('Quest mode, malformed data, and unsupported versions are not restored as teacher sessions', () => {
  const storage = createSessionStorage()
  storage.setItem(TEACHER_TEST_SESSION_STORAGE_KEY, JSON.stringify({ mode: 'quest' }))
  assert.equal(loadTeacherTestGameSession(storage), null)

  storage.setItem(TEACHER_TEST_SESSION_STORAGE_KEY, '{bad json')
  assert.equal(loadTeacherTestGameSession(storage), null)

  storage.setItem(TEACHER_TEST_SESSION_STORAGE_KEY, JSON.stringify({
    ...createTeacherTestGameSession({
      factorySettings: DEFAULT_FACTORY_SETTINGS,
      initialGameState: createInitialGameState(),
    }),
    version: TEACHER_TEST_SESSION_VERSION + 1,
  }))
  assert.equal(loadTeacherTestGameSession(storage), null)
})

test('clearing a teacher game session does not alter factory defaults', () => {
  const storage = createSessionStorage()
  const session = createTeacherTestGameSession({
    factorySettings: DEFAULT_FACTORY_SETTINGS,
    initialGameState: createInitialGameState(),
  })
  saveTeacherTestGameSession(session, storage)
  clearTeacherTestGameSession(storage)
  assert.equal(storage.getItem(TEACHER_TEST_SESSION_STORAGE_KEY), null)
  assert.equal(DEFAULT_FACTORY_SETTINGS.knl.knlHalfLifeHours, 400)
})

test('both game modes restore the same seeded history and their own settings snapshot', () => {
  for (const mode of ['teacher-test', 'quest']) {
    const storage = createSessionStorage()
    const settings = structuredClone(DEFAULT_FACTORY_SETTINGS)
    settings.knl.baseline.K_assembly = mode === 'teacher-test' ? 0.5 : 0.7
    const initialGameState = createInitialGameState(settings)
    const expected = buildInitialKnlHistory(initialGameState, settings)
    const create = mode === 'teacher-test' ? createTeacherTestGameSession : createQuestGameSession
    const save = mode === 'teacher-test' ? saveTeacherTestGameSession : saveQuestGameSession
    const load = mode === 'teacher-test' ? loadTeacherTestGameSession : loadQuestGameSession
    for (const pathname of ['/plan/cockpit', '/do/investments', '/check', '/act']) {
      save(create({ factorySettings: settings, initialGameState, pathname }), storage)
      const restored = load(storage)
      assert.equal(restored.mode, mode)
      assert.equal(restored.gameState.historySeed, initialGameState.historySeed)
      assert.deepEqual(buildInitialKnlHistory(restored.gameState, restored.factorySettings), expected)
    }
    clearQuestGameSession(storage)
    assert.equal(loadQuestGameSession(storage), null)
  }
})

test('starting a new teacher game after an equity change replaces the old snapshot and balance history', () => {
  const storage = createSessionStorage()
  const preferences = createDefaultTeacherPreferences()
  let oldHistory
  for (const equity of [2000000, 3000000]) {
    preferences.equity.position = (equity - preferences.equity.easy) / 25
    const factorySettings = buildFactorySettingsSnapshot(preferences)
    const initialGameState = createInitialGameState(factorySettings)
    clearTeacherTestGameSession(storage)
    saveTeacherTestGameSession(createTeacherTestGameSession({ factorySettings, initialGameState }), storage)
    const restored = loadTeacherTestGameSession(storage)
    assert.equal(restored.factorySettings.initialState.finance.equity, equity)
    assert.ok(Math.abs(restored.gameState.finance.equity - equity) < 1e-7)
    const history = buildInitialBalanceSheetHistory(restored.gameState, restored.factorySettings)
    if (oldHistory) {
      assert.notEqual(history.liabilities.equity, oldHistory.liabilities.equity)
      assert.ok(history.liabilities.bankLoans < oldHistory.liabilities.bankLoans)
    }
    oldHistory = history
  }
  assert.equal(DEFAULT_FACTORY_SETTINGS.initialState.finance.equity, 2073975)
})

test('Quest retains its independent fixed round-zero capital and unchanged fixed costs', () => {
  const preferences = createDefaultTeacherPreferences()
  preferences.equity.position = (3000000 - preferences.equity.easy) / 25
  const teacherSettings = buildFactorySettingsSnapshot(preferences)
  const teacher = createTeacherTestGameSession({
    factorySettings: teacherSettings,
    initialGameState: createInitialGameState(teacherSettings),
  })
  const quest = createQuestGameSession({
    factorySettings: DEFAULT_FACTORY_SETTINGS,
    initialGameState: createInitialGameState(DEFAULT_FACTORY_SETTINGS),
  })
  assert.ok(Math.abs(teacher.gameState.finance.equity - 3000000) < 1e-7)
  assert.equal(quest.factorySettings.initialState.finance.equity, 2073975)
  assert.ok(Math.abs(quest.gameState.initialFinancialHistory.at(-1).finance.equity - 2073975) < 1e-7)
  assert.equal(quest.factorySettings.costs.annualFixedCosts, 2000000)
  assert.equal(quest.gameState.initialFinancialHistory.at(-1).incomeStatement.fixedCosts, 500000)
})

test('new and advanced saved sessions preserve initial capital history and closing-finance continuity in both modes', () => {
  for (const mode of ['teacher-test', 'quest']) {
    const settings = structuredClone(DEFAULT_FACTORY_SETTINGS)
    if (mode === 'teacher-test') settings.initialState.finance.equity = 3000000
    const initialGameState = createInitialGameState(settings)
    const storage = createSessionStorage()
    const create = mode === 'teacher-test' ? createTeacherTestGameSession : createQuestGameSession
    const save = mode === 'teacher-test' ? saveTeacherTestGameSession : saveQuestGameSession
    const load = mode === 'teacher-test' ? loadTeacherTestGameSession : loadQuestGameSession
    let gameState = initialGameState
    for (const round of [1, 2]) {
      save(create({ factorySettings: settings, initialGameState, gameState }), storage)
      const restored = load(storage)
      assert.deepEqual(restored.gameState, gameState)
      assert.deepEqual(restored.initialGameState, initialGameState)
      assert.deepEqual(
        buildCanonicalFinancialHistory(restored.gameState, restored.factorySettings),
        initialGameState.initialFinancialHistory,
      )
      const forecast = calculateRoundForecast(restored.gameState, {}, restored.factorySettings)
      const advanced = advanceRoundState({ gameState: restored.gameState, forecast, totalRounds: 12 })
      assert.equal(advanced.historyEntry.round, round)
      assert.equal(advanced.historyEntry.finance.equity,
        restored.gameState.finance.equity + forecast.forecast.finance.result)
      assert.equal(forecast.closingState.finance.totalAssets, forecast.closingState.finance.totalLiabilitiesAndEquity)
      gameState = advanced.nextGameState
      assert.deepEqual(gameState.initialFinancialHistory, initialGameState.initialFinancialHistory)
    }
  }
})

test('legacy sessions keep their original finance and financial baseline rather than silently rebasing a running game', () => {
  for (const mode of ['teacher-test', 'quest']) {
    const storage = createSessionStorage()
    const initialGameState = createInitialFactoryState(DEFAULT_FACTORY_SETTINGS)
    const create = mode === 'teacher-test' ? createTeacherTestGameSession : createQuestGameSession
    const save = mode === 'teacher-test' ? saveTeacherTestGameSession : saveQuestGameSession
    const load = mode === 'teacher-test' ? loadTeacherTestGameSession : loadQuestGameSession
    save(create({ factorySettings: DEFAULT_FACTORY_SETTINGS, initialGameState }), storage)
    const restored = load(storage)
    assert.deepEqual(restored.gameState.finance, initialGameState.finance)
    const baseline = buildCanonicalFinancialHistory(restored.gameState, restored.factorySettings)
    assert.equal(baseline.at(-1).finance.equity, 844583.0099609375)
    save(restored, storage)
    assert.deepEqual(load(storage).gameState.initialFinancialHistory, baseline)
  }
})

test('both modes restore all twelve confirmed rounds, completion and the final report route', () => {
  for (const mode of ['teacher-test', 'quest']) {
    const storage = createSessionStorage()
    const settings = structuredClone(DEFAULT_FACTORY_SETTINGS)
    settings.initialState.finance.equity = 100000000
    const initialGameState = createInitialGameState(settings)
    const create = mode === 'teacher-test' ? createTeacherTestGameSession : createQuestGameSession
    const save = mode === 'teacher-test' ? saveTeacherTestGameSession : saveQuestGameSession
    const load = mode === 'teacher-test' ? loadTeacherTestGameSession : loadQuestGameSession
    let gameState = initialGameState

    for (let round = 1; round <= 12; round++) {
      const forecast = calculateRoundForecast(gameState, {}, settings)
      const result = advanceRoundState({ gameState, forecast, totalRounds: 12 })
      assert.equal(result.isGameComplete, round === 12)
      gameState = result.nextGameState
    }

    save(create({ factorySettings: settings, initialGameState, gameState, pathname: '/game/report' }), storage)
    const restored = load(storage)
    assert.deepEqual(restored.gameState, gameState)
    assert.equal(restored.gameState.round, 12)
    assert.deepEqual(restored.gameState.history.map((entry) => entry.round),
      Array.from({ length: 12 }, (_, index) => index + 1))
    assert.equal(restored.pathname, '/game/report')
    assert.equal(restored.phase, 'REPORT')
    assert.equal(restored.mode, mode)
    assert.deepEqual(restored.gameState.completion, { reason: 'round-limit', confirmedRound: 12 })
  }
})

test('bankruptcy and legacy completed sessions restore as locked final reports in both modes', () => {
  for (const mode of ['teacher-test', 'quest']) {
    const storage = createSessionStorage()
    const settings = DEFAULT_FACTORY_SETTINGS
    const initialGameState = createInitialGameState(settings)
    const create = mode === 'teacher-test' ? createTeacherTestGameSession : createQuestGameSession
    const save = mode === 'teacher-test' ? saveTeacherTestGameSession : saveQuestGameSession
    const load = mode === 'teacher-test' ? loadTeacherTestGameSession : loadQuestGameSession
    for (const [round, equity, reason] of [[3, -100, 'bankruptcy'], [12, 100, 'round-limit']]) {
      const gameState = {
        ...initialGameState, round,
        history: [{ round, finance: { equity } }],
      }
      save(create({ factorySettings: settings, initialGameState, gameState, pathname: '/act' }), storage)
      const restored = load(storage)
      assert.equal(restored.pathname, '/game/report')
      assert.deepEqual(restored.gameState.completion, { reason, confirmedRound: round })
      assert.throws(() => advanceRoundState({
        gameState: restored.gameState, forecast: {}, totalRounds: 12,
      }), /completed game/)
    }
  }
})
