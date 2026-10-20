import test, { before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { createInitialGameState } from '../../entities/factory-settings/initialGameState.js'
import { DEFAULT_FACTORY_SETTINGS } from '../../entities/factory-settings/defaultFactorySettings.js'
import investmentsSnapshot from '../../mocks/investmentsSnapshot.json' with { type: 'json' }
import { buildInvestmentsViewModel } from '../../entities/investments/model.js'

const STORAGE_KEY = 'lean-challenge-investments-decision'
const HOOKS_MODULE = 'virtual:investments-page-test-hooks'
const originalWindow = globalThis.window
let server
let cacheDir
let InvestmentsPage
let hooks

before(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), 'investments-page-test-'))
  server = await createServer({
    root: fileURLToPath(new URL('../../../', import.meta.url)),
    cacheDir,
    logLevel: 'warn',
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: 'custom',
    plugins: [{
      name: 'investments-page-test-hooks',
      enforce: 'pre',
      transform(code, id) {
        if (id.replaceAll('\\', '/').endsWith('/pages/do/InvestmentsPage.jsx')) {
          return code.replace("from 'react'", `from '${HOOKS_MODULE}'`)
        }
      },
      resolveId(id) {
        if (id === HOOKS_MODULE) return `\0${HOOKS_MODULE}`
      },
      load(id) {
        if (id !== `\0${HOOKS_MODULE}`) return
        return `
          let states = []
          let effects = []
          let pending = []
          let cursor = 0
          export function reset() {
            effects.forEach((effect) => effect?.cleanup?.())
            states = []
            effects = []
            pending = []
          }
          export function render(Component, props) {
            cursor = 0
            return Component(props)
          }
          export function useState(initial) {
            const index = cursor++
            if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
            return [states[index], (next) => {
              states[index] = typeof next === 'function' ? next(states[index]) : next
            }]
          }
          export function useMemo(calculate) { return calculate() }
          export function useEffect(callback, dependencies) {
            const index = cursor++
            const previous = effects[index]
            if (previous && dependencies.every((value, offset) => Object.is(value, previous.dependencies[offset]))) return
            pending.push(() => {
              previous?.cleanup?.()
              effects[index] = { dependencies, cleanup: callback() }
            })
          }
          export async function flushEffects() {
            pending.splice(0).forEach((effect) => effect())
            await new Promise((resolve) => setImmediate(resolve))
          }
        `
      },
    }],
  })
  hooks = await server.ssrLoadModule(HOOKS_MODULE)
  InvestmentsPage = (await server.ssrLoadModule('/src/pages/do/InvestmentsPage.jsx')).default
})

beforeEach(() => {
  hooks.reset()
  const values = new Map()
  globalThis.window = { localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  } }
})

after(async () => {
  hooks?.reset()
  try {
    await server?.close()
  } finally {
    if (cacheDir) await rm(cacheDir, { recursive: true, force: true })
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
  }
})

function pageProps(overrides = {}) {
  return {
    round: 1,
    gameState: createInitialGameState(DEFAULT_FACTORY_SETTINGS),
    factorySettings: DEFAULT_FACTORY_SETTINGS,
    ...overrides,
  }
}

async function loadPage(props) {
  hooks.render(InvestmentsPage, props)
  await hooks.flushEffects()
  return hooks.render(InvestmentsPage, props)
}

function findElements(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap((child) => findElements(child, predicate))
  if (!tree || typeof tree !== 'object' || !tree.props) return []
  return [
    ...(predicate(tree) ? [tree] : []),
    ...findElements(tree.props.children, predicate),
  ]
}

function action(tree, label, index = 0) {
  const matches = findElements(tree, (element) =>
    typeof element.props.onClick === 'function'
      && String(element.props.children).replaceAll('−', '-') === label)
  assert.ok(matches[index], `Missing action ${label} at index ${index}`)
  return matches[index].props
}

test('renders the four KPIs, fixed rules and two dark investment cards without the old summary', async () => {
  const read = window.localStorage.getItem
  window.localStorage.getItem = (key) => {
    assert.equal(key, STORAGE_KEY)
    return read(key)
  }
  window.localStorage.setItem = () => assert.fail('Loading/rendering must not save decisions')
  const tree = await loadPage(pageProps())
  const html = renderToStaticMarkup(tree)
  assert.equal((html.match(/class="investments-card"/g) ?? []).length, 2)
  assert.match(html, /Uusi tuotantokone/)
  assert.match(html, /Tehdaslaajennus/)
  assert.match(html, /Tallenna ja jatka/)
  assert.match(html, /Investointivara/)
  assert.equal((html.match(/class="investments-kpi-card"/g) ?? []).length, 4)
  assert.match(html, /Investointien säännöt/)
  assert.match(html, /Korollinen velka voi olla korkeintaan 2 × oma pääoma/)
  assert.match(html, /Uusi tuotantokone tarvitsee 250 m² tehdastilaa/)
  assert.match(html, /Tehdaslaajennus lisää tilaa 1(?:\s|&nbsp;|&#xA0;|&#160;)000 m²/)
  assert.match(html, /Poisto: 5 % \/ kierros \(20 % vuodessa\)/)
  assert.match(html, /Poisto: 2,5 % \/ kierros \(10 % vuodessa\)/)
  assert.match(html, /Kapasiteetti: \+1(?:\s|&nbsp;|&#xA0;|&#160;)040 h \/ kone/)
  assert.match(html, /Henkilöstö: \+5 henkilöä \/ kone/)
  assert.doesNotMatch(html, /Valitut investoinnit|investments-summary/)
  assert.doesNotMatch(html, /<details|Mistä tehdastilan käyttö muodostuu/)
  assert.doesNotMatch(html, /SMED|SPC|TPM|automaatio|prosessimittaus|Kunnonvalvonta/)
})

test('investment KPIs display current canonical financing and factory-space values', async () => {
  const state = createInitialGameState()
  state.factory.totalAreaM2 = 5000
  const model = buildInvestmentsViewModel({
    snapshot: investmentsSnapshot,
    gameState: state,
    factorySettings: DEFAULT_FACTORY_SETTINGS,
    draftSelection: {},
  })
  const tree = await loadPage(pageProps({ gameState: state }))
  const html = renderToStaticMarkup(tree)
  assert.match(html, new RegExp(`Investointivara[\\s\\S]*?${model.financing.remainingFinancingCapacityText}`))
  assert.doesNotMatch(html, new RegExp(`Investointivara[\\s\\S]*?${model.financing.maxDebtText}`))
  assert.match(html, new RegExp(`Korollinen velka[\\s\\S]*?${model.financing.currentDebtText}`))
  assert.match(html, new RegExp(`Oma pääoma[\\s\\S]*?${model.financing.equityText}`))
  assert.match(html, new RegExp(`${model.space.usedAreaText} \\/ ${model.space.freeAreaText}`))
  assert.doesNotMatch(html, /overflow-x:\s*auto/)
})

test('investment reserve display updates with choices and excludes maximum debt from available funds', async () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  gameState.factory.totalAreaM2 = 10000
  gameState.finance.cash = 300000
  gameState.finance.bankLoans = 2023981
  gameState.finance.equity = 3062075
  const props = pageProps({ gameState })
  const reserve = (draftSelection) => buildInvestmentsViewModel({
    snapshot: investmentsSnapshot,
    gameState,
    factorySettings: DEFAULT_FACTORY_SETTINGS,
    draftSelection,
  }).financing
  let tree = await loadPage(props)
  let html = renderToStaticMarkup(tree)
  assert.match(html, new RegExp(`Investointivara[\\s\\S]*?${reserve({}).financingCapacityText}`))
  assert.notEqual(reserve({}).financingCapacity, reserve({}).maxDebt)

  action(tree, '+').onClick()
  tree = hooks.render(InvestmentsPage, props)
  assert.match(renderToStaticMarkup(tree), new RegExp(
    `Investointivara[\\s\\S]*?${reserve({ newMachineCount: 1 }).remainingFinancingCapacityText}`,
  ))
  action(tree, '+').onClick()
  tree = hooks.render(InvestmentsPage, props)
  action(tree, '+', 1).onClick()
  tree = hooks.render(InvestmentsPage, props)
  assert.deepEqual(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).investments, [
    { type: 'new-machine', quantity: 2 },
    { type: 'factory-expansion', quantity: 1 },
  ])
  assert.match(renderToStaticMarkup(tree), new RegExp(
    `Investointivara[\\s\\S]*?${reserve({ newMachineCount: 2, expansionCount: 1 }).remainingFinancingCapacityText}`,
  ))
  assert.equal(reserve({}).financingCapacity - reserve({ newMachineCount: 2, expansionCount: 1 }).remainingFinancingCapacity, 2000000)
  action(tree, '-', 0).onClick()
  tree = hooks.render(InvestmentsPage, props)
  assert.match(renderToStaticMarkup(tree), new RegExp(
    `Investointivara[\\s\\S]*?${reserve({ newMachineCount: 1, expansionCount: 1 }).remainingFinancingCapacityText}`,
  ))
})

test('machine card shows both genuine blockers when the next machine lacks space and financing', async () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const baseModel = buildInvestmentsViewModel({
    snapshot: investmentsSnapshot,
    gameState,
    factorySettings: DEFAULT_FACTORY_SETTINGS,
    draftSelection: {},
  })
  gameState.factory.totalAreaM2 = baseModel.space.base.totalUsed + 300
  gameState.finance.bankLoans = 0
  gameState.finance.equity = 250000
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    round: 1,
    investments: [{ type: 'new-machine', quantity: 1 }],
  }))

  const tree = await loadPage(pageProps({ gameState }))
  const html = renderToStaticMarkup(tree)
  assert.match(html, /Yksi kone tarvitsee 250 m²\. Vapauta tehdastilaa tai hanki tehdaslaajennus\./)
  assert.match(html, /Investointivara ei riitä uuden koneen hankintaan\./)
  assert.doesNotMatch(html, /Ei mahdollista/)
  assert.doesNotMatch(html, /Investointipäätöstä ei voi hyväksyä/)
})

test('machine-space hint appears only when the next machine is actually blocked and expansion resolves it', async () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const baseModel = buildInvestmentsViewModel({
    snapshot: investmentsSnapshot,
    gameState,
    factorySettings: DEFAULT_FACTORY_SETTINGS,
    draftSelection: {},
  })
  gameState.factory.totalAreaM2 = baseModel.space.base.totalUsed + 300
  gameState.finance.bankLoans = 0
  gameState.finance.equity = 2000000
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    round: 1,
    investments: [{ type: 'new-machine', quantity: 1 }],
  }))
  const props = pageProps({ gameState })
  let tree = await loadPage(props)
  let html = renderToStaticMarkup(tree)
  assert.match(html, /Yksi kone tarvitsee 250 m²\. Vapauta tehdastilaa tai hanki tehdaslaajennus\./)
  assert.doesNotMatch(html, /Ei mahdollista/)

  action(tree, '+', 1).onClick()
  tree = hooks.render(InvestmentsPage, props)
  html = renderToStaticMarkup(tree)
  assert.doesNotMatch(html, /Yksi kone tarvitsee 250 m²\. Vapauta tehdastilaa tai hanki tehdaslaajennus\./)
  assert.doesNotMatch(html, /Investointipäätöstä ei voi hyväksyä/)
})

test('expansion card explains when another expansion is blocked by financing', async () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  gameState.finance.cash = 50000
  gameState.finance.bankLoans = 0
  gameState.finance.equity = 500000
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    round: 1,
    investments: [{ type: 'factory-expansion', quantity: 1 }],
  }))

  const tree = await loadPage(pageProps({ gameState }))
  const html = renderToStaticMarkup(tree)
  assert.match(html, /Investointivara ei riitä tehdaslaajennuksen hankintaan\./)
  assert.doesNotMatch(html, /Ei mahdollista/)
  assert.doesNotMatch(html, /Investointipäätöstä ei voi hyväksyä/)
})

test('invalid current investment decision remains clearly reported', async () => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    round: 1,
    investments: [{ type: 'new-machine', quantity: 999 }],
  }))
  const tree = await loadPage(pageProps())
  const html = renderToStaticMarkup(tree)
  assert.match(html, /role="alert">Investointipäätöstä ei voi hyväksyä - tarkista tila- ja rahoitusrajoitteet\./)
  assert.match(html, /Investointivara ei riitä uuden koneen hankintaan\./)
})

test('saving a valid selection continues normally without an add-blocked warning', async () => {
  const paths = []
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  gameState.factory.totalAreaM2 = 5000
  const props = pageProps({ gameState, onNavigate: (path) => paths.push(path) })
  let tree = await loadPage(props)
  action(tree, '+').onClick()
  tree = hooks.render(InvestmentsPage, props)
  const html = renderToStaticMarkup(tree)
  assert.doesNotMatch(html, /Ei mahdollista/)
  assert.doesNotMatch(html, /Investointipäätöstä ei voi hyväksyä/)
  action(tree, 'Tallenna ja jatka').onClick()
  assert.deepEqual(paths, ['/check'])
})

test('machine-space test setup with zero selected machines does not show a selection error', async () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const baseModel = buildInvestmentsViewModel({
    snapshot: investmentsSnapshot,
    gameState,
    factorySettings: DEFAULT_FACTORY_SETTINGS,
    draftSelection: {},
  })
  gameState.factory.totalAreaM2 = baseModel.space.base.totalUsed + 100
  gameState.finance.bankLoans = 0
  gameState.finance.equity = 2000000
  const tree = await loadPage(pageProps({ gameState }))
  assert.doesNotMatch(renderToStaticMarkup(tree), /Investointipäätöstä ei voi hyväksyä/)
  assert.match(renderToStaticMarkup(tree), /Yksi kone tarvitsee 250 m²\. Vapauta tehdastilaa tai hanki tehdaslaajennus\./)
})

test('previous machine-space warning no longer creates a duplicate footer status', async () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  gameState.factory.totalAreaM2 = 1000
  gameState.finance.bankLoans = 0
  gameState.finance.equity = 2000000
  const props = pageProps({ gameState })
  const tree = await loadPage(props)
  assert.doesNotMatch(renderToStaticMarkup(tree), /Ei mahdollista/)
})

test('stored machine decision remains valid before the next machine is blocked', async () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  gameState.factory.totalAreaM2 = 5000
  gameState.finance.bankLoans = 0
  gameState.finance.equity = 250000
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    round: 1,
    investments: [{ type: 'new-machine', quantity: 1 }],
  }))
  const tree = await loadPage(pageProps({ gameState }))
  const html = renderToStaticMarkup(tree)
  assert.match(html, /Investointivara ei riitä uuden koneen hankintaan\./)
  assert.doesNotMatch(html, /Investointipäätöstä ei voi hyväksyä/)
  assert.doesNotMatch(html, /Ei mahdollista/)
})

test('blocked machine increment does not create a footer error', async () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  gameState.factory.totalAreaM2 = 5000
  gameState.finance.bankLoans = 0
  gameState.finance.equity = 250000
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    round: 1,
    investments: [{ type: 'new-machine', quantity: 1 }],
  }))
  const props = pageProps({ gameState })
  const tree = await loadPage(props)
  action(tree, '+').onClick()
  const html = renderToStaticMarkup(hooks.render(InvestmentsPage, props))
  assert.match(html, /Investointivara ei riitä uuden koneen hankintaan\./)
  assert.doesNotMatch(html, /Ei mahdollista/)
  assert.doesNotMatch(html, /role="alert"/)
})

test('legacy machine-space test setup keeps the saved investment and hint consistent', async () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const baseModel = buildInvestmentsViewModel({
    snapshot: investmentsSnapshot,
    gameState,
    factorySettings: DEFAULT_FACTORY_SETTINGS,
    draftSelection: {},
  })
  gameState.factory.totalAreaM2 = baseModel.space.base.totalUsed + 300
  gameState.finance.bankLoans = 0
  gameState.finance.equity = 2000000
  const props = pageProps({ gameState })
  let tree = await loadPage(props)
  assert.doesNotMatch(renderToStaticMarkup(tree), /Yksi kone tarvitsee 250 m²/)

  action(tree, '+').onClick()
  tree = hooks.render(InvestmentsPage, props)
  assert.match(renderToStaticMarkup(tree), /Yksi kone tarvitsee 250 m²/)
  assert.doesNotMatch(renderToStaticMarkup(tree), /Investointipäätöstä ei voi hyväksyä/)
  action(tree, '+', 1).onClick()
  tree = hooks.render(InvestmentsPage, props)
  assert.doesNotMatch(renderToStaticMarkup(tree), /Yksi kone tarvitsee 250 m²/)
  assert.equal(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).investments
    .some((item) => item.type === 'new-machine'), true)
})

test('space-blocked plus attempt keeps allowed investments and has no duplicate warning', async () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const baseModel = buildInvestmentsViewModel({
    snapshot: investmentsSnapshot,
    gameState,
    factorySettings: DEFAULT_FACTORY_SETTINGS,
    draftSelection: {},
  })
  gameState.factory.totalAreaM2 = baseModel.space.base.totalUsed + 300
  gameState.finance.bankLoans = 0
  gameState.finance.equity = 2000000
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    round: 1,
    investments: [{ type: 'new-machine', quantity: 1 }],
  }))
  const props = pageProps({ gameState })
  const tree = await loadPage(props)
  action(tree, '+').onClick()
  const html = renderToStaticMarkup(hooks.render(InvestmentsPage, props))
  assert.match(html, /Yksi kone tarvitsee 250 m²\. Vapauta tehdastilaa tai hanki tehdaslaajennus\./)
  assert.doesNotMatch(html, /Ei mahdollista/)
  assert.doesNotMatch(html, /Investointipäätöstä ei voi hyväksyä/)
  assert.equal(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).investments[0].quantity, 1)
})

test('old machine-space notice scenario also handles constraints with no current purchase', async () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const baseModel = buildInvestmentsViewModel({
    snapshot: investmentsSnapshot,
    gameState,
    factorySettings: DEFAULT_FACTORY_SETTINGS,
    draftSelection: {},
  })
  gameState.factory.totalAreaM2 = baseModel.space.base.totalUsed + 100
  gameState.finance.bankLoans = 0
  gameState.finance.equity = 2000000
  const tree = await loadPage(pageProps({ gameState }))
  assert.match(renderToStaticMarkup(tree), /Yksi kone tarvitsee 250 m²/)
  assert.doesNotMatch(renderToStaticMarkup(tree), /Investointipäätöstä ei voi hyväksyä/)
})

test('previous space notice is not a page-level validation error for valid investment choices', async () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  gameState.factory.totalAreaM2 = 5000
  gameState.finance.bankLoans = 0
  gameState.finance.equity = 2000000
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    round: 1,
    investments: [{ type: 'new-machine', quantity: 1 }],
  }))
  const tree = await loadPage(pageProps({ gameState }))
  assert.doesNotMatch(renderToStaticMarkup(tree), /Investointipäätöstä ei voi hyväksyä/)
})

test('machine-blocked notice is shown for the candidate only even from zero', async () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const baseModel = buildInvestmentsViewModel({
    snapshot: investmentsSnapshot,
    gameState,
    factorySettings: DEFAULT_FACTORY_SETTINGS,
    draftSelection: {},
  })
  gameState.factory.totalAreaM2 = baseModel.space.base.totalUsed + 100
  gameState.finance.bankLoans = 0
  gameState.finance.equity = 2000000
  const tree = await loadPage(pageProps({ gameState }))
  const html = renderToStaticMarkup(tree)
  assert.match(html, /Yksi kone tarvitsee 250 m²\. Vapauta tehdastilaa tai hanki tehdaslaajennus\./)
  assert.doesNotMatch(html, /Ei mahdollista/)
})

test('expand controls stay enabled for valid existing investment and report next-blocked state inline', async () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  gameState.finance.cash = 50000
  gameState.finance.bankLoans = 0
  gameState.finance.equity = 500000
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    round: 1,
    investments: [{ type: 'factory-expansion', quantity: 1 }],
  }))
  const tree = await loadPage(pageProps({ gameState }))
  assert.match(renderToStaticMarkup(tree), /Investointivara ei riitä tehdaslaajennuksen hankintaan\./)
})

test('investment specifications are read from current factory and finance settings', async () => {
  const settings = structuredClone(DEFAULT_FACTORY_SETTINGS)
  settings.investments.newMachine.price = 600000
  settings.investments.factoryExpansion.price = 1200000
  settings.factory.machineSpaceM2 = 300
  settings.factory.factoryExpansionM2 = 1200
  settings.production.hoursPerMachinePerRound = 1200
  settings.finance.machineryDepreciationPerRound = 0.04
  settings.finance.buildingDepreciationPerRound = 0.03
  const tree = await loadPage(pageProps({ factorySettings: settings }))
  const html = renderToStaticMarkup(tree)

  assert.match(html, /600(?:\s|&nbsp;|&#xA0;|&#160;)000 € \/ kone/)
  assert.match(html, /1(?:\s|&nbsp;|&#xA0;|&#160;)200(?:\s|&nbsp;|&#xA0;|&#160;)000 € \/ laajennus/)
  assert.match(html, /Kapasiteetti: \+1(?:\s|&nbsp;|&#xA0;|&#160;)200 h \/ kone/)
  assert.match(html, /Tilantarve: 300 m² \/ kone/)
  assert.match(html, /Tehdaslaajennus lisää tilaa 1(?:\s|&nbsp;|&#xA0;|&#160;)200 m²/)
  assert.match(html, /4 % \/ kierros \(16 % vuodessa\)/)
  assert.match(html, /3 % \/ kierros \(12 % vuodessa\)/)
})

test('save succeeds before navigating to check with the current machine selection', async () => {
  const events = []
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  gameState.factory.totalAreaM2 = 5000
  const props = pageProps({ gameState, onNavigate: (path) => {
    assert.equal(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).investments[0].quantity, 1)
    events.push(path)
  } })
  let tree = await loadPage(props)
  action(tree, '+').onClick()
  tree = hooks.render(InvestmentsPage, props)
  const write = window.localStorage.setItem
  window.localStorage.setItem = (key, value) => {
    write(key, value)
    events.push('save')
  }
  action(tree, 'Tallenna ja jatka').onClick()
  assert.deepEqual(events, ['save', '/check'])
})

test('explicit save failure displays a message and never navigates, and retry succeeds', async () => {
  const paths = []
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  gameState.factory.totalAreaM2 = 5000
  const props = pageProps({ gameState, onNavigate: (path) => paths.push(path) })
  let tree = await loadPage(props)
  const write = window.localStorage.setItem
  window.localStorage.setItem = () => { throw new Error('Storage unavailable') }
  assert.doesNotThrow(() => action(tree, 'Tallenna ja jatka').onClick())
  tree = hooks.render(InvestmentsPage, props)
  assert.match(renderToStaticMarkup(tree), /role="status">Investointien tallennus epäonnistui/)
  assert.deepEqual(paths, [])
  assert.equal(window.localStorage.getItem(STORAGE_KEY), null)
  window.localStorage.setItem = write
  action(tree, 'Tallenna ja jatka').onClick()
  assert.deepEqual(paths, ['/check'])
})

test('valid counter edits auto-persist through remounts and a new round clears the draft', async () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  gameState.factory.totalAreaM2 = 5000
  const props = pageProps({ gameState })
  let tree = await loadPage(props)
  action(tree, '+').onClick()
  tree = hooks.render(InvestmentsPage, props)
  action(tree, '+').onClick()
  assert.deepEqual(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).investments,
    [{ type: 'new-machine', quantity: 2 }])
  hooks.reset()
  tree = await loadPage(props)
  const counters = findElements(tree, (element) => element.type === 'output' && element.props['aria-live'] === 'polite')
  assert.equal(counters[0].props.children, 2)
  action(tree, '-').onClick()
  assert.equal(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).investments[0].quantity, 1)
  tree = await loadPage({ ...props, round: 2 })
  const nextCounters = findElements(tree, (element) => element.type === 'output' && element.props['aria-live'] === 'polite')
  assert.equal(nextCounters[0].props.children, 0)
})

test('expansion controls preserve price, financing limits and removal persistence', async () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  gameState.factory.totalAreaM2 = 5000
  const props = pageProps({ gameState })
  let tree = await loadPage(props)
  action(tree, '+', 1).onClick()
  tree = hooks.render(InvestmentsPage, props)
  assert.deepEqual(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).investments,
    [{ type: 'factory-expansion', quantity: 1 }])
  assert.match(renderToStaticMarkup(tree), /Laajennuksia/)
  window.localStorage.setItem = () => assert.fail('Unaffordable second expansion must not save')
  action(tree, '+', 1).onClick()
  tree = hooks.render(InvestmentsPage, props)
  assert.match(renderToStaticMarkup(tree), /Investointivara ei riitä/)
  let saved
  window.localStorage.setItem = (key, value) => { saved = JSON.parse(value) }
  action(tree, '-', 1).onClick()
  assert.deepEqual(saved.investments, [])
})

test('machine-space notice matches the candidate space and a selected expansion removes it', async () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const baseModel = buildInvestmentsViewModel({
    snapshot: investmentsSnapshot,
    gameState,
    factorySettings: DEFAULT_FACTORY_SETTINGS,
    draftSelection: {},
  })
  gameState.factory.totalAreaM2 = baseModel.space.base.totalUsed + 300
  gameState.finance.bankLoans = 0
  gameState.finance.equity = 2000000
  const props = pageProps({ gameState })
  let tree = await loadPage(props)
  let html = renderToStaticMarkup(tree)
  assert.doesNotMatch(html, /Yksi kone tarvitsee 250 m²\. Vapauta tehdastilaa tai hanki tehdaslaajennus\./)

  action(tree, '+').onClick()
  tree = hooks.render(InvestmentsPage, props)
  html = renderToStaticMarkup(tree)
  assert.match(html, /Yksi kone tarvitsee 250 m²\. Vapauta tehdastilaa tai hanki tehdaslaajennus\./)
  action(tree, '+', 1).onClick()
  tree = hooks.render(InvestmentsPage, props)
  assert.doesNotMatch(renderToStaticMarkup(tree), /Ei riittävästi tehdastilaa valitulle koneelle\./)
  assert.equal(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).investments
    .some((item) => item.type === 'new-machine'), true)
})

test('auto-persist storage failures remain caught and the unsaved selection is visible', async () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  gameState.factory.totalAreaM2 = 5000
  const props = pageProps({ gameState })
  let tree = await loadPage(props)
  window.localStorage.setItem = () => { throw new Error('Quota exceeded') }
  assert.doesNotThrow(() => action(tree, '+').onClick())
  tree = hooks.render(InvestmentsPage, props)
  assert.match(renderToStaticMarkup(tree), /Investointien tallennus epäonnistui/)
  const counters = findElements(tree, (element) => element.type === 'output' && element.props['aria-live'] === 'polite')
  assert.equal(counters[0].props.children, 1)
  assert.equal(window.localStorage.getItem(STORAGE_KEY), null)
})

test('invalid stored draft cannot save or navigate even if its callback is invoked', async () => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    round: 1, investments: [{ type: 'new-machine', quantity: 999 }],
  }))
  window.localStorage.setItem = () => assert.fail('Invalid draft must not save')
  const props = pageProps({ onNavigate: () => assert.fail('Invalid draft must not navigate') })
  const tree = await loadPage(props)
  const save = action(tree, 'Tallenna ja jatka')
  assert.equal(save.disabled, true)
  save.onClick()
  assert.match(renderToStaticMarkup(hooks.render(InvestmentsPage, props)), /tarkista tila- ja rahoitusrajoitteet/)
})