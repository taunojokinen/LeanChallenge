import test, { before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { createInitialGameState } from '../../entities/factory-settings/initialGameState.js'
import { saveDevelopmentDecision } from '../../features/development/decisionAdapter.js'
import { normalizeDevelopmentHours } from '../../entities/development/model.js'

let server
let cacheDir
let DevelopmentPage
const originalWindow = globalThis.window

before(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), 'development-page-test-'))
  server = await createServer({
    root: fileURLToPath(new URL('../../../', import.meta.url)),
    cacheDir,
    logLevel: 'warn',
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: 'custom',
  })
  DevelopmentPage = (await server.ssrLoadModule('/src/pages/do/DevelopmentPage.jsx')).default
})

beforeEach(() => {
  const values = new Map()
  globalThis.window = { localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  } }
})

after(async () => {
  try {
    await server?.close()
  } finally {
    if (cacheDir) await rm(cacheDir, { recursive: true, force: true })
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  }
})

test('renders three departments, twelve sliders, summary and save action without storage writes', () => {
  window.localStorage.setItem = () => assert.fail('Rendering must not save decisions')
  const html = renderToStaticMarkup(createElement(DevelopmentPage, { gameState: createInitialGameState() }))
  assert.equal((html.match(/type="range"/g) ?? []).length, 12)
  assert.equal((html.match(/role="progressbar"/g) ?? []).length, 13)
  for (const label of ['Koneistus', 'Koonta', 'Lähettämö', 'Kehityskapasiteetti', 'Kohdennettu', 'Vapaana']) {
    assert.ok(html.includes(label))
  }
  assert.match(html, /400 h/)
  assert.match(html, /Tallenna ja jatka/)
})

test('loads both stored decisions, displays cumulative forecast and dynamic own-inclusive maxima', () => {
  saveDevelopmentDecision({ round: 1, hours: normalizeDevelopmentHours({
    'machining:five-s': 100, 'assembly:method-development': 200,
  }) })
  const state = createInitialGameState()
  state.lean.methods.assembly['method-development'] = 200
  const html = renderToStaticMarkup(createElement(DevelopmentPage, { gameState: state }))
  assert.match(html, /300 h/)
  assert.match(html, /min="0" max="200" step="10"/)
  assert.match(html, /min="0" max="300" step="10"/)
  assert.match(html, /aria-valuetext="50%"/)
  const nextRound = renderToStaticMarkup(createElement(DevelopmentPage, { gameState: { ...state, round: 2 } }))
  assert.match(nextRound, /0 \/ 400 h/)
})