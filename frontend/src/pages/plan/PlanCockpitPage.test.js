import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { DEFAULT_FACTORY_SETTINGS } from '../../entities/factory-settings/defaultFactorySettings.js'
import { createInitialGameState } from '../../entities/factory-settings/initialGameState.js'
import { buildConfirmedCockpitViewModel, formatChange, formatPercent } from './cockpitModel.js'

let server
let cacheDir
let Page
let Dialog
let Gauges
const factorySettings = DEFAULT_FACTORY_SETTINGS
const gameState = createInitialGameState(factorySettings)
const cockpit = buildConfirmedCockpitViewModel(gameState, factorySettings)
const departments = cockpit.departments.map((department) => ({
  ...department,
  name: department.key === 'assembly' ? 'Kokoonpano' : department.name,
  previousRound: cockpit.previousConfirmedRound,
  currentRound: cockpit.confirmedRound,
}))

before(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), 'cockpit-page-test-'))
  server = await createServer({
    root: fileURLToPath(new URL('../../../', import.meta.url)),
    cacheDir,
    logLevel: 'warn',
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: 'custom',
  })
  Page = (await server.ssrLoadModule('/src/pages/plan/PlanCockpitPage.jsx')).default
  Dialog = (await server.ssrLoadModule('/src/pages/plan/CockpitDepartmentDialog.jsx')).default
  Gauges = (await server.ssrLoadModule('/src/widgets/gauges-panel/GaugesPanel.jsx')).default
})

after(async () => {
  try {
    await server?.close()
  } finally {
    if (cacheDir) await rm(cacheDir, { recursive: true, force: true })
  }
})

test('Cockpit preserves the existing gauge markup and confirmed values without repeating the game header', () => {
  const html = renderToStaticMarkup(createElement(Page, { gameState, factorySettings }))
  const gauges = renderToStaticMarkup(createElement(Gauges, { gauges: cockpit.gauges }))
  assert.ok(html.includes(gauges))
  assert.match(html, />Tehtaan kokonaismittarit<\/h2>/)
  assert.match(html, />Osastojen KNL<\/h2>/)
  assert.match(html, />Pelin tavoitteet<\/button>/)
  assert.match(html, />Näytä osastojen tarkemmat tiedot<\/button>/)
  assert.doesNotMatch(html, /<table|<dialog|<h1|Lean Cockpit|Lean Challenge|Kierros/)
})

test('department meters use exactly the same KNL values as the existing table view model', () => {
  const html = renderToStaticMarkup(createElement(Page, { gameState, factorySettings }))
  const meters = [...html.matchAll(/<meter[^>]*value="([^"]+)"[^>]*>([^<]+)<\/meter>/g)]
  assert.equal(meters.length, 3)
  for (const [index, department] of departments.entries()) {
    assert.equal(Number(meters[index][1]), department.metrics.KNL.current)
    assert.equal(meters[index][2], formatPercent(department.metrics.KNL.current))
    assert.ok(html.includes(`>${department.name}</h3>`))
    assert.ok(html.includes(`<strong>${formatPercent(department.metrics.KNL.current)}</strong>`))
  }
})

test('one detail dialog retains every original metric, history column and signed change', () => {
  const html = renderToStaticMarkup(createElement(Dialog, { departments, onClose() {} }))
  assert.match(html, /aria-labelledby="cockpit-details-title"/)
  assert.match(html, />Osastojen tarkemmat tiedot<\/h2>/)
  assert.match(html, />Sulje<\/button>/)
  assert.equal([...html.matchAll(/<table>/g)].length, 3)
  const tables = [...html.matchAll(/<table>([\s\S]*?)<\/table>/g)]
  for (const [index, department] of departments.entries()) {
    const table = tables[index][1]
    assert.ok(table.includes(`Kierros ${department.previousRound}`))
    assert.ok(table.includes(`Kierros ${department.currentRound}`))
    for (const metric of Object.values(department.metrics)) {
      const changeClass = metric.change > 0 ? 'is-positive' : metric.change < 0 ? 'is-negative' : 'is-neutral'
      assert.ok(table.includes(
        `<th scope="row">${metric.label}</th><td>${formatPercent(metric.previous)}</td><td>${formatPercent(metric.current)}</td><td class="comparison-change ${changeClass}">${formatChange(metric.change)}</td>`,
      ))
    }
  }
  assert.match(tables[0][1], /K - vaihdot/)
  assert.equal([...html.matchAll(/<th scope="row">KNL<\/th>/g)].length, 3)
  assert.doesNotMatch(html, /Lean Challenge|Lean Cockpit/)
})

test('detail columns continue following confirmed rounds rather than hardcoding the opening rounds', () => {
  const html = renderToStaticMarkup(createElement(Dialog, {
    departments: departments.map((department) => ({ ...department, previousRound: 4, currentRound: 5 })),
    onClose() {},
  }))
  assert.equal([...html.matchAll(/Kierros 4<\/th>/g)].length, 3)
  assert.equal([...html.matchAll(/Kierros 5<\/th>/g)].length, 3)
  assert.doesNotMatch(html, /Kierros -1|Kierros 0/)
})
