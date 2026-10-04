import test, { before, after } from 'node:test'
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
let ProgressBar

before(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), 'progress-bar-test-'))
  server = await createServer({
    root: fileURLToPath(new URL('../../../', import.meta.url)),
    cacheDir,
    logLevel: 'warn',
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: 'custom',
  })
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
  return renderToStaticMarkup(createElement(ProgressBar, {
    value: 30,
    maximum: 100,
    label: 'Development',
    ...props,
  }))
}

test('renders label, relative width, default value and accessible range', () => {
  const html = render({ value: 310, maximum: 400 })

  assert.match(html, /class="progress-bar__label">Development<\/span>/)
  assert.match(html, /style="width:77.5%"/)
  assert.match(html, /class="progress-bar__value">310 \/ 400<\/span>/)
  assert.match(html, /role="progressbar"/)
  assert.match(html, /aria-label="Development"/)
  assert.match(html, /aria-valuemin="0"/)
  assert.match(html, /aria-valuemax="400"/)
  assert.match(html, /aria-valuenow="310"/)
  assert.match(html, /aria-valuetext="310 \/ 400"/)
})

test('showValue hides only the visible value, not the accessible value', () => {
  const html = render({ showValue: false })

  assert.doesNotMatch(html, /class="progress-bar__value"/)
  assert.match(html, /progress-bar--without-value/)
  assert.match(html, /aria-valuetext="30 \/ 100"/)
  assert.match(html, /aria-label="Development"/)
})

test('custom formatter receives original value and maximum', () => {
  const html = render({
    value: 450,
    maximum: 400,
    formatValue: (value, maximum) => `${value} of ${maximum} h`,
  })

  assert.match(html, /aria-valuetext="450 of 400 h"/)
  assert.match(html, /class="progress-bar__value">450 of 400 h<\/span>/)
})

test('clamps fill and ARIA value while preserving out-of-range display values', () => {
  for (const [value, width, boundedValue] of [[-10, 0, 0], [0, 0, 0], [100, 100, 100], [150, 100, 100]]) {
    const html = render({ value })

    assert.ok(html.includes(`style="width:${width}%"`))
    assert.ok(html.includes(`aria-valuenow="${boundedValue}"`))
    assert.ok(html.includes(`aria-valuetext="${value} / 100"`))
  }
})

test('invalid values render empty determinate bars with safe ARIA attributes', () => {
  const invalidProps = [
    { value: NaN }, { value: Infinity }, { value: -Infinity },
    { value: undefined }, { value: null }, { value: '30' },
    { maximum: 0 }, { maximum: -1 }, { maximum: NaN },
    { maximum: Infinity }, { maximum: -Infinity },
    { maximum: undefined }, { maximum: null }, { maximum: '100' },
  ]

  for (const props of invalidProps) {
    const html = render({
      ...props,
      formatValue: () => assert.fail('Invalid inputs must not reach the formatter'),
    })
    const maximum = Object.hasOwn(props, 'maximum') ? props.maximum : 100
    const expectedMaximum = Number.isFinite(maximum) && maximum > 0 ? maximum : 1

    assert.match(html, /style="width:0%"/)
    assert.match(html, /aria-valuenow="0"/)
    assert.ok(html.includes(`aria-valuemax="${expectedMaximum}"`))
    assert.ok(html.includes('aria-valuetext="\u2013"'))
    assert.doesNotMatch(html, /NaN|Infinity/)
  }
})

test('handles fractional and very large finite numbers without overflowing the width', () => {
  assert.match(render({ value: 0.5, maximum: 2 }), /style="width:25%"/)
  assert.match(render({ value: Number.MAX_VALUE, maximum: Number.MAX_VALUE }), /style="width:100%"/)
})

test('renders label and formatted value as escaped text', () => {
  const html = render({ label: '<script>', formatValue: () => '<b>30%</b>' })

  assert.match(html, /aria-label="&lt;script&gt;"/)
  assert.match(html, /&lt;b&gt;30%&lt;\/b&gt;/)
  assert.doesNotMatch(html, /<script>|<b>/)
})