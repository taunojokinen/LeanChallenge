import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_FACTORY_SETTINGS } from '../entities/factory-settings/defaultFactorySettings.js'
import { createInitialGameState } from '../entities/factory-settings/initialGameState.js'
import { buildGameHeaderKpis } from './headerKpis.js'

test('header KPIs come from persisted round-0 state, not forecast output', () => {
  const gameState = createInitialGameState(DEFAULT_FACTORY_SETTINGS)
  const kpis = buildGameHeaderKpis(gameState, DEFAULT_FACTORY_SETTINGS)

  const revenue = kpis.find((kpi) => kpi.key === 'revenue')
  const result = kpis.find((kpi) => kpi.key === 'result')
  const production = kpis.find((kpi) => kpi.key === 'production')

  assert.ok(revenue)
  assert.ok(result)
  assert.ok(production)

  assert.equal(revenue.value.replace(/\s/g, ' '), '3 300 000 €')
  assert.equal(result.value.replace(/\s/g, ' ').replace(/−/g, '-'), '-340 625 €')
  assert.equal(production.value.replace(/\s/g, ' '), '132 kpl')
})