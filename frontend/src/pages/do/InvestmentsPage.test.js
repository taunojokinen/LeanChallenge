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
    typeof element.props.onClick === 'function' && element.props.children === label)
  assert.ok(matches[index], `Missing action ${label} at index ${index}`)
  return matches[index].props
}

test('renders only machine and expansion cards with no project reads or render-time saves', async () => {
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
  assert.doesNotMatch(html, /SMED|SPC|TPM|automaatio|prosessimittaus|Kunnonvalvonta/)
})

test('save succeeds before navigating to check with the current machine selection', async () => {
  const events = []
  const props = pageProps({ onNavigate: (path) => {
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
  const props = pageProps({ onNavigate: (path) => paths.push(path) })
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
  const props = pageProps()
  let tree = await loadPage(props)
  action(tree, '+').onClick()
  tree = hooks.render(InvestmentsPage, props)
  action(tree, '+').onClick()
  assert.deepEqual(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).investments,
    [{ type: 'new-machine', quantity: 2 }])
  hooks.reset()
  tree = await loadPage(props)
  const counters = findElements(tree, (element) => element.props.className === 'investments-counter')
  assert.equal(counters[0].props.children[1].props.children, 2)
  action(tree, '-').onClick()
  assert.equal(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).investments[0].quantity, 1)
  tree = await loadPage({ ...props, round: 2 })
  const nextCounters = findElements(tree, (element) => element.props.className === 'investments-counter')
  assert.equal(nextCounters[0].props.children[1].props.children, 0)
})

test('expansion controls preserve price, financing limits and removal persistence', async () => {
  const props = pageProps()
  let tree = await loadPage(props)
  action(tree, '+', 1).onClick()
  tree = hooks.render(InvestmentsPage, props)
  assert.deepEqual(JSON.parse(window.localStorage.getItem(STORAGE_KEY)).investments,
    [{ type: 'factory-expansion', quantity: 1 }])
  const html = renderToStaticMarkup(tree)
  assert.match(html, /factory-expansion/)
  assert.match(html, /1(?:\s|&nbsp;|&#xA0;|&#160;)000(?:\s|&nbsp;|&#xA0;|&#160;)000/)
  window.localStorage.setItem = () => assert.fail('Unaffordable second expansion must not save')
  action(tree, '+', 1).onClick()
  tree = hooks.render(InvestmentsPage, props)
  assert.match(renderToStaticMarkup(tree), /rahoitusvara ei ole riittävä/)
  let saved
  window.localStorage.setItem = (key, value) => { saved = JSON.parse(value) }
  action(tree, '-', 1).onClick()
  assert.deepEqual(saved.investments, [])
})

test('auto-persist storage failures remain caught and the unsaved selection is visible', async () => {
  const props = pageProps()
  let tree = await loadPage(props)
  window.localStorage.setItem = () => { throw new Error('Quota exceeded') }
  assert.doesNotThrow(() => action(tree, '+').onClick())
  tree = hooks.render(InvestmentsPage, props)
  assert.match(renderToStaticMarkup(tree), /Investointien tallennus epäonnistui/)
  const counters = findElements(tree, (element) => element.props.className === 'investments-counter')
  assert.equal(counters[0].props.children[1].props.children, 1)
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