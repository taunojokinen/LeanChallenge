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

const HOOKS_MODULE = 'virtual:check-page-test-hooks'
const originalWindow = globalThis.window
let server
let cacheDir
let CheckPage
let hooks

before(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), 'check-page-test-'))
  server = await createServer({
    root: fileURLToPath(new URL('../../../', import.meta.url)),
    cacheDir,
    logLevel: 'warn',
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: 'custom',
    plugins: [{
      name: 'check-page-test-hooks',
      enforce: 'pre',
      transform(code, id) {
        if (id.replaceAll('\\', '/').endsWith('/pages/check/CheckPage.jsx')) {
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
          let cursor = 0
          export function reset() { states = [] }
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
          export function useMemo(calculate) {
            cursor++
            return calculate()
          }
        `
      },
    }],
  })
  hooks = await server.ssrLoadModule(HOOKS_MODULE)
  CheckPage = (await server.ssrLoadModule('/src/pages/check/CheckPage.jsx')).default
})

beforeEach(() => {
  hooks.reset()
  const values = new Map()
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  }
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

function props(overrides = {}) {
  return {
    gameState: createInitialGameState(DEFAULT_FACTORY_SETTINGS),
    factorySettings: DEFAULT_FACTORY_SETTINGS,
    onNavigate: () => {},
    ...overrides,
  }
}

function findElements(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap((child) => findElements(child, predicate))
  if (!tree || typeof tree !== 'object' || !tree.props) return []
  return [
    ...(predicate(tree) ? [tree] : []),
    ...findElements(tree.props.children, predicate),
  ]
}

function range(tree, label) {
  const match = findElements(tree, (element) =>
    element.type === 'input' && element.props.type === 'range'
      && element.props['aria-label'] === label)[0]
  assert.ok(match, `Missing range input: ${label}`)
  return match
}

function button(tree, label) {
  const match = findElements(tree, (element) =>
    element.type?.name === 'Button' && element.props['aria-label'] === label)[0]
  assert.ok(match, `Missing button: ${label}`)
  return match
}

function departmentCapacity(tree, key) {
  const department = findElements(tree, (element) =>
    String(element.props.className ?? '').split(' ').includes('check-department')
      && element.props.className.split(' ').includes(`check-department--${key}`))[0]
  assert.ok(department, `Missing department card: ${key}`)
  return String(findElements(department, (element) => element.type === 'p')[0].props.children)
}

test('renders the three CHECK cards and removes the other effects section', () => {
  const tree = hooks.render(CheckPage, props())
  const html = renderToStaticMarkup(tree)
  const ranges = findElements(tree, (element) => element.type === 'input' && element.props.type === 'range')

  assert.match(html, /CHECK – Vaikutusarvio/)
  assert.match(html, /Säädä henkilöstöä ja eräkokoa\. Tarkista vaikutukset ennen ACT-vaihetta\./)
  assert.match(html, /Henkilöstö ja kapasiteetti/)
  assert.match(html, /Henkilöstöpäätökset kierrokselle 1; kapasiteettiennuste kierrokselle 2\./)
  assert.match(html, /Eräkoko ja varasto/)
  assert.match(html, /Eräkoon tuotantovaikutus näkyy kierroksen 2 ennusteessa\./)
  assert.match(html, /Miksi minimivarastoa tarvitaan\?/)
  assert.match(html, /Asiakas edellyttää jatkuvaa toimituskykyä: viikon aikana on pystyttävä toimittamaan mitä tahansa tuotevariaatiota\./)
  assert.match(html, /Pienempi eräkoko ja suurempi konemäärä vähentävät minimivaraston tarvetta\./)
  assert.doesNotMatch(html, /Muut vaikutukset/)
  assert.match(html, /Tehdastilan käyttö/)
  assert.equal(ranges.length, 3)
  assert.equal(findElements(tree, (element) =>
    element.type === 'input' && element.props.type === 'range'
      && element.props['aria-label'] === 'Koneistus henkilöstö').length, 0)
  assert.equal(range(tree, 'Koonta henkilöstö').props.min, '0')
  assert.equal(range(tree, 'Lähettämö henkilöstö').props.min, '0')
  assert.equal(range(tree, 'Eräkoko').props.min, DEFAULT_FACTORY_SETTINGS.production.minBatchSize)
  assert.equal(range(tree, 'Eräkoko').props.max, DEFAULT_FACTORY_SETTINGS.production.maxBatchSize)
  assert.equal(range(tree, 'Eräkoko').props.step, '1')
})

test('factory space breakdown matches the default factory settings and is recalculated for CHECK decisions', () => {
  const pageProps = props()
  const normalize = (markup) => markup.replaceAll('\u00a0', ' ')
  const readMarkup = () => normalize(renderToStaticMarkup(hooks.render(CheckPage, pageProps)))
  let html = readMarkup()

  assert.match(html, /Koneistus<\/dt><dd>1 000 m²/)
  assert.match(html, /Koonta<\/dt><dd>950 m²/)
  assert.match(html, /Lähettämö ja sen henkilöstö<\/dt><dd>375 m²/)
  assert.match(html, /Toimisto- ja sosiaalitilat<\/dt><dd>200 m²/)
  assert.match(html, /Valmistuotevarasto<\/dt><dd>1 500 m²/)
  assert.match(html, /Käytetty tehdastila yhteensä<\/dt><dd>4 025 m²/)
  assert.match(html, /Vapaa tehdastila<\/dt><dd>225 m²/)
  assert.match(html, /Tehtaan kokonaispinta-ala<\/dt><dd>4 250 m²/)

  const assemblyInput = range(hooks.render(CheckPage, pageProps), 'Koonta henkilöstö')
  assemblyInput.props.onChange({ target: { value: String(Number(assemblyInput.props.value) + 1) } })
  const shippingInput = range(hooks.render(CheckPage, pageProps), 'Lähettämö henkilöstö')
  shippingInput.props.onChange({ target: { value: String(Number(shippingInput.props.value) + 1) } })
  html = readMarkup()

  assert.match(html, /Koonta<\/dt><dd>975 m²/)
  assert.match(html, /Lähettämö ja sen henkilöstö<\/dt><dd>400 m²/)
  assert.match(html, /Käytetty tehdastila yhteensä<\/dt><dd>4 075 m²/)
  assert.match(html, /Vapaa tehdastila<\/dt><dd>175 m²/)
  assert.match(html, /Tehtaan kokonaispinta-ala<\/dt><dd>4 250 m²/)
})

test('staffing sliders persist decisions and update model-backed department capacity', () => {
  const pageProps = props({
    gameState: {
      ...createInitialGameState(DEFAULT_FACTORY_SETTINGS),
      factory: {
        ...createInitialGameState(DEFAULT_FACTORY_SETTINGS).factory,
        totalAreaM2: 6000,
      },
    },
  })
  const tree = hooks.render(CheckPage, pageProps)
  const input = range(tree, 'Koonta henkilöstö')
  assert.ok(Number(input.props.max) > Number(input.props.value))
  const initialCapacity = departmentCapacity(tree, 'assembly')
  input.props.onChange({ target: { value: String(Number(input.props.value) + 1) } })
  const updatedTree = hooks.render(CheckPage, pageProps)
  const updatedInput = range(updatedTree, 'Koonta henkilöstö')
  const updatedCapacity = departmentCapacity(updatedTree, 'assembly')
  const saved = JSON.parse(window.localStorage.getItem('lean-challenge-check-staffing-decision'))

  assert.equal(Number(updatedInput.props.value), Number(input.props.value) + 1)
  assert.equal(saved.staffing.assembly, Number(updatedInput.props.value))
  assert.notEqual(updatedCapacity, initialCapacity)
  assert.match(renderToStaticMarkup(updatedTree), /Pullonkaula/)

  button(updatedTree, 'Lisää koonnan henkilöstöä').props.onClick()
  const buttonUpdatedTree = hooks.render(CheckPage, pageProps)
  assert.equal(Number(range(buttonUpdatedTree, 'Koonta henkilöstö').props.value), Number(updatedInput.props.value) + 1)
  assert.equal(
    JSON.parse(window.localStorage.getItem('lean-challenge-check-staffing-decision')).staffing.assembly,
    Number(updatedInput.props.value) + 1,
  )

  hooks.reset()
  const remountedTree = hooks.render(CheckPage, pageProps)
  assert.equal(
    Number(range(remountedTree, 'Koonta henkilöstö').props.value),
    Number(updatedInput.props.value) + 1,
  )

  hooks.reset()
  window.localStorage.setItem(
    'lean-challenge-check-staffing-decision',
    JSON.stringify({ round: 1, staffing: { assembly: 0, shipping: 0 } }),
  )
  const minimumTree = hooks.render(CheckPage, pageProps)
  assert.equal(button(minimumTree, 'Vähennä koonnan henkilöstöä').props.disabled, true)
  assert.equal(button(minimumTree, 'Vähennä lähettämön henkilöstöä').props.disabled, true)
  assert.equal(button(minimumTree, 'Lisää koonnan henkilöstöä').props.disabled, false)
})

test('staffing additions stop at the factory-space limit but decreases remain available', () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  gameState.factory.totalAreaM2 = 4025
  const pageProps = props({ gameState })
  const tree = hooks.render(CheckPage, pageProps)

  assert.equal(Number(range(tree, 'Koonta henkilöstö').props.max), Number(range(tree, 'Koonta henkilöstö').props.value))
  assert.equal(button(tree, 'Lisää koonnan henkilöstöä').props.disabled, true)
  assert.equal(button(tree, 'Lisää lähettämön henkilöstöä').props.disabled, true)
  assert.equal(Number(range(tree, 'Lähettämö henkilöstö').props.max), Number(range(tree, 'Lähettämö henkilöstö').props.value))
  assert.match(renderToStaticMarkup(tree), /Tehdastila ei riitä henkilöstön lisäämiseen\./)
  assert.match(renderToStaticMarkup(tree), /toimitukset eivät vapauta tilaa saman kierroksen uudelle tuotannolle/)

  const currentAssembly = Number(range(tree, 'Koonta henkilöstö').props.value)
  const reducedTree = (() => {
    button(tree, 'Vähennä koonnan henkilöstöä').props.onClick()
    return hooks.render(CheckPage, pageProps)
  })()

  assert.equal(Number(range(reducedTree, 'Koonta henkilöstö').props.value), currentAssembly - 1)
  assert.equal(button(reducedTree, 'Vähennä koonnan henkilöstöä').props.disabled, false)
})

test('staffing slider maximum follows free space and blocks further additions at the limit', () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  gameState.factory.totalAreaM2 = 6000
  const pageProps = props({ gameState })
  let tree = hooks.render(CheckPage, pageProps)
  const staffing = range(tree, 'Koonta henkilöstö')
  const maximum = Number(staffing.props.max)

  assert.ok(maximum > Number(staffing.props.value))
  staffing.props.onChange({ target: { value: String(maximum) } })
  tree = hooks.render(CheckPage, pageProps)

  assert.equal(Number(range(tree, 'Koonta henkilöstö').props.value), maximum)
  assert.equal(Number(range(tree, 'Koonta henkilöstö').props.max), maximum)
  assert.equal(button(tree, 'Lisää koonnan henkilöstöä').props.disabled, true)
})

test('batch-size slider updates the model-backed inventory and space preview and persists for the next round', () => {
  const pageProps = props()
  const tree = hooks.render(CheckPage, pageProps)
  const input = range(tree, 'Eräkoko')
  const initialHtml = renderToStaticMarkup(tree)
  const initialMachiningCapacity = departmentCapacity(tree, 'machining')
  const nextBatch = Math.max(Number(input.props.min), Number(input.props.value) - 10)

  input.props.onChange({ target: { value: String(nextBatch) } })
  const updatedTree = hooks.render(CheckPage, pageProps)
  const updatedHtml = renderToStaticMarkup(updatedTree)
  const saved = JSON.parse(window.localStorage.getItem('lean-challenge-check-production-decision'))

  assert.equal(Number(range(updatedTree, 'Eräkoko').props.value), nextBatch)
  assert.equal(saved.batchSize, nextBatch)
  assert.notEqual(departmentCapacity(updatedTree, 'machining'), initialMachiningCapacity)
  assert.notEqual(updatedHtml.match(/Minimivarasto<\/dt><dd>(.*?)<\/dd>/)?.[1],
    initialHtml.match(/Minimivarasto<\/dt><dd>(.*?)<\/dd>/)?.[1])
  assert.match(updatedHtml, /Fyysinen varasto/)
  assert.match(updatedHtml, /Vapaa tehdastila/)

  hooks.reset()
  const remountedTree = hooks.render(CheckPage, pageProps)
  assert.equal(Number(range(remountedTree, 'Eräkoko').props.value), nextBatch)
})

test('stepper buttons update the batch-size slider and stop at configured bounds', () => {
  const tree = hooks.render(CheckPage, props())
  const minimum = Number(range(tree, 'Eräkoko').props.min)
  const maximum = Number(range(tree, 'Eräkoko').props.max)

  assert.equal(button(tree, 'Suurenna eräkokoa').props.disabled, true)
  button(tree, 'Pienennä eräkokoa').props.onClick()
  let updatedTree = hooks.render(CheckPage, props())
  assert.equal(Number(range(updatedTree, 'Eräkoko').props.value), maximum - 1)
  assert.match(renderToStaticMarkup(updatedTree), new RegExp(`<output[^>]*>${maximum - 1} konttia</output>`))

  const input = range(updatedTree, 'Eräkoko')
  input.props.onChange({ target: { value: String(minimum) } })
  updatedTree = hooks.render(CheckPage, props())
  assert.equal(Number(range(updatedTree, 'Eräkoko').props.value), minimum)
  assert.equal(button(updatedTree, 'Pienennä eräkokoa').props.disabled, true)
  button(updatedTree, 'Suurenna eräkokoa').props.onClick()
  updatedTree = hooks.render(CheckPage, props())
  assert.equal(Number(range(updatedTree, 'Eräkoko').props.value), minimum + 1)
})
test('negative forecast factory space is retained and visibly marked', () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  gameState.factory.totalAreaM2 = 1
  const html = renderToStaticMarkup(hooks.render(CheckPage, props({ gameState })))

  assert.match(html, /class="is-negative">-\d+ m²/)
})

test('decisions auto-save without save controls and remain available through navigation', () => {
  const paths = []
  const tree = hooks.render(CheckPage, props({ onNavigate: (path) => paths.push(path) }))
  const staffingInput = range(tree, 'Koonta henkilöstö')
  const batchInput = range(tree, 'Eräkoko')
  const nextStaffing = Number(staffingInput.props.value) + 1
  const nextBatchSize = Number(batchInput.props.value) - 1
  staffingInput.props.onChange({ target: { value: String(nextStaffing) } })
  batchInput.props.onChange({ target: { value: String(nextBatchSize) } })
  const updatedTree = hooks.render(CheckPage, props({ onNavigate: (path) => paths.push(path) }))
  const updatedButtons = findElements(updatedTree, (element) => element.type?.name === 'Button')
  const markup = renderToStaticMarkup(updatedTree)
  const storedStaffing = JSON.parse(window.localStorage.getItem('lean-challenge-check-staffing-decision'))
  const storedProduction = JSON.parse(window.localStorage.getItem('lean-challenge-check-production-decision'))
  const actButton = updatedButtons.find((button) => String(button.props.children).includes('Siirry ACT-vaiheeseen'))
  const navigationButtons = updatedButtons.filter((button) =>
    ['Takaisin DO:hon', 'Siirry ACT-vaiheeseen'].includes(String(button.props.children).trim()))

  assert.ok(!updatedButtons.some((button) => /Tallenna (henkilöstö|eräkoko)päätös/.test(String(button.props.children))))
  assert.deepEqual(navigationButtons.map((button) => String(button.props.children).trim()), ['Siirry ACT-vaiheeseen'])
  assert.doesNotMatch(markup, /Takaisin DO:hon/)
  assert.match(markup, /class="check-page__footer"/)
  assert.doesNotMatch(markup, /päätös tallennettu/i)
  assert.equal(storedStaffing.staffing.assembly, nextStaffing)
  assert.equal(storedProduction.batchSize, nextBatchSize)

  actButton.props.onClick()
  hooks.reset()
  const remountedTree = hooks.render(CheckPage, props({ onNavigate: (path) => paths.push(path) }))

  assert.equal(Number(range(remountedTree, 'Koonta henkilöstö').props.value), nextStaffing)
  assert.equal(Number(range(remountedTree, 'Eräkoko').props.value), nextBatchSize)
  assert.deepEqual(paths, ['/act'])
})
