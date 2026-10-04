import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Children, createElement, isValidElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

let server
let cacheDir
let DevelopmentSlider
let ProgressBar

before(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), 'development-slider-test-'))
  server = await createServer({
    root: fileURLToPath(new URL('../../../', import.meta.url)),
    cacheDir,
    logLevel: 'warn',
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: 'custom',
  })
  DevelopmentSlider = (await server.ssrLoadModule('/src/widgets/development-slider/DevelopmentSlider.jsx')).default
  ProgressBar = (await server.ssrLoadModule('/src/widgets/progress-bar/ProgressBar.jsx')).default
})

after(async () => {
  try {
    await server?.close()
  } finally {
    if (cacheDir) {
      await rm(cacheDir, { recursive: true, force: true })
    }
  }
})

function render(props = {}) {
  let tree

  function Capture() {
    tree = DevelopmentSlider({
      label: 'TPM',
      value: 80,
      max: 400,
      predictedLevel: 30,
      onChange: () => {},
      ...props,
    })
    return tree
  }

  const html = renderToStaticMarkup(createElement(Capture))
  return { html, tree }
}

function findElement(tree, type) {
  if (!isValidElement(tree)) {
    return undefined
  }
  if (tree.type === type) {
    return tree
  }
  for (const child of Children.toArray(tree.props.children)) {
    const found = findElement(child, type)
    if (found) {
      return found
    }
  }
  return undefined
}

test('renders method, hours, own scale and default step of ten', () => {
  const { html, tree } = render()
  const input = findElement(tree, 'input')

  assert.equal(input.props.type, 'range')
  assert.equal(input.props.min, 0)
  assert.equal(input.props.max, 400)
  assert.equal(input.props.step, 10)
  assert.equal(input.props.value, 80)
  assert.equal(input.props.disabled, false)
  assert.match(html, />TPM<\/label>/)
  assert.match(html, />80 h<\/output>/)
  assert.match(html, />0 h<\/span>/)
  assert.match(html, />400 h<\/span>/)
})

test('uses supplied bounds, step and explicit accessible identifier', () => {
  const { tree } = render({ min: 20, max: 200, step: 5, id: 'custom-slider' })
  const input = findElement(tree, 'input')

  assert.equal(input.props.id, 'custom-slider')
  assert.equal(findElement(tree, 'label').props.htmlFor, input.props.id)
  assert.equal(findElement(tree, 'output').props.htmlFor, input.props.id)
  assert.equal(input.props['aria-valuetext'], '80 h')
  assert.equal(input.props.min, 20)
  assert.equal(input.props.max, 200)
  assert.equal(input.props.step, 5)
})

test('generates distinct identifiers for multiple sliders', () => {
  const html = renderToStaticMarkup(createElement('div', null,
    createElement(DevelopmentSlider, { label: 'First', value: 0, max: 400, predictedLevel: 0, onChange: () => {} }),
    createElement(DevelopmentSlider, { label: 'Second', value: 10, max: 400, predictedLevel: 10, onChange: () => {} }),
  ))
  const ids = [...html.matchAll(/<input[^>]* id="([^"]+)"/g)].map((match) => match[1])

  assert.equal(ids.length, 2)
  assert.notEqual(ids[0], ids[1])
  for (const id of ids) {
    assert.ok(html.includes(`for="${id}"`))
  }
})

test('uses ProgressBar with supplied percentage without deriving it from hours', () => {
  const { html, tree } = render({ value: 200, predictedLevel: 12.5 })
  const progress = findElement(tree, ProgressBar)

  assert.equal(progress.props.value, 12.5)
  assert.equal(progress.props.maximum, 100)
  assert.equal(progress.props.label, 'Kehitystaso')
  assert.equal(progress.props.showValue, true)
  assert.match(html, /aria-valuetext="12.5%"/)
  assert.match(html, /style="width:12.5%"/)
})

test('forwards each numeric change immediately without modifying controlled props', () => {
  const received = []
  const { tree } = render({ onChange: (hours) => received.push(hours) })
  const input = findElement(tree, 'input')

  for (const nextHours of [90, 100, 110]) {
    input.props.onChange({ currentTarget: { valueAsNumber: nextHours } })
  }

  assert.deepEqual(received, [90, 100, 110])
  assert.equal(input.props.value, 80)
  assert.equal(findElement(tree, ProgressBar).props.value, 30)
})

test('renders hours and forecast returned by the caller, including a caller-limited value', () => {
  let value = 80
  let predictedLevel = 30
  const onChange = (nextHours) => {
    value = Math.min(nextHours, 90)
    predictedLevel = 35
  }
  const initial = render({ value, predictedLevel, onChange })

  findElement(initial.tree, 'input').props.onChange({ currentTarget: { valueAsNumber: 120 } })
  const updated = render({ value, predictedLevel, onChange })

  assert.equal(findElement(updated.tree, 'input').props.value, 90)
  assert.equal(findElement(updated.tree, 'input').props.max, 400)
  assert.match(updated.html, />90 h<\/output>/)
  assert.match(updated.html, /aria-valuetext="35%"/)
})

test('disabled and fixed-scale sliders do not emit changes', () => {
  for (const props of [{ disabled: true }, { min: 80, max: 80 }]) {
    const { tree } = render({ ...props, onChange: () => assert.fail('Must not emit a change') })
    const input = findElement(tree, 'input')

    assert.equal(input.props.disabled, true)
    input.props.onChange({ currentTarget: { valueAsNumber: 80 } })
  }
})

test('invalid ranges, steps and values disable the input and keep numeric attributes safe', () => {
  const invalidProps = [
    { min: NaN }, { min: Infinity }, { min: '0' },
    { max: undefined }, { max: null }, { max: Infinity }, { max: NaN }, { max: -1 },
    { step: 0 }, { step: -10 }, { step: NaN }, { step: Infinity }, { step: '10' },
    { value: NaN }, { value: Infinity }, { value: null }, { value: '80' },
    { value: -10 }, { value: 410 },
  ]

  for (const props of invalidProps) {
    const { html, tree } = render({ ...props, onChange: () => assert.fail('Must not emit a change') })
    const input = findElement(tree, 'input')

    assert.equal(input.props.disabled, true)
    for (const attribute of ['min', 'max', 'step', 'value']) {
      assert.ok(Number.isFinite(input.props[attribute]))
    }
    assert.doesNotMatch(html, /NaN|Infinity/)
    input.props.onChange({ currentTarget: { valueAsNumber: 100 } })
  }
})

test('ignores non-finite and out-of-scale input events', () => {
  const { tree } = render({ onChange: () => assert.fail('Must not emit an invalid value') })
  const input = findElement(tree, 'input')

  for (const valueAsNumber of [NaN, Infinity, -10, 410]) {
    input.props.onChange({ currentTarget: { valueAsNumber } })
  }
})

test('accepts endpoint values and fractional steps', () => {
  for (const value of [0, 400]) {
    assert.equal(findElement(render({ value }).tree, 'input').props.disabled, false)
  }
  const received = []
  const { tree } = render({ value: 0.5, min: 0, max: 2, step: 0.5, onChange: (hours) => received.push(hours) })

  findElement(tree, 'input').props.onChange({ currentTarget: { valueAsNumber: 1.5 } })
  assert.deepEqual(received, [1.5])
})

test('delegates invalid forecast rendering to ProgressBar without disabling valid hours', () => {
  const { html, tree } = render({ predictedLevel: NaN })

  assert.equal(findElement(tree, 'input').props.disabled, false)
  assert.match(html, /style="width:0%"/)
  assert.ok(html.includes('aria-valuetext="\u2013"'))
})