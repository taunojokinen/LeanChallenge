import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

let server
let cacheDir
let DevelopmentHelpDialog

before(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), 'development-help-test-'))
  server = await createServer({
    root: fileURLToPath(new URL('../../../', import.meta.url)),
    cacheDir,
    logLevel: 'warn',
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: 'custom',
  })
  ;({ DevelopmentHelpDialog } = await server.ssrLoadModule('/src/features/development/DevelopmentHelp.jsx'))
})

after(async () => {
  try {
    await server?.close()
  } finally {
    if (cacheDir) await rm(cacheDir, { recursive: true, force: true })
  }
})

test('help popup explains development decisions and exposes accessible close controls', () => {
  const html = renderToStaticMarkup(createElement(DevelopmentHelpDialog, {
    hidden: false,
    errorMessage: '',
    onClose() {},
    onPreferenceChange() {},
  }))

  assert.match(html, /<dialog[^>]*aria-labelledby="development-help-title"/)
  assert.match(html, /aria-describedby="development-help-description"/)
  assert.match(html, /<h2[^>]*>Kehitystyö<\/h2>/)
  assert.match(html, /Kohdenna kehitystunteja tuotannon parantamiseen/)
  assert.match(html, /ohut palkki näyttää ennustetun kehitystason/)
  assert.match(html, /Vaikutukset toteutuvat kierroksen vahvistuksessa/)
  assert.match(html, /<h3>Kehitysmenetelmät<\/h3>/)
  for (const method of ['5S', 'SMED', 'TPM', 'SPC', 'Menetelmäkehitys', 'Poka-Yoke']) {
    assert.ok(html.includes(`<strong>${method}:</strong>`), method)
  }
  assert.match(html, /aria-label="Sulje ohje"/)
  assert.match(html, /Älä näytä enää/)
  assert.match(html, />Selvä<\/button>/)
})

test('shows a storage failure explicitly in the popup', () => {
  const html = renderToStaticMarkup(createElement(DevelopmentHelpDialog, {
    hidden: false,
    errorMessage: 'Ohjeasetuksen lukeminen epäonnistui.',
    onClose() {},
    onPreferenceChange() {},
  }))
  assert.match(html, /role="alert">Ohjeasetuksen lukeminen epäonnistui\./)
})
