import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchTeacherGames, createTeacherGame } from './teacherGamesApi.js'

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

test('fetchTeacherGames returns games list on success', async () => {
  const games = [
    { id: '1', name: 'Testipeli', joinCode: 'LEAN-1234', setupName: 'Kisälli' },
    { id: '2', name: 'Toinen peli', joinCode: 'LEAN-5678', setupName: 'Oppipoika' },
  ]
  mockFetch(200, games)

  const result = await fetchTeacherGames()
  assert.deepEqual(result, games)
})

test('fetchTeacherGames returns empty array when no games', async () => {
  mockFetch(200, [])

  const result = await fetchTeacherGames()
  assert.deepEqual(result, [])
})

test('fetchTeacherGames throws 401 when not authenticated', async () => {
  mockFetch(401, { message: 'Kirjautuminen vaaditaan' })

  await assert.rejects(
    () => fetchTeacherGames(),
    (error) => {
      assert.equal(error.status, 401)
      assert.equal(error.message, 'Kirjautuminen vaaditaan')
      return true
    }
  )
})

test('fetchTeacherGames throws network error when server is unreachable', async () => {
  globalThis.fetch = async () => { throw new TypeError('fetch failed') }

  await assert.rejects(
    () => fetchTeacherGames(),
    (error) => {
      assert.equal(error.status, 0)
      assert.match(error.message, /yhteyttä/)
      return true
    }
  )
})

test('fetchTeacherGames throws generic error for other failures', async () => {
  mockFetch(500, { message: 'Internal error' })

  await assert.rejects(
    () => fetchTeacherGames(),
    (error) => {
      assert.equal(error.status, 500)
      assert.match(error.message, /epäonnistui/)
      return true
    }
  )
})

test('createTeacherGame returns new game on success', async () => {
  const newGame = { id: '3', name: 'Uusi peli', joinCode: 'LEAN-AB12CD', setupName: 'Mestari' }
  mockFetch(201, newGame)

  const result = await createTeacherGame('Uusi peli', 3)
  assert.deepEqual(result, newGame)
})

test('createTeacherGame throws 400 for invalid input', async () => {
  mockFetch(400, { message: 'Pelin nimi vaaditaan' })

  await assert.rejects(
    () => createTeacherGame('', 1),
    (error) => {
      assert.equal(error.status, 400)
      assert.equal(error.message, 'Pelin nimi vaaditaan')
      return true
    }
  )
})

test('createTeacherGame throws 401 when not authenticated', async () => {
  mockFetch(401, { message: 'Kirjautuminen vaaditaan' })

  await assert.rejects(
    () => createTeacherGame('Testi', 1),
    (error) => {
      assert.equal(error.status, 401)
      return true
    }
  )
})

test('createTeacherGame throws network error when server is unreachable', async () => {
  globalThis.fetch = async () => { throw new TypeError('fetch failed') }

  await assert.rejects(
    () => createTeacherGame('Testi', 1),
    (error) => {
      assert.equal(error.status, 0)
      assert.match(error.message, /yhteyttä/)
      return true
    }
  )
})
