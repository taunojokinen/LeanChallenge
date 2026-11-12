import test from 'node:test'
import assert from 'node:assert/strict'
import { loginTeacher, fetchCurrentTeacher, logoutTeacher } from './authApi.js'

// Korvataan fetch testeissä — ei tarvita oikeaa palvelinta
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

test('loginTeacher returns teacher data on success', async () => {
  const teacher = { id: '1', username: 'ope', displayName: 'Opettaja' }
  mockFetch(200, teacher)

  const result = await loginTeacher('ope', 'salasana')
  assert.deepEqual(result, teacher)
})

test('loginTeacher throws 401 error for wrong credentials', async () => {
  mockFetch(401, { message: 'Virheellinen käyttäjätunnus tai salasana' })

  await assert.rejects(
    () => loginTeacher('ope', 'vaara'),
    (error) => {
      assert.equal(error.status, 401)
      assert.equal(error.message, 'Virheellinen käyttäjätunnus tai salasana')
      return true
    }
  )
})

test('loginTeacher throws 429 error for rate limiting', async () => {
  mockFetch(429, { message: 'Liikaa yrityksiä' })

  await assert.rejects(
    () => loginTeacher('ope', 'salasana'),
    (error) => {
      assert.equal(error.status, 429)
      assert.match(error.message, /Liikaa/)
      return true
    }
  )
})

test('loginTeacher throws network error when server is unreachable', async () => {
  globalThis.fetch = async () => { throw new TypeError('fetch failed') }

  await assert.rejects(
    () => loginTeacher('ope', 'salasana'),
    (error) => {
      assert.equal(error.status, 0)
      assert.match(error.message, /yhteyttä/)
      return true
    }
  )
})

test('fetchCurrentTeacher returns teacher when authenticated', async () => {
  const teacher = { id: '1', username: 'ope', displayName: 'Opettaja' }
  mockFetch(200, teacher)

  const result = await fetchCurrentTeacher()
  assert.deepEqual(result, teacher)
})

test('fetchCurrentTeacher returns null when not authenticated', async () => {
  mockFetch(401)

  const result = await fetchCurrentTeacher()
  assert.equal(result, null)
})

test('fetchCurrentTeacher returns null on network error', async () => {
  globalThis.fetch = async () => { throw new TypeError('fetch failed') }

  const result = await fetchCurrentTeacher()
  assert.equal(result, null)
})

test('logoutTeacher does not throw on network error', async () => {
  globalThis.fetch = async () => { throw new TypeError('fetch failed') }

  await logoutTeacher() // Ei saa heittää virhettä
})
