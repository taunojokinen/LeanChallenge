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
import { buildInitialIncomeHistory } from '../../entities/factory-settings/financialHistory.js'
import { buildIncomeHistoryView, buildIncomeStatementRows } from '../../entities/income/model.js'

let server
let cacheDir
let Panel
const factorySettings = DEFAULT_FACTORY_SETTINGS
const gameState = createInitialGameState(factorySettings)
const baselineHistory = buildInitialIncomeHistory(gameState, factorySettings)

before(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), 'income-page-test-'))
  server = await createServer({
    root: fileURLToPath(new URL('../../../', import.meta.url)),
    cacheDir,
    logLevel: 'warn',
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: 'custom',
  })
  Panel = (await server.ssrLoadModule('/src/pages/plan/PlanIncomePage.jsx')).IncomeStatementPanel
})

after(async () => {
  try {
    await server?.close()
  } finally {
    if (cacheDir) await rm(cacheDir, { recursive: true, force: true })
  }
})

function renderPanel(runtimeHistory = []) {
  const historyView = buildIncomeHistoryView({ baselineHistory, runtimeHistory })
  const rows = buildIncomeStatementRows(historyView)
  return {
    rows,
    html: renderToStaticMarkup(createElement(Panel, { historyView, rows })),
  }
}

function decodeText(text) {
  return text.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>')
}

test('income panel preserves all ten rows, six columns, amounts, percentages and change impacts', () => {
  const { html, rows } = renderPanel()
  const renderedRows = [...html.matchAll(/<div[^>]*role="row">([\s\S]*?)<\/div>/g)]
  assert.equal(renderedRows.length, 11)
  assert.deepEqual(
    [...renderedRows[0][1].matchAll(/role="columnheader">([^<]*)<\/span>/g)].map((match) => decodeText(match[1])),
    ['Erä', 'Kierros -1', '%', 'Kierros 0', '%', 'Muutos'],
  )
  for (const [index, row] of rows.entries()) {
    const rendered = renderedRows[index + 1][1]
    assert.deepEqual(
      [...rendered.matchAll(/role="cell">([^<]*)<\/span>/g)].map((match) => decodeText(match[1])),
      [row.label, row.previousAmountText, row.previousPercentageText,
        row.currentAmountText, row.currentPercentageText, row.deltaText],
    )
    assert.ok(rendered.includes(`plan-income-delta is-${row.impact}`))
    if (row.key === 'result' && row.currentAmount < 0) {
      assert.match(rendered, /plan-income-current-value is-negative-result/)
    }
  }
})

test('income panel follows later confirmed rounds and never hardcodes opening-round headers', () => {
  const runtimeHistory = baselineHistory.entries.slice(-2).map((entry, index) => ({ ...entry, round: index + 4 }))
  const { html } = renderPanel(runtimeHistory)
  assert.match(html, /Vertailu: kierros 4 \/ kierros 5/)
  assert.match(html, /role="columnheader">Kierros 4<\/span>/)
  assert.match(html, /role="columnheader">Kierros 5<\/span>/)
  assert.doesNotMatch(html, /Kierros -1|Kierros 0/)
})

test('income panel has one report heading and a keyboard-focusable scroll region without duplicate KPIs', () => {
  const { html } = renderPanel()
  assert.equal([...html.matchAll(/<h1>/g)].length, 1)
  assert.match(html, /<h1>Tuloslaskelma<\/h1>/)
  assert.match(html, /class="plan-income-table-scroll" role="region" aria-label="[^"]+" tabindex="0"/)
  assert.doesNotMatch(html, /Lean Challenge|Lean Cockpit|<button|<dialog|<meter/)
  assert.match(html, /plan-income-row\s+is-subtotal [^"]*" role="row"><span[^>]*>MYYNTIKATE/)
  assert.match(html, /plan-income-row\s+is-total [^"]*" role="row"><span[^>]*>TULOS/)
})
