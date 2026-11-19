import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { pgOptions, readSettings, verifyConnection } from './round-pg-guard.js'
import { cleanupFixtures } from './round-pg-fixtures.js'

const env = {
  LC_IT_PEDASUS_IPV4: '192.0.2.1', LC_IT_PORT: '5432',
  LC_IT_APP_USER: 'round_app', LC_IT_APP_PASSWORD: 'dummy',
  LC_IT_FIXTURE_USER: 'round_fixture', LC_IT_FIXTURE_PASSWORD: 'dummy',
  LC_IT_TEACHER_ID: '1', LC_IT_SETUP_ID: '2',
}
const tunnelEnv = {
  ...env, LC_IT_CONNECTION_MODE: 'ssh-tunnel', LC_IT_PEDASUS_IPV4: undefined, LC_IT_PORT: undefined,
  LC_IT_APP_USER: 'lc_round_it_app', LC_IT_FIXTURE_USER: 'lc_round_it_fixture',
}

test('direct mode remains the default and does not allow loopback', () => {
  const settings = readSettings(env)
  assert.equal(settings.mode, 'direct')
  assert.equal(settings.serverAddress, '192.0.2.1')
  assert.equal(settings.serverPort, 5432)
  assert.deepEqual(readSettings({ ...env, LC_IT_CONNECTION_MODE: 'direct' }), settings)
  for (const address of ['127.0.0.1', '127.0.0.2', 'localhost', '0.0.0.0']) {
    assert.throws(() => readSettings({ ...env, LC_IT_PEDASUS_IPV4: address }), /IPv4/)
  }
  assert.throws(() => readSettings({ ...env, LC_IT_PORT: '65536' }), /portti/)
  assert.throws(() => readSettings({ ...env, LC_IT_CONNECTION_MODE: 'tunnel' }), /LC_IT_CONNECTION_MODE/)
})

test('SSH tunnel mode pins both endpoints and rejects overrides or other roles', () => {
  const settings = readSettings(tunnelEnv)
  assert.equal(settings.mode, 'ssh-tunnel')
  for (const credentials of [settings.app, settings.fixture]) {
    const { host, port, database } = pgOptions(settings, credentials, 'offline-test')
    assert.deepEqual({ host, port, database }, { host: '127.0.0.1', port: 15432, database: 'leanchallenge' })
  }
  assert.equal(settings.serverAddress, '127.0.0.1')
  assert.equal(settings.serverPort, 5432)
  for (const overrides of [{ LC_IT_PEDASUS_IPV4: '192.0.2.1' }, { LC_IT_PORT: '15432' }]) {
    assert.throws(() => readSettings({ ...tunnelEnv, ...overrides }), /Poista/)
  }
  assert.throws(() => readSettings({ ...tunnelEnv, LC_IT_APP_USER: 'other' }), /vaatii roolit/)
  assert.throws(() => readSettings({ ...tunnelEnv, LC_IT_FIXTURE_USER: 'other' }), /vaatii roolit/)
})

test('ordinary application settings cannot enable the integration runner', () => {
  assert.throws(() => readSettings({ DB_NAME: 'leanchallenge', DB_HOST: 'localhost' }), /LC_IT_PEDASUS_IPV4/)
  assert.throws(() => readSettings({ ...env, LC_IT_FIXTURE_USER: env.LC_IT_APP_USER }), /kaksi eri/)
  const command = fileURLToPath(new URL('./run-classroom-round.js', import.meta.url))
  const child = spawnSync(process.execPath, [command, '--live-pg'], { encoding: 'utf8', env, timeout: 5000 })
  assert.equal(child.status, 1)
  assert.match(child.stderr, /käynnistys/)
})

test('connection verification rejects a different database, endpoint, role or elevated role', async () => {
  const settings = readSettings(env)
  const values = {
    db: 'leanchallenge', address: settings.address, port: settings.port,
    role: settings.app.user, login: settings.app.user, elevated: false,
  }
  const client = (fields) => ({ query: async () => ({ rows: [{ ...values, ...fields }] }) })
  await verifyConnection(client({}), settings, settings.app)
  for (const fields of [
    { db: 'postgres' }, { address: '192.0.2.2' }, { port: 5433 }, { role: 'another_role' },
    { login: 'another_login' }, { elevated: true },
  ]) {
    await assert.rejects(verifyConnection(client(fields), settings, settings.app), /hyväksyttyä kohdetta/)
  }
})

test('SSH tunnel verifies the PostgreSQL endpoint and both login roles, not the local forwarding port', async () => {
  const settings = readSettings(tunnelEnv)
  for (const [credentials, other] of [[settings.app, settings.fixture], [settings.fixture, settings.app]]) {
    const values = {
      db: 'leanchallenge', address: '127.0.0.1', port: 5432,
      role: credentials.user, login: credentials.user, elevated: false,
    }
    const client = (fields) => ({ query: async () => ({ rows: [{ ...values, ...fields }] }) })
    await verifyConnection(client({}), settings, credentials)
    for (const fields of [
      { db: 'postgres' }, { address: '127.0.0.2' }, { address: null }, { port: 15432 }, { port: 5433 },
      { role: other.user }, { login: other.user }, { elevated: true },
    ]) {
      await assert.rejects(verifyConnection(client(fields), settings, credentials), /hyväksyttyä kohdetta/)
    }
  }
})

test('cleanup rolls back without deleting when a game has a session not owned by the run', async () => {
  const owned = [{ marker: 'LC-ROUND-IT-test-batch', gameId: '51', sessionId: '52', round: 1 }]
  const calls = []
  const pool = {
    connect: async () => ({
      query: async (sql) => {
        calls.push(sql)
        if (sql.includes('public.games')) return {
          rows: [{ name: owned[0].marker, join_code: owned[0].marker, teacher_id: '1', setup_id: '2' }],
        }
        if (sql.includes('SELECT id::text')) return {
          rows: [{ id: '52', player_name: owned[0].marker, mode: 'classroom' }, { id: '53' }],
        }
      },
      release() {},
    }),
  }
  await assert.rejects(cleanupFixtures(pool, readSettings(env), owned), /viitteet eivät vastaa/)
  assert.ok(calls.every((sql) => !sql.startsWith('DELETE')))
  assert.equal(calls.at(-1), 'ROLLBACK')
})
