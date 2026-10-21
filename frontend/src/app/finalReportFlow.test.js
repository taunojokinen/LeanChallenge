import test, { before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { DEFAULT_FACTORY_SETTINGS } from '../entities/factory-settings/defaultFactorySettings.js'
import { createInitialGameState } from '../entities/factory-settings/initialGameState.js'
import { calculateRoundForecast } from '../entities/forecast/model.js'
import { advanceRoundState } from '../entities/game-round/advanceRound.js'
import { buildReportSeries, formatReportValue, REPORT_METRICS } from '../entities/report/model.js'
import {
  createQuestGameSession, saveQuestGameSession, loadQuestGameSession,
  createTeacherTestGameSession, saveTeacherTestGameSession, loadTeacherTestGameSession,
} from '../features/session/teacherTestGameSession.js'

const HOOKS = 'virtual:final-report-hooks'
const originalWindow = globalThis.window
const originalSessionStorage = globalThis.sessionStorage
let server
let cacheDir
let hooks
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
        if (path.endsWith('/app/App.jsx') || path.endsWith('/game/FinalReportPage.jsx')) {
          return code.replace("from 'react'", `from '${HOOKS}'`)
        }
      },
      resolveId(id) {
        if (id === HOOKS) return `\0${HOOKS}`
      },
      load(id) {
        if (id !== `\0${HOOKS}`) return
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
