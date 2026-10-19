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
import { buildInitialBalanceSheetHistory } from '../../entities/factory-settings/financialHistory.js'
import { buildBalanceSheetHistoryView, buildBalanceSheetViewModel } from '../../entities/balance-sheet/model.js'
import { buildBalanceInterpretation } from '../../entities/balance-sheet/interpretation.js'

let server
let cacheDir
let Panel
const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
const baselineHistory = buildInitialBalanceSheetHistory(gameState, DEFAULT_FACTORY_SETTINGS)

before(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), 'balance-page-test-'))
  server = await createServer({
    root: fileURLToPath(new URL('../../../', import.meta.url)),
    cacheDir,
    logLevel: 'warn',
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: 'custom',
  })
  Panel = (await server.ssrLoadModule('/src/pages/plan/PlanBalanceSheetPage.jsx')).BalanceSheetPanel
})

after(async () => {
  try {
    await server?.close()
  } finally {
    if (cacheDir) await rm(cacheDir, { recursive: true, force: true })
  }
})

function renderPanel(runtimeHistory = []) {
  const historyView = buildBalanceSheetHistoryView({ baselineHistory, runtimeHistory })
  const viewModel = buildBalanceSheetViewModel(historyView, 1.5)
  viewModel.interpretation = buildBalanceInterpretation({ balanceSheet: viewModel, confirmedEntry: historyView.confirmedEntry })
  return { viewModel, html: renderToStaticMarkup(createElement(Panel, { viewModel })) }
}

test('balance panel retains both tables, all twelve rows, three columns and original values in order', () => {
  const { html, viewModel } = renderPanel()
  const tables = [...html.matchAll(/role="table" aria-label="([^"]+)">([\s\S]*?)<\/div><\/div><\/section>/g)]
  assert.deepEqual(tables.map((match) => match[1]), ['Vastaavaa', 'Vastattavaa'])
  for (const [index, expectedRows] of [viewModel.assetsRows, viewModel.liabilitiesRows].entries()) {
    const table = tables[index][2]
    const rows = [...table.matchAll(/role="row">([\s\S]*?)<\/div>/g)]
    assert.equal(rows.length, expectedRows.length + 1)
    assert.deepEqual(
      [...rows[0][1].matchAll(/role="columnheader">([^<]+)<\/span>/g)].map((match) => match[1]),
      ['Erä', 'Kierros -1', 'Kierros 0'],
    )
    for (const [rowIndex, row] of expectedRows.entries()) {
      assert.deepEqual(
        [...rows[rowIndex + 1][1].matchAll(/role="cell">([^<]+)<\/span>/g)].map((match) => match[1]),
        [row.label, row.previousValue, row.currentValue],
      )
      if (row.kind) {
        assert.ok(table.includes(`is-${row.kind}`))
      }
    }
  }
  assert.equal(viewModel.assetsRows.length + viewModel.liabilitiesRows.length, 12)
})

test('balance panel preserves existing Lean summary and does not duplicate the game header', () => {
  const { html, viewModel } = renderPanel()
  for (const [label, value] of [
    ['Varaston arvo:', viewModel.summary.inventoryValue],
    ['Varaston kiertonopeus:', viewModel.interpretation.inventory.value],
    ['Omavaraisuusaste:', viewModel.summary.solvencyRatio],
  ]) {
    assert.ok(html.includes(`<strong>${label}</strong> ${value}`))
  }
  assert.match(html, /<h1>Tase<\/h1>/)
  assert.doesNotMatch(html, /Lean Challenge|Lean Cockpit|<button|<dialog|<meter/)
  assert.equal([...html.matchAll(/tabindex="0"/g)].length, 2)
})

test('balance panel uses later confirmed round headings in both tables', () => {
  const runtimeHistory = baselineHistory.entries.slice(-2).map((entry, index) => ({ ...entry, round: index + 4 }))
  const { html } = renderPanel(runtimeHistory)
  assert.match(html, /Vertailu: kierros 4 \/ kierros 5/)
  for (const round of [4, 5]) {
    assert.equal([...html.matchAll(new RegExp(`role="columnheader">Kierros ${round}<`, 'g'))].length, 2)
  }
  assert.doesNotMatch(html, /Kierros -1|Kierros 0/)
  assert.doesNotMatch(html, /Vahvistettu kierros/)
})

test('balance interpretation renders three stacked cards with textual statuses, annual units and a neutral borrowing figure', () => {
  const { html, viewModel } = renderPanel()
  assert.match(html, /<aside class="balance-interpretation" aria-labelledby="balance-interpretation-title">/)
  assert.match(html, /<h2 id="balance-interpretation-title">Taseen tulkinta<\/h2>/)
  const cards = [...html.matchAll(/<article class="balance-interpretation-card is-([^"]+)">([\s\S]*?)<\/article>/g)]
  assert.equal(cards.length, 3)
  assert.deepEqual(cards.map((card) => card[1]), [
    viewModel.interpretation.capital.status,
    viewModel.interpretation.solvency.status,
    viewModel.interpretation.inventory.status,
  ])
  for (const [index, title] of ['Oman pääoman riittävyys', 'Omavaraisuusaste ja lainanottovara', 'Varaston tehokkuus'].entries()) {
    assert.ok(cards[index][2].includes(`<h3>${title}</h3>`))
    assert.match(cards[index][2], /balance-interpretation-status">(?:Kriittinen|Tyydyttävä|Heikko)</)
  }
  assert.doesNotMatch(html, /Vahvistettu kierros|3 vuoden päästä|Suuntaa antava arvio|oletetaan jatkuvan|Kiertonopeus on muunnettu|Pääoma sisältää myös|<small/)
  assert.match(cards[0][2], /0,6 vuotta/)
  assert.match(cards[1][2], /balance-interpretation-status">Tyydyttävä</)
  assert.match(cards[1][2], /class="balance-interpretation-neutral">Lainanottovara:/)
  assert.equal(cards[2][1], 'danger')
  assert.match(cards[2][2], /balance-interpretation-status">Heikko</)
  assert.match(cards[2][2], /6,0 kertaa vuodessa/)
  assert.equal([...html.matchAll(/6,0 kertaa vuodessa/g)].length, 2)
  assert.doesNotMatch(html, /1,5x/)
  assert.match(cards[2][2], /Varastoon sitoutunut pääoma:/)
  assert.doesNotMatch(html, /konetta|koneiden ost|rahoituskapasiteetti/i)
})

test('summary and inventory card stay in sync as confirmed turnover and its classification change', () => {
  const runtimeHistory = []
  for (const [round, deliveries, expectedValue, status, text] of [
    [1, 200, '8,0 kertaa vuodessa', 'warning', 'kohtalainen'],
    [2, 400, '16,0 kertaa vuodessa', 'warning', 'kohtalainen'],
    [3, 500, '20,0 kertaa vuodessa', 'success', 'tehokkaasti'],
  ]) {
    const entry = structuredClone(baselineHistory.entries.at(-1))
    entry.round = round
    entry.production.deliveries = deliveries
    runtimeHistory.push(entry)
    const { html, viewModel } = renderPanel(runtimeHistory)
    assert.equal(viewModel.interpretation.inventory.value, expectedValue)
    assert.equal(viewModel.interpretation.inventory.status, status)
    assert.ok(html.includes(`<strong>Varaston kiertonopeus:</strong> ${expectedValue}`))
    assert.ok(html.includes(`<p class="balance-interpretation-value">${expectedValue}</p>`))
    assert.ok(html.includes(`Varasto kiertää ${text}`) || html.includes(`Varaston kierto on ${text}`))
    assert.doesNotMatch(html, /Vahvistettu kierros/)
  }
})
