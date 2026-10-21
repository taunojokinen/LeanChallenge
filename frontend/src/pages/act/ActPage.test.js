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
import { calculateRoundForecast } from '../../entities/forecast/model.js'

const HOOKS_MODULE = 'virtual:act-page-test-hooks'
const originalWindow = globalThis.window
let server
let cacheDir
let ActPage
let hooks

before(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), 'act-page-test-'))
  server = await createServer({
    root: fileURLToPath(new URL('../../../', import.meta.url)),
    cacheDir,
    logLevel: 'warn',
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: 'custom',
    plugins: [{
      name: 'act-page-test-hooks',
      enforce: 'pre',
      transform(code, id) {
        if (id.replaceAll('\\', '/').endsWith('/pages/act/ActPage.jsx')) {
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
          export function useEffect() {}
        `
      },
    }],
  })
  hooks = await server.ssrLoadModule(HOOKS_MODULE)
  ActPage = (await server.ssrLoadModule('/src/pages/act/ActPage.jsx')).default
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
    onAdvanceRound: () => {},
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

function button(tree, stepperLabel, buttonLabel) {
  const stepper = findElements(tree, (element) =>
    element.type?.name === 'Stepper' && element.props.label === stepperLabel)[0]
  assert.ok(stepper, `Missing stepper: ${stepperLabel}`)
  const match = findElements(stepper.type(stepper.props), (element) =>
    element.type === 'button' && element.props['aria-label'] === buttonLabel)[0]
  assert.ok(match, `Missing button: ${buttonLabel}`)
  return match
}

test('ACT renders three decision cards and omits removed price and summary panels', () => {
  const tree = hooks.render(ActPage, props())
  const html = renderToStaticMarkup(tree)
  const actionButtons = findElements(tree, (element) =>
    element.type?.name === 'Button')

  assert.match(html, /ACT – Päätä ja vahvista/)
  assert.match(html, /Tuotantopäätös/)
  assert.match(html, /Uudet asiakkuudet/)
  assert.match(html, /Päätösten vaikutukset/)
  assert.equal(findElements(tree, (element) =>
    String(element.props.className ?? '').split(' ').includes('act-card')).length, 3)
  assert.doesNotMatch(html, /Myyntihinta|CHECK-yhteenveto|Kysyntä vs\. kapasiteetti|Yhteenveto seuraavasta kierroksesta|Mitä kannattaa huomioida/)
  assert.equal(actionButtons.length, 1)
  assert.match(String(actionButtons[0].props.children), /HYVÄKSY PÄÄTÖKSET/)
  assert.match(html, /class="act-actions"/)
  assert.doesNotMatch(html, /PALAA CHECK-VAIHEESEEN/)
})

test('quality thresholds hide customer controls below 75 and use model caps at higher levels', () => {
  let tree = hooks.render(ActPage, props())
  let html = renderToStaticMarkup(tree)

  assert.match(html, /Laatu ei riitä uusien asiakkaiden vaatimuksiin\./)
  assert.match(html, /Tuotannon laatuprosentti: <strong>70,0 %<\/strong>/)
  assert.equal(findElements(tree, (element) =>
    element.type === 'input' && element.props.type === 'range'
      && element.props['aria-label'] === 'Uudet asiakkuudet').length, 0)

  const goodQualitySettings = structuredClone(DEFAULT_FACTORY_SETTINGS)
  goodQualitySettings.lean.performance.defaultBasePct = 75
  tree = hooks.render(ActPage, props({
    gameState: createInitialGameState(goodQualitySettings),
    factorySettings: goodQualitySettings,
  }))
  html = renderToStaticMarkup(tree)
  assert.match(html, /1 uusi asiakas on kiinnostunut tuotteistasi/)
  assert.equal(Number(range(tree, 'Uudet asiakkuudet').props.max), 1)

  hooks.reset()
  const excellentQualitySettings = structuredClone(DEFAULT_FACTORY_SETTINGS)
  excellentQualitySettings.lean.performance.defaultBasePct = 80
  tree = hooks.render(ActPage, props({
    gameState: createInitialGameState(excellentQualitySettings),
    factorySettings: excellentQualitySettings,
  }))
  html = renderToStaticMarkup(tree)
  assert.match(html, /2 uutta asiakasta on kiinnostunut tuotteistasi/)
  assert.equal(Number(range(tree, 'Uudet asiakkuudet').props.max), 2)
  button(tree, 'uudet asiakkuudet', 'Lisää: uudet asiakkuudet').props.onClick()
  tree = hooks.render(ActPage, props({
    gameState: createInitialGameState(excellentQualitySettings),
    factorySettings: excellentQualitySettings,
  }))
  assert.equal(Number(range(tree, 'Uudet asiakkuudet').props.value), 1)
  assert.equal(
    JSON.parse(window.localStorage.getItem('lean-challenge-act-decision')).addedVariations,
    1,
  )
})

test('production controls respect model capacity, persist changes and approve the matching forecast', () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const initialForecast = calculateRoundForecast(gameState, {}, DEFAULT_FACTORY_SETTINGS)
  const requestedProduction = Math.max(0, initialForecast.summary.plantCapacity - 2)
  const expectedForecast = calculateRoundForecast(gameState, {
    market: {
      price: gameState.market.price,
      addedVariations: 0,
      productionQuantity: requestedProduction + 1,
      batchSize: gameState.market.batchSize,
      useFinishedGoodsInventoryForDeliveries: false,
    },
  }, DEFAULT_FACTORY_SETTINGS)
  const approvedForecasts = []
  const pageProps = props({
    onAdvanceRound: (forecast) => approvedForecasts.push(forecast),
  })
  let tree = hooks.render(ActPage, pageProps)
  const quantity = range(tree, 'Tuotantomäärä')

  assert.equal(Number(quantity.props.max), initialForecast.summary.plantCapacity)
  quantity.props.onChange({ target: { value: String(requestedProduction) } })
  tree = hooks.render(ActPage, pageProps)

  assert.equal(Number(range(tree, 'Tuotantomäärä').props.value), requestedProduction)
  assert.equal(
    Number(JSON.parse(window.localStorage.getItem('lean-challenge-act-decision')).productionQuantity),
    requestedProduction,
  )
  assert.equal(button(tree, 'tuotantomäärä', 'Lisää: tuotantomäärä').props.disabled, false)
  button(tree, 'tuotantomäärä', 'Lisää: tuotantomäärä').props.onClick()
  tree = hooks.render(ActPage, pageProps)
  assert.equal(Number(range(tree, 'Tuotantomäärä').props.value), requestedProduction + 1)

  const approve = findElements(tree, (element) =>
    element.type?.name === 'Button' && String(element.props.children).includes('HYVÄKSY PÄÄTÖKSET'))[0]
  approve.props.onClick()
  assert.equal(approvedForecasts.length, 1)
  assert.equal(approvedForecasts[0].summary.productionQuantity, expectedForecast.summary.productionQuantity)
  assert.equal(approvedForecasts[0].summary.deliveries, expectedForecast.summary.deliveries)
})

test('zero previous result omits result change percentage', () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const previousRound = gameState.initialFinancialHistory.find((entry) => entry.round === gameState.round - 1)
  previousRound.incomeStatement.result = 0
  const html = renderToStaticMarkup(hooks.render(ActPage, props({ gameState })))

  assert.match(html, /Tulosennuste/)
  assert.doesNotMatch(html, /Tuloksen muutos edelliseen kierrokseen/)
})

test('ACT uses the shared Finnish one-decimal change presentation', () => {
  const html = renderToStaticMarkup(hooks.render(ActPage, props()))
  const changes = [...html.matchAll(/<dt>(?:Liikevaihdon|Tuloksen) muutos edelliseen kierrokseen<\/dt><dd[^>]*>([^<]*)<\/dd>/g)]

  assert.equal(changes.length, 2)
  for (const change of changes) {
    assert.match(change[1], /^(?:[+−]?\d[\d\u00a0]*,\d %|—)$/)
  }
})

test('the final ACT confirmation offers to end the game and passes its final forecast', () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  gameState.round = 12
  const forecasts = []
  const tree = hooks.render(ActPage, props({
    gameState,
    onAdvanceRound: (forecast) => forecasts.push(forecast),
  }))
  const actions = findElements(tree, (element) => element.type?.name === 'Button')

  assert.equal(actions.length, 1)
  assert.equal(actions[0].props.children, 'Päätä peli ja näytä loppuraportti')
  actions[0].props.onClick()
  assert.equal(forecasts.length, 1)
  assert.equal(forecasts[0].closingState.canonical.round, 12)
})

test('ACT applies the CHECK batch-size choice equally on rounds one, eleven and twelve', () => {
  const results = []
  for (const round of [1, 11, 12]) {
    for (const batchSize of [10, 20]) {
      hooks.reset()
      window.localStorage.removeItem('lean-challenge-act-decision')
      window.localStorage.setItem('lean-challenge-check-production-decision', JSON.stringify({ round, batchSize }))
      const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
      gameState.round = round
      gameState.market.batchSize = 10
      const approved = []
      const tree = hooks.render(ActPage, props({
        gameState,
        onAdvanceRound: (forecast) => approved.push(forecast),
      }))
      findElements(tree, (element) => element.type?.name === 'Button')[0].props.onClick()

      assert.equal(approved.length, 1)
      assert.equal(approved[0].decisions.market.batchSize, batchSize)
      assert.equal(approved[0].summary.actualProduction, Number(range(tree, 'Tuotantomäärä').props.value))
      results.push({
        batchSize,
        capacity: approved[0].summary.plantCapacity,
        actual: approved[0].summary.actualProduction,
      })
    }
  }
  assert.deepEqual(results.slice(0, 2), results.slice(2, 4))
  assert.deepEqual(results.slice(0, 2), results.slice(4))
  assert.ok(results[1].capacity > results[0].capacity)
  assert.ok(results[1].actual > results[0].actual)
})

test('saved ACT production does not increase automatically when batch size frees capacity, including round twelve', () => {
  for (const round of [1, 12]) {
    const results = []
    for (const batchSize of [5, 20]) {
      hooks.reset()
      window.localStorage.setItem('lean-challenge-check-production-decision', JSON.stringify({ round, batchSize }))
      window.localStorage.setItem('lean-challenge-act-decision', JSON.stringify({
        round, price: 25000, productionQuantity: 100, addedVariations: 0,
      }))
      const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
      gameState.round = round
      gameState.market.batchSize = 10
      const approved = []
      const tree = hooks.render(ActPage, props({
        gameState,
        onAdvanceRound: (forecast) => approved.push(forecast),
      }))
      findElements(tree, (element) => element.type?.name === 'Button')[0].props.onClick()
      assert.equal(Number(range(tree, 'Tuotantomäärä').props.value), 100)
      assert.equal(approved[0].summary.actualProduction, 100)
      results.push(approved[0].summary.plantCapacity)
    }
    assert.ok(results[1] > results[0])
  }
})
