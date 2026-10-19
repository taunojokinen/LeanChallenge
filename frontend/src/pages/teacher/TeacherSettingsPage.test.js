import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import {
  TEACHER_SETTING_DEFINITIONS,
  TEACHER_FIXED_STARTING_VALUES,
  TEACHER_SETTING_GROUPS,
  createDefaultTeacherPreferences,
  getTeacherSelectedValue,
  getTeacherSliderStepCount,
} from '../../entities/factory-settings/teacherGameSettings.js'

let server
let cacheDir
let html

before(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), 'teacher-settings-page-test-'))
  server = await createServer({
    root: fileURLToPath(new URL('../../../', import.meta.url)),
    cacheDir,
    logLevel: 'warn',
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: 'custom',
  })
  const { default: TeacherSettingsPage } = await server.ssrLoadModule('/src/pages/teacher/TeacherSettingsPage.jsx')
  html = renderToStaticMarkup(
    createElement(TeacherSettingsPage, { onBackToLogin() {}, onStartTestGame() {} }),
  )
})

after(async () => {
  try {
    await server?.close()
  } finally {
    if (cacheDir) await rm(cacheDir, { recursive: true, force: true })
  }
})

test('teacher settings follow the presentation order without changing model groups', () => {
  const headings = [...html.matchAll(/<h2 id="group-title-[^"]+">([^<]+)<\/h2>/g)]
  const groupOrder = ['result', 'balance', 'development', 'production', 'market']
  assert.deepEqual(headings.map((match) => match[1]),
    groupOrder.map((id) => TEACHER_SETTING_GROUPS.find((group) => group.id === id).label))
  assert.deepEqual(TEACHER_SETTING_GROUPS.map((group) => group.id),
    ['result', 'balance', 'production', 'development', 'market'])
  assert.doesNotMatch(html, /Valitun pelin yhteenveto|teacher-settings-summary/)
})

test('teacher settings retain every boundary, slider, selected value, default and explanation', () => {
  const preferences = createDefaultTeacherPreferences()
  const rows = [...html.matchAll(/<article class="teacher-setting-row">([\s\S]*?)<\/article>/g)]
  assert.equal(rows.length, TEACHER_SETTING_DEFINITIONS.length)

  for (const definition of TEACHER_SETTING_DEFINITIONS) {
    const row = rows.find((match) => match[1].includes(`id="setting-position-${definition.id}"`))[1]
    const fields = [...row.matchAll(/<input ([^>]+)>/g)].map((match) => match[1])
    assert.equal(fields.length, 3)
    assert.ok(row.includes(definition.label))
    assert.ok(row.includes(definition.help))
    for (const [field, input] of [['easy', fields[0]], ['hard', fields[1]]]) {
      assert.ok(input.includes(`min="${definition.min}"`))
      assert.ok(input.includes(`max="${definition.max}"`))
      assert.ok(input.includes('step="any"'))
      assert.ok(input.includes(`value="${preferences[definition.id][field]}"`))
    }
    assert.ok(fields[2].includes(`id="setting-position-${definition.id}"`))
    assert.ok(fields[2].includes('type="range"'))
    assert.ok(fields[2].includes('min="0"'))
    assert.ok(fields[2].includes(`max="${getTeacherSliderStepCount(definition.id, preferences)}"`))
    assert.ok(fields[2].includes('step="1"'))
    assert.ok(fields[2].includes(`value="${preferences[definition.id].position}"`))
    const value = new Intl.NumberFormat('fi-FI', {
      maximumFractionDigits: definition.step < 1 ? 1 : 0,
    }).format(getTeacherSelectedValue(definition.id, preferences))
    assert.ok(row.includes(`>${value} ${definition.unit}</output>`))
    assert.ok(row.includes(`Moottorin oletus ${value} ${definition.unit}`))
  }
})

test('production and market sections retain their original parameter order', () => {
  for (const groupId of ['production', 'market']) {
    const section = html.match(new RegExp(`<section class="teacher-settings-group group-${groupId}"[\\s\\S]*?</section>`))[0]
    const labels = [...section.matchAll(/<strong>([^<]+)<\/strong>/g)].map((match) => match[1])
    assert.deepEqual(labels,
      TEACHER_SETTING_DEFINITIONS.filter((definition) => definition.group === groupId).map((definition) => definition.label))
  }
})

test('fixed starting values are not presented while the original actions and status remain available', () => {
  assert.doesNotMatch(html, /teacher-fixed-start-values/)
  for (const item of TEACHER_FIXED_STARTING_VALUES) {
    assert.ok(!html.includes(item.label))
    assert.ok(!html.includes(item.help))
  }
  for (const label of [
    'Palauta oletusasetukset',
    'Tallenna asetukset',
    'Kokeile peliä näillä asetuksilla',
  ]) {
    assert.ok(html.includes(`>${label}</button>`))
  }
  assert.ok(html.includes('aria-label="Takaisin kirjautumiseen"'))
  assert.ok(html.includes('role="status" aria-live="polite"'))
  assert.ok(html.includes('Käynnistys luo peliin oman asetussnapshotin.'))
  assert.ok(html.includes('Tallennus on selainkohtainen.'))
})
