import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { APP_NAME, APP_TAGLINE, COCKPIT_NAME } from '../../config/appConfig.js'

let server
let cacheDir

before(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), 'game-intro-test-'))
  server = await createServer({
    root: fileURLToPath(new URL('../../../', import.meta.url)),
    cacheDir,
    logLevel: 'warn',
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: 'custom',
  })
})

after(async () => {
  try {
    await server?.close()
  } finally {
    if (cacheDir) await rm(cacheDir, { recursive: true, force: true })
  }
})

async function render(modulePath, props = {}) {
  const { default: Component } = await server.ssrLoadModule(modulePath)
  return renderToStaticMarkup(createElement(Component, props))
}

test('intro contains the approved objectives, accessible name and a single start action', async () => {
  const html = await render('/src/features/game-intro/GameIntroDialog.jsx', { onClose() {} })
  assert.match(html, /<dialog[^>]*aria-labelledby="game-intro-title"/)
  assert.match(html, /aria-describedby="game-intro-description"/)
  assert.ok(html.includes(`>${APP_NAME.toUpperCase()}</h2>`))
  assert.match(html, /Onneksi olkoon! Olet juuri aloittanut uuden työsi tuotantopäällikkönä\./)
  assert.match(html, /<strong>koneistus, kokoonpano ja lähettämö<\/strong>/)
  assert.match(html, /<strong>KNL-mittareissa<\/strong>/)
  assert.match(html, /Heikko suorituskyky rasittaa yrityksen taloutta, ja tilanne uhkaa kriisiytyä\./)
  assert.match(html, /<strong>12 kierrosta aikaa<\/strong>/)
  assert.match(html, /<strong>Onnea uuteen tehtävääsi!<\/strong>/)
  assert.match(html, /type="checkbox"/)
  assert.match(html, /Älä näytä enää/)
  assert.equal([...html.matchAll(/<button/g)].length, 1)
  assert.match(html, />Aloita peli<\/button>/)
})

test('landing, login, teacher settings and game header share the application name', async () => {
  const modules = [
    ['/src/pages/landing/LandingPage.jsx', { onLogin() {} }],
    ['/src/pages/login/LoginPage.jsx', {}],
    ['/src/pages/teacher/TeacherSettingsPage.jsx', {}],
    ['/src/widgets/game-header/GameHeader.jsx', { kpis: [], round: 1, totalRounds: 12 }],
  ]
  for (const [path, props] of modules) {
    const html = await render(path, props)
    assert.ok(html.includes(APP_NAME) || html.includes(APP_NAME.toUpperCase()), path)
    assert.ok(!html.includes('LEAN COCKPIT'), path)
    if (path.includes('LandingPage') || path.includes('LoginPage')) {
      assert.ok(html.includes(APP_TAGLINE), path)
    }
  }
})

test('Cockpit retains its management name and the navigation label remains Cockpit', async () => {
  const html = await render('/src/pages/plan/PlanCockpitPage.jsx')
  assert.ok(html.includes(`Ladataan ${COCKPIT_NAME} -näkymää...`))
  assert.doesNotMatch(html, /<h1/)
  const sidebar = await render('/src/widgets/game-sidebar/GameSidebar.jsx', { pageKey: 'plan-cockpit' })
  assert.match(sidebar, />Cockpit<\/button>/)
})
