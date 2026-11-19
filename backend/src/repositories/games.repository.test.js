import test from 'node:test'
import assert from 'node:assert/strict'
import pool from '../db/pool.js'
import { createGameSessionWithInitialState } from './games.repository.js'

function createTransactionClient({ sessionId = '42', existingState = null, failStateInsert = false } = {}) {
  const queries = []
  const sessions = new Map()
  const states = new Map(existingState ? [[sessionId, structuredClone(existingState)]] : [])
  let transactionSnapshot = null

  return {
    queries,
    sessions,
    states,
    client: {
      async query(sql, params = []) {
        const normalizedSql = sql.trim().replace(/\s+/g, ' ')
        queries.push({ sql: normalizedSql, params })

        if (normalizedSql === 'BEGIN') {
          transactionSnapshot = {
            sessions: new Map(sessions),
            states: new Map(Array.from(states, ([id, state]) => [id, structuredClone(state)])),
          }
          return { rows: [] }
        }

        if (normalizedSql.startsWith('INSERT INTO game_sessions')) {
          sessions.set(sessionId, {
            gameId: params[0],
            playerName: params[1],
            accessTokenHash: params[2],
          })
          return { rows: [{ id: sessionId }] }
        }

        if (normalizedSql.startsWith('INSERT INTO public.classroom_game_states')) {
          if (failStateInsert) {
            throw new Error('test state insert failure')
          }
          if (states.has(params[0])) {
            throw new Error('duplicate key value violates unique constraint')
          }

          states.set(params[0], {
            schemaVersion: 1,
            factorySettings: JSON.parse(params[1]),
            initialGameState: JSON.parse(params[2]),
            currentGameState: JSON.parse(params[2]),
            stateVersion: 1,
          })
          return { rows: [] }
        }

        if (normalizedSql === 'COMMIT') {
          transactionSnapshot = null
          return { rows: [] }
        }

        if (normalizedSql === 'ROLLBACK') {
          sessions.clear()
          states.clear()
          for (const [id, session] of transactionSnapshot.sessions) sessions.set(id, session)
          for (const [id, state] of transactionSnapshot.states) states.set(id, state)
          transactionSnapshot = null
          return { rows: [] }
        }

        throw new Error(`Unexpected query: ${normalizedSql}`)
      },
      release() {},
    },
  }
}

async function withTransactionClient(options, callback) {
  const originalConnect = pool.connect
  const transaction = createTransactionClient(options)
  pool.connect = async () => transaction.client

  try {
    await callback(transaction)
  } finally {
    pool.connect = originalConnect
  }
}

const factorySettings = {
  costs: { annualFixedCosts: 1600000 },
  initialState: { finance: { equity: 2073975 } },
}
const initialGameState = {
  round: 1,
  historySeed: 123456789,
  finance: { equity: 2073975 },
  initialFinancialHistory: [{ round: 0, finance: { equity: 2073975 } }],
}

test('creates the classroom session and identical initial/current snapshots in one transaction', async () => {
  await withTransactionClient({}, async ({ queries, sessions, states }) => {
    const session = await createGameSessionWithInitialState({
      gameId: '7',
      playerName: 'Pelaaja',
      accessTokenHash: Buffer.from('token-hash'),
      factorySettings,
      initialGameState,
    })

    assert.deepEqual(session, { id: '42' })
    assert.deepEqual(queries.map(({ sql }) => sql === 'BEGIN' || sql === 'COMMIT'
      ? sql
      : sql.startsWith('INSERT INTO game_sessions')
        ? 'INSERT game session'
        : 'INSERT classroom game state'), [
      'BEGIN',
      'INSERT game session',
      'INSERT classroom game state',
      'COMMIT',
    ])
    assert.deepEqual(sessions.get('42'), {
      gameId: '7',
      playerName: 'Pelaaja',
      accessTokenHash: Buffer.from('token-hash'),
    })
    assert.deepEqual(states.get('42'), {
      schemaVersion: 1,
      factorySettings,
      initialGameState,
      currentGameState: initialGameState,
      stateVersion: 1,
    })

    const stateInsert = queries.find(({ sql }) => sql.startsWith('INSERT INTO public.classroom_game_states'))
    assert.match(stateInsert.sql, /VALUES \(\$1, 1, \$2::jsonb, \$3::jsonb, \$3::jsonb, 1\)/)
    assert.doesNotMatch(stateInsert.sql, /ON CONFLICT/i)
  })
})

test('rolls back the new game session when saving its initial state fails', async () => {
  await withTransactionClient({ failStateInsert: true }, async ({ queries, sessions, states }) => {
    await assert.rejects(
      createGameSessionWithInitialState({
        gameId: '7',
        playerName: 'Pelaaja',
        accessTokenHash: Buffer.from('token-hash'),
        factorySettings,
        initialGameState,
      }),
      /test state insert failure/,
    )

    assert.deepEqual(queries.map(({ sql }) => sql === 'BEGIN' || sql === 'ROLLBACK'
      ? sql
      : sql.startsWith('INSERT INTO game_sessions')
        ? 'INSERT game session'
        : 'INSERT classroom game state'), [
      'BEGIN',
      'INSERT game session',
      'INSERT classroom game state',
      'ROLLBACK',
    ])
    assert.equal(sessions.size, 0)
    assert.equal(states.size, 0)
  })
})

test('a duplicate state key is rejected without replacing the existing state', async () => {
  const existingState = {
    schemaVersion: 1,
    factorySettings: { marker: 'existing-settings' },
    initialGameState: { marker: 'existing-initial' },
    currentGameState: { marker: 'existing-current' },
    stateVersion: 3,
  }

  await withTransactionClient({ existingState }, async ({ states }) => {
    await assert.rejects(
      createGameSessionWithInitialState({
        gameId: '7',
        playerName: 'Pelaaja',
        accessTokenHash: Buffer.from('token-hash'),
        factorySettings,
        initialGameState,
      }),
      /duplicate key/,
    )

    assert.deepEqual(states.get('42'), existingState)
  })
})
