import test, { after, before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { LANDING_GUIDES } from './guideContent.js'

const HOOKS_MODULE = 'virtual:landing-page-test-hooks'
const originalWindow = globalThis.window
let server
let cacheDir
let LandingPage
let GuideWindow
let hooks

before(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), 'landing-page-test-'))
  server = await createServer({
    root: fileURLToPath(new URL('../../../', import.meta.url)),
    cacheDir,
    logLevel: 'warn',
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: 'custom',
    plugins: [{
      name: 'landing-page-test-hooks',
      enforce: 'pre',
      transform(code, id) {
        if (id.replaceAll('\\', '/').includes('/pages/landing/')) {
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
  LandingPage = (await server.ssrLoadModule('/src/pages/landing/LandingPage.jsx')).default
  GuideWindow = (await server.ssrLoadModule('/src/pages/landing/GuideWindow.jsx')).default
})

beforeEach(() => {
  hooks.reset()
  globalThis.window = {
    listeners: new Map(),
    addEventListener(type, callback) {
      this.listeners.set(type, callback)
    },
    removeEventListener(type, callback) {
      if (this.listeners.get(type) === callback) this.listeners.delete(type)
    },
  }
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

function findElements(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap((child) => findElements(child, predicate))
  if (!tree || typeof tree !== 'object' || !tree.props) return []
  return [
    ...(predicate(tree) ? [tree] : []),
    ...findElements(tree.props.children, predicate),
  ]
}

test('landing keeps the factory hero and one login action, with compact ordered guide buttons', () => {
  let loginCalls = 0
  const tree = hooks.render(LandingPage, { onLogin: () => { loginCalls += 1 } })
  const html = renderToStaticMarkup(tree)
  const guideButtons = findElements(tree, (element) =>
    element.type === 'button' && element.props.className?.startsWith('landing-guide-link'))
  const loginActions = findElements(tree, (element) =>
    element.props.children === 'Kirjaudu ja aloita')

  assert.equal(guideButtons.length, 12)
  assert.deepEqual(
    guideButtons.map((button) => button.props.children[1].props.children),
    LANDING_GUIDES.map((guide) => guide.title),
  )
  assert.equal(loginActions.length, 1)
  loginActions[0].props.onClick()
  assert.equal(loginCalls, 1)
  assert.match(html, /alt="Lean Cockpitin tehdasympäristö"/)
  assert.doesNotMatch(html, /class="landing-pdca|class="landing-info/)
  assert.doesNotMatch(html, /KIRJAUDU/)
})

test('each guide opens with its matching content and a different selection switches the panel', () => {
  let tree = hooks.render(LandingPage, { onLogin() {} })
  const buttons = findElements(tree, (element) =>
    element.type === 'button' && element.props.className?.startsWith('landing-guide-link'))

  for (const [index, guide] of LANDING_GUIDES.entries()) {
    buttons[index].props.onClick()
    tree = hooks.render(LandingPage, { onLogin() {} })
    const panel = findElements(tree, (element) => element.type === GuideWindow)[0]
    assert.equal(panel.props.guide.id, guide.id)
    assert.equal(panel.props.guide.title, guide.title)
    const html = renderToStaticMarkup(hooks.render(GuideWindow, panel.props))
    assert.match(html, new RegExp(guide.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.match(html, /Lean Challengessa/)
  }
})

test('help can be dismissed with its button and Escape without removing the hero', async () => {
  const onClose = () => { closed = true }
  let closed = false
  let panel = hooks.render(GuideWindow, { guide: LANDING_GUIDES[0], onClose })
  const closeButton = findElements(panel, (element) => element.props.className === 'landing-guide-close')[0]
  closeButton.props.onClick()
  assert.equal(closed, true)

  hooks.reset()
  closed = false
  panel = hooks.render(GuideWindow, { guide: LANDING_GUIDES[0], onClose })
  renderToStaticMarkup(panel)
  await hooks.flushEffects()
  window.listeners.get('keydown')({ key: 'Escape' })
  assert.equal(closed, true)

  const css = await readFile(new URL('./LandingPage.css', import.meta.url), 'utf8')
  const guideCss = await readFile(new URL('./GuideWindow.css', import.meta.url), 'utf8')
  assert.match(css, /\.landing-hero \{\s*position: relative/s)
  assert.match(guideCss, /\.landing-guide-window \{\s*position: absolute/s)
  assert.match(guideCss, /@media \(max-width: 1050px\)[\s\S]*?position: relative/)
  assert.doesNotMatch(css + guideCss, /transform:\s*scale|zoom:/)
})
