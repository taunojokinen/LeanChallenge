import test, { before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setImmediate } from 'node:timers'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { DEFAULT_FACTORY_SETTINGS } from '../../../shared/factory-settings/defaultFactorySettings.js'
import { createInitialGameState } from '../../../shared/factory-settings/initialGameState.js'
import { calculateRoundForecast } from '../../../shared/forecast/model.js'
import { advanceRoundState } from '../../../shared/game-round/advanceRound.js'
import { buildReportSeries, formatReportValue, REPORT_METRICS } from '../entities/report/model.js'
import { GAME_DECISION_STORAGE_KEYS } from '../features/session/resetGameSession.js'
import {
  createQuestGameSession, saveQuestGameSession, loadQuestGameSession,
  createTeacherTestGameSession, saveTeacherTestGameSession, loadTeacherTestGameSession,
  createClassroomGameSession, saveClassroomGameSession, loadClassroomGameSession,
} from '../features/session/teacherTestGameSession.js'

const HOOKS = 'virtual:final-report-hooks'
const LOGIN_HOOKS = `${HOOKS}-login`
const originalWindow = globalThis.window
const originalSessionStorage = globalThis.sessionStorage
let server
let cacheDir
let hooks
let loginHooks
let App
let FinalReportPage
let ReportLineChart
let storage
let listeners

before(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), 'final-report-test-'))
  server = await createServer({
    root: fileURLToPath(new URL('../../', import.meta.url)),
    cacheDir,
    logLevel: 'warn',
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: 'custom',
    plugins: [{
      name: 'final-report-hooks',
      enforce: 'pre',
      transform(code, id) {
        const path = id.replaceAll('\\', '/')
        if (path.endsWith('/login/LoginPage.jsx')) {
          return code.replace("from 'react'", `from '${LOGIN_HOOKS}'`)
        }
        if (path.endsWith('/app/App.jsx') || path.endsWith('/game/FinalReportPage.jsx')) {
          return code.replace("from 'react'", `from '${HOOKS}'`)
        }
      },
      resolveId(id) {
        if (id === HOOKS || id === LOGIN_HOOKS) return `\0${id}`
      },
      load(id) {
        if (id !== `\0${HOOKS}` && id !== `\0${LOGIN_HOOKS}`) return
        return `
          let states = [], effects = [], dependencies = [], cursor = 0
          export function reset() { states = []; effects = []; dependencies = [] }
          export function render(Component, props) {
            cursor = 0
            effects = []
            return Component(props)
          }
          export function flushEffects() { effects.forEach(effect => effect()) }
          export function useState(initial) {
            const index = cursor++
            if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
            return [states[index], next => {
              states[index] = typeof next === 'function' ? next(states[index]) : next
            }]
          }
          export function useMemo(calculate) { cursor++; return calculate() }
          export function useRef(initial) { return useState(() => ({ current: initial }))[0] }
          export function useEffect(effect, deps) {
            const index = cursor++
            const previous = dependencies[index]
            if (!previous || deps.some((value, i) => !Object.is(value, previous[i]))) {
              dependencies[index] = deps
              effects.push(effect)
            }
          }
        `
      },
    }],
  })
  hooks = await server.ssrLoadModule(HOOKS)
  loginHooks = await server.ssrLoadModule(LOGIN_HOOKS)
  App = (await server.ssrLoadModule('/src/app/App.jsx')).default
  FinalReportPage = (await server.ssrLoadModule('/src/pages/game/FinalReportPage.jsx')).default
  ReportLineChart = (await server.ssrLoadModule('/src/pages/game/ReportLineChart.jsx')).default
})

function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

beforeEach(() => {
  hooks.reset()
  loginHooks.reset()
  storage = memoryStorage()
  listeners = new Map()
  globalThis.sessionStorage = storage
  globalThis.window = {
    location: { pathname: '/act' },
    localStorage: memoryStorage(),
    history: {
      pushState: (_, __, path) => { window.location.pathname = path },
      replaceState: (_, __, path) => { window.location.pathname = path },
    },
    addEventListener: (event, callback) => listeners.set(event, callback),
    removeEventListener: (event) => listeners.delete(event),
  }
})

after(async () => {
  try {
    await server?.close()
  } finally {
    if (cacheDir) await rm(cacheDir, { recursive: true, force: true })
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
    if (originalSessionStorage === undefined) delete globalThis.sessionStorage
    else globalThis.sessionStorage = originalSessionStorage
  }
})

function find(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap((child) => find(child, predicate))
  if (!tree?.props) return []
  return [...(predicate(tree) ? [tree] : []), ...find(tree.props.children, predicate)]
}

function createGame(mode, bankruptcy = false) {
  const settings = structuredClone(DEFAULT_FACTORY_SETTINGS)
  settings.initialState.finance.equity = bankruptcy ? 1 : 100000000
  const initialGameState = createInitialGameState(settings)
  let gameState = initialGameState
  if (!bankruptcy) {
    for (let round = 1; round < 12; round++) {
      const forecast = calculateRoundForecast(gameState, {}, settings)
      gameState = advanceRoundState({ gameState, forecast, totalRounds: 12 }).nextGameState
    }
  }
  const create = mode === 'quest' ? createQuestGameSession : createTeacherTestGameSession
  const save = mode === 'quest' ? saveQuestGameSession : saveTeacherTestGameSession
  save(create({ factorySettings: settings, initialGameState, gameState, pathname: '/act' }), storage)
  return { gameState, settings }
}

function renderApp() {
  const tree = hooks.render(App)
  hooks.flushEffects()
  return tree
}

test('ACT round twelve transitions to a locked final report and survives reload in both modes', () => {
  for (const mode of ['quest', 'teacher-test']) {
    hooks.reset()
    storage.removeItem('lean-challenge-quest-session-v1')
    storage.removeItem('lean-challenge-teacher-test-session-v1')
    window.location.pathname = '/act'
    const { gameState, settings } = createGame(mode)
    const act = find(renderApp(), (element) => element.type?.name === 'ActPage')[0]
    act.props.onAdvanceRound(calculateRoundForecast(gameState, {}, settings))
    const tree = renderApp()
    const report = find(tree, (element) => element.type?.name === 'FinalReportPage')[0]

    assert.ok(report)
    assert.equal(window.location.pathname, '/game/report')
    assert.equal(report.props.gameState.round, 12)
    assert.equal(report.props.gameState.history.length, 12)
    assert.equal(report.props.gameState.completion.reason, 'round-limit')
    const load = mode === 'quest' ? loadQuestGameSession : loadTeacherTestGameSession
    assert.deepEqual(load(storage).gameState, report.props.gameState)

    hooks.reset()
    assert.ok(find(renderApp(), (element) => element.type?.name === 'FinalReportPage').length)
    for (const path of ['/act', '/check', '/do/investments', '/plan/development']) {
      window.history.pushState({}, '', path)
      listeners.get('popstate')()
      const navigated = renderApp()
      assert.equal(window.location.pathname, '/game/report')
      assert.equal(find(navigated, (element) => element.type?.name === 'ActPage').length, 0)
      assert.ok(find(navigated, (element) => element.type?.name === 'FinalReportPage').length)
      assert.equal(load(storage).gameState.history.length, 12)
    }
  }
})

test('bankruptcy confirms only the played round and opens a persistent bankruptcy report', () => {
  const { gameState, settings } = createGame('quest', true)
  const forecast = calculateRoundForecast(gameState, {}, settings)
  assert.ok(forecast.closingState.canonical.finance.equity <= 0)
  const act = find(renderApp(), (element) => element.type?.name === 'ActPage')[0]
  act.props.onAdvanceRound(forecast)
  const report = find(renderApp(), (element) => element.type?.name === 'FinalReportPage')[0]

  assert.equal(report.props.gameState.round, 1)
  assert.equal(report.props.gameState.history.length, 1)
  assert.equal(report.props.gameState.completion.reason, 'bankruptcy')
  assert.equal(window.location.pathname, '/game/report')
  hooks.reset()
  assert.ok(find(renderApp(), (element) => element.type?.name === 'FinalReportPage').length)
  hooks.reset()
  const html = renderToStaticMarkup(hooks.render(FinalReportPage, report.props))
  assert.match(html, /Peli päättyi konkurssiin kierroksella 1/)
})

test('report renders four final KPIs and cycles financial charts in both directions', () => {
  const { gameState, settings } = createGame('quest')
  const forecast = calculateRoundForecast(gameState, {}, settings)
  const completed = advanceRoundState({ gameState, forecast, totalRounds: 12 }).nextGameState
  hooks.reset()
  const props = { gameState: completed, totalRounds: 12, onRestartGame: () => {} }
  const latest = buildReportSeries(completed.history, 12).at(-1)
  let tree = hooks.render(FinalReportPage, props)
  const html = renderToStaticMarkup(tree)
  const kpis = html.match(/<dl class="final-report__kpis"[^>]*>([\s\S]*?)<\/dl>/)[1]
  assert.equal([...kpis.matchAll(/<dd>/g)].length, 4)
  for (const metric of REPORT_METRICS) {
    assert.ok(kpis.includes(formatReportValue(latest[metric.key], metric.unit)))
  }
  for (const expected of ['revenue', 'result', 'equity', 'revenue']) {
    const charts = find(tree, (element) => element.type?.name === 'ReportLineChart')
    assert.equal(charts[0].props.metric.key, 'knl')
    assert.equal(charts[1].props.metric.key, expected)
    const next = find(tree, (element) => element.props['aria-label'] === 'Seuraava talouden tunnusluku')[0]
    next.props.onClick()
    tree = hooks.render(FinalReportPage, props)
  }
  const previous = find(tree, (element) => element.props['aria-label'] === 'Edellinen talouden tunnusluku')[0]
  previous.props.onClick()
  tree = hooks.render(FinalReportPage, props)
  assert.equal(find(tree, (element) => element.type?.name === 'ReportLineChart')[1].props.metric.key, 'revenue')
  find(tree, (element) => element.props['aria-label'] === 'Edellinen talouden tunnusluku')[0].props.onClick()
  tree = hooks.render(FinalReportPage, props)
  assert.equal(find(tree, (element) => element.type?.name === 'ReportLineChart')[1].props.metric.key, 'equity')
})

test('report route is unavailable before completion and restarting preserves the game mode and settings', () => {
  window.location.pathname = '/game/report'
  assert.ok(find(renderApp(), (element) => element.type?.name === 'PlanCockpitPage').length)
  assert.equal(window.location.pathname, '/plan/cockpit')

  for (const mode of ['quest', 'teacher-test']) {
    hooks.reset()
    storage.removeItem('lean-challenge-quest-session-v1')
    storage.removeItem('lean-challenge-teacher-test-session-v1')
    window.location.pathname = '/act'
    const { gameState, settings } = createGame(mode)
    find(renderApp(), (element) => element.type?.name === 'ActPage')[0].props
      .onAdvanceRound(calculateRoundForecast(gameState, {}, settings))
    const report = find(renderApp(), (element) => element.type?.name === 'FinalReportPage')[0]
    report.props.onRestartGame()
    assert.ok(find(renderApp(), (element) => element.type?.name === 'PlanCockpitPage').length)
    const load = mode === 'quest' ? loadQuestGameSession : loadTeacherTestGameSession
    const restarted = load(storage)
    assert.equal(restarted.mode, mode)
    assert.deepEqual(restarted.factorySettings, settings)
    assert.equal(restarted.gameState.round, 1)
    assert.equal(restarted.gameState.completion, undefined)
    assert.equal((restarted.gameState.history ?? []).length, 0)
    assert.equal(window.location.pathname, '/plan/cockpit')
  }
})

test('classroom refresh verifies the saved session and restart clears its ID', async () => {
  const originalFetch = globalThis.fetch
  const requests = []
  globalThis.fetch = async (url) => {
    requests.push(url)
    if (url === '/api/games/sessions/42') {
      return { ok: true, json: async () => ({ sessionId: '42' }) }
    }
    return { ok: false, status: 401 }
  }
  try {
    const factorySettings = structuredClone(DEFAULT_FACTORY_SETTINGS)
    const initialGameState = createInitialGameState(factorySettings)
    const forecast = calculateRoundForecast(initialGameState, {}, factorySettings)
    const { nextGameState: gameState } = advanceRoundState({
      gameState: initialGameState, forecast, totalRounds: factorySettings.game.totalRounds,
    })
    saveClassroomGameSession(createClassroomGameSession({
      factorySettings, initialGameState, gameState, classroomSessionId: '42', pathname: '/act',
    }), storage)
    const draftKey = GAME_DECISION_STORAGE_KEYS.at(-1)
    window.localStorage.setItem(draftKey, JSON.stringify({ round: 2, price: 25000 }))
    assert.ok(find(renderApp(), (element) => element.props.role === 'status').length)
    await new Promise((resolve) => setImmediate(resolve))
    let tree = renderApp()
    const layout = find(tree, (element) => element.type?.name === 'GameLayout')[0]
    assert.ok(layout)
    assert.equal(layout.props.round, 2)
    assert.deepEqual(loadClassroomGameSession(storage).gameState, gameState)
    assert.ok(window.localStorage.getItem(draftKey))
    assert.equal(loadClassroomGameSession(storage).classroomSessionId, '42')
    assert.equal(requests.filter((url) => url === '/api/games/sessions/42').length, 1)
    assert.equal(requests.some((url) => url.includes('/join/')), false)
    assert.equal(requests.includes('/api/games/sessions/current'), false)

    layout.props.onRestartGame()
    tree = renderApp()
    assert.ok(find(tree, (element) => element.type?.name === 'LoginPage').length)
    assert.equal(loadClassroomGameSession(storage), null)
    assert.equal(loadQuestGameSession(storage).classroomSessionId, null)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('invalid classroom authorization blocks the game and preserves the local session for retry', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({ ok: false, status: 401 })
  try {
    const factorySettings = structuredClone(DEFAULT_FACTORY_SETTINGS)
    const initialGameState = createInitialGameState(factorySettings)
    saveClassroomGameSession(createClassroomGameSession({
      factorySettings, initialGameState, classroomSessionId: '42', pathname: '/act',
    }), storage)
    renderApp()
    await new Promise((resolve) => setImmediate(resolve))
    const tree = renderApp()
    assert.ok(find(tree, (element) => element.props.role === 'alert').length)
    assert.equal(find(tree, (element) => element.type?.name === 'ActPage').length, 0)
    assert.equal(loadClassroomGameSession(storage).classroomSessionId, '42')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('classroom join preserves local progress until a validated state arrives and retries only GET', async (t) => {
  const factorySettings = structuredClone(DEFAULT_FACTORY_SETTINGS)
  factorySettings.costs.annualFixedCosts = 1600000
  const initialGameState = createInitialGameState(factorySettings, { historySeed: 0 })
  const currentGameState = structuredClone(initialGameState)
  currentGameState.market.price = 26000
  const serverState = {
    sessionId: '43', schemaVersion: 1, playerName: 'Palvelimen pelaaja',
    factorySettings, initialGameState, currentGameState,
  }
  const oldGameState = advanceRoundState({
    gameState: initialGameState,
    forecast: calculateRoundForecast(initialGameState, {}, factorySettings),
    totalRounds: factorySettings.game.totalRounds,
  }).nextGameState
  saveClassroomGameSession(createClassroomGameSession({
    factorySettings, initialGameState, gameState: oldGameState, classroomSessionId: '42', pathname: '/act',
  }), storage)
  const draftKey = GAME_DECISION_STORAGE_KEYS.at(-1)
  const draft = JSON.stringify({ round: 2, price: 27000 })
  window.localStorage.setItem(draftKey, draft)
  window.location.pathname = '/login'

  const requests = []
  let stateResponse = { ok: false, status: 503 }
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === '/api/games/join/KOODI') {
      requests.push(options.method)
      return { ok: true, json: async () => ({ sessionId: '43', setup: {} }) }
    }
    if (url === '/api/games/sessions/current') {
      requests.push(options.method ?? 'GET')
      return stateResponse
    }
    if (url === '/api/games/sessions/42') {
      return { ok: true, json: async () => ({ sessionId: '42' }) }
    }
    return { ok: false, status: 401 }
  })

  const login = find(renderApp(), (element) => element.type?.name === 'LoginPage')[0]
  const randomSeed = t.mock.method(globalThis.crypto, 'getRandomValues')
  const renderLogin = () => {
    const tree = loginHooks.render(login.type, login.props)
    loginHooks.flushEffects()
    return tree
  }
  const submit = () => find(renderLogin(), (element) => element.type === 'form')[0]
    .props.onSubmit({ preventDefault() {} })
  find(renderLogin(), (element) => element.type === 'button' && element.props.className === 'login-option-card')[1]
    .props.onClick()
  for (const [id, value] of [['join-game-code', 'KOODI'], ['join-player-name', 'Pelaaja']]) {
    find(renderLogin(), (element) => element.props.id === id)[0].props.onChange({ target: { value } })
  }

  await submit()
  assert.deepEqual(requests, ['POST', 'GET'])
  assert.ok(find(renderLogin(), (element) => element.props.children === 'Yritä tilahakua uudelleen').length)
  assert.deepEqual(loadClassroomGameSession(storage).gameState, oldGameState)
  assert.equal(window.localStorage.getItem(draftKey), draft)

  for (const [state, message] of [
    [{ ...serverState, sessionId: '44' }, /tunniste ei vastaa/],
    [{ ...serverState, schemaVersion: 2 }, /versiota ei tueta/],
    [{ ...serverState, factorySettings: {} }, /rakenne ei kelpaa/],
    [{ ...serverState, initialGameState: {} }, /rakenne ei kelpaa/],
    [{ ...serverState, currentGameState: { ...currentGameState, historySeed: 1 } }, /rakenne ei kelpaa/],
  ]) {
    stateResponse = { ok: true, json: async () => state }
    await submit()
    const alert = find(renderLogin(), (element) => element.props.role === 'alert')[0]
    assert.match(alert.props.children, message)
    assert.deepEqual(loadClassroomGameSession(storage).gameState, oldGameState)
    assert.equal(window.localStorage.getItem(draftKey), draft)
  }

  stateResponse = { ok: true, json: async () => serverState }
  await submit()
  const tree = renderApp()
  assert.ok(find(tree, (element) => element.type?.name === 'GameLayout').length)
  assert.deepEqual(requests, ['POST', ...Array(7).fill('GET')])
  const saved = loadClassroomGameSession(storage)
  assert.equal(saved.classroomSessionId, '43')
  assert.equal(saved.playerName, serverState.playerName)
  assert.deepEqual(saved.factorySettings, factorySettings)
  assert.deepEqual(saved.initialGameState, initialGameState)
  assert.deepEqual(saved.gameState, currentGameState)
  assert.equal(saved.gameState.historySeed, 0)
  assert.equal(randomSeed.mock.callCount(), 0)
  assert.equal(window.localStorage.getItem(draftKey), null)
})

test('SVG preserves missing-value gaps and places negative and positive results on opposite sides of zero', () => {
  const tree = ReportLineChart({
    series: [{ round: 1, result: -100 }, { round: 2, result: null }, { round: 3, result: 100 }],
    metric: REPORT_METRICS[2],
    totalRounds: 12,
  })
  const zero = find(tree, (element) => element.props.className === 'report-chart__zero')[0]
  const points = find(tree, (element) => element.type === 'circle')
  const path = find(tree, (element) => element.type === 'path')[0]
  assert.equal(points.length, 2)
  assert.ok(points[0].props.cy > zero.props.y1)
  assert.ok(points[1].props.cy < zero.props.y1)
  assert.equal((path.props.d.match(/M/g) ?? []).length, 2)
  assert.ok(!path.props.d.includes('L'))
})
