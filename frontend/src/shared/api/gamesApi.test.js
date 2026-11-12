import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeJoinCode, fetchGameByJoinCode } from './gamesApi.js'

const originalFetch = globalThis.fetch

function mockFetch(status, body = {}) {
  globalThis.fetch = async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })
}

test.afterEach(() => {
  globalThis.fetch = originalFetch
})

test('normalizeJoinCode trims whitespace and converts to uppercase', () => {
  assert.equal(normalizeJoinCode('lean-1234'), 'LEAN-1234')
  assert.equal(normalizeJoinCode('Lean-1234'), 'LEAN-1234')
  assert.equal(normalizeJoinCode('LEAN-1234'), 'LEAN-1234')
  assert.equal(normalizeJoinCode('  lean-1234  '), 'LEAN-1234')
  assert.equal(normalizeJoinCode('  Lean-1234 '), 'LEAN-1234')
  assert.equal(normalizeJoinCode('\tLEAN-1234\n'), 'LEAN-1234')
})

test('normalizeJoinCode handles empty and whitespace-only input', () => {
  assert.equal(normalizeJoinCode(''), '')
  assert.equal(normalizeJoinCode('   '), '')
})

test('fetchGameByJoinCode sends POST with playerName in JSON body', async () => {
  let calledUrl = ''
  let calledOptions = {}
  globalThis.fetch = async (url, options) => {
    calledUrl = url
    calledOptions = options
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: '1', name: 'Testipeli', sessionId: '42' }),
    }
  }

  await fetchGameByJoinCode('lean-1234', '  Testi Pelaaja  ')

  assert.ok(calledUrl.includes('/api/games/join/LEAN-1234'))
  assert.equal(calledOptions.method, 'POST')
  assert.deepEqual(JSON.parse(calledOptions.body), { playerName: 'Testi Pelaaja' })
})

test('fetchGameByJoinCode sends Content-Type and X-Requested-With headers', async () => {
  let calledOptions = {}
  globalThis.fetch = async (url, options) => {
    calledOptions = options
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: '1', name: 'Testipeli', sessionId: '42' }),
    }
  }

  await fetchGameByJoinCode('LEAN-1234', 'Pelaaja')

  assert.equal(calledOptions.headers['Content-Type'], 'application/json')
  assert.equal(calledOptions.headers['X-Requested-With'], 'XMLHttpRequest')
})

test('fetchGameByJoinCode returns sessionId from response', async () => {
  mockFetch(200, { id: '1', name: 'Testipeli', sessionId: '42', setup: {} })

  const result = await fetchGameByJoinCode('LEAN-1234', 'Pelaaja')
  assert.equal(result.sessionId, '42')
})

test('fetchGameByJoinCode throws 404 for unknown code', async () => {
  mockFetch(404, { message: 'Peliä ei löytynyt' })

  await assert.rejects(
    () => fetchGameByJoinCode('EI-OLE-0000', 'Pelaaja'),
    (error) => {
      assert.equal(error.status, 404)
      assert.match(error.message, /ei löytynyt/)
      return true
    }
  )
})
