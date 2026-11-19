import assert from 'node:assert/strict'
import { isIPv4 } from 'node:net'

export const database = 'leanchallenge'
export const tables = {
  games: 'id:bigint teacher_id:bigint setup_id:bigint name:text join_code:text',
  game_sessions: 'id:bigint game_id:bigint mode:text player_name:text started_at:timestamptz finished_at:timestamptz completion_reason:text access_token_hash:bytea access_token_expires_at:timestamptz access_token_revoked_at:timestamptz server_round_confirmation_enabled:bool',
  classroom_game_states: 'session_id:bigint schema_version:smallint factory_settings:jsonb initial_game_state:jsonb current_game_state:jsonb state_version:bigint updated_at:timestamptz',
  round_decisions: 'game_session_id:bigint round_number:integer act_decision:jsonb check_staffing_decision:jsonb check_production_decision:jsonb investments_decision:jsonb five_s_decision:jsonb projects_decision:jsonb',
  round_results: 'game_session_id:bigint round_number:integer knl:numeric(6,2) production:integer revenue:numeric(14,2) result:numeric(14,2) equity:numeric(14,2) inventory_turnover:numeric(10,2)',
}
const relations = Object.keys(tables)
const decisionTables = ['round_decisions', 'round_results']

function readEndpoints(env, required) {
  const mode = env.LC_IT_CONNECTION_MODE ?? 'direct'
  assert.ok(mode === 'direct' || mode === 'ssh-tunnel', 'LC_IT_CONNECTION_MODE: käytä direct tai ssh-tunnel')
  if (mode === 'ssh-tunnel') {
    assert.ok(env.LC_IT_PEDASUS_IPV4 === undefined && env.LC_IT_PORT === undefined,
      'Poista LC_IT_PEDASUS_IPV4 ja LC_IT_PORT tunnelitilassa')
    return { mode, address: '127.0.0.1', port: 15432, serverAddress: '127.0.0.1', serverPort: 5432 }
  }
  const address = required('PEDASUS_IPV4')
  assert.ok(isIPv4(address) && !address.startsWith('127.') && address !== '0.0.0.0', 'Anna Pedasuksen IPv4-osoite')
  const port = required('PORT')
  assert.ok(/^[1-9]\d{0,4}$/.test(port) && Number(port) <= 65535, 'Virheellinen testikannan portti')
  return { mode, address, port: Number(port), serverAddress: address, serverPort: Number(port) }
}

export function readSettings(env) {
  const required = (name) => {
    const value = env[`LC_IT_${name}`]
    assert.ok(value?.trim(), `LC_IT_${name} puuttuu`)
    return value
  }
  const endpoints = readEndpoints(env, required)
  const id = (name) => {
    const value = required(name)
    assert.ok(/^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n, `Virheellinen LC_IT_${name}`)
    return value
  }
  const app = { user: required('APP_USER'), password: required('APP_PASSWORD') }
  const fixture = { user: required('FIXTURE_USER'), password: required('FIXTURE_PASSWORD') }
  assert.ok(app.user !== fixture.user, 'Tarvitaan kaksi eri testiroolia')
  if (endpoints.mode === 'ssh-tunnel') {
    assert.ok(app.user === 'lc_round_it_app' && fixture.user === 'lc_round_it_fixture',
      'Tunnelitila vaatii roolit lc_round_it_app ja lc_round_it_fixture')
  }
  return { ...endpoints, app, fixture, teacher: id('TEACHER_ID'), setup: id('SETUP_ID') }
}

export const pgOptions = (settings, credentials, tag) => ({
  ...credentials, host: settings.address, port: settings.port, database,
  application_name: tag, connectionTimeoutMillis: 5000,
  options: '-c search_path=public,pg_catalog -c statement_timeout=12000 -c lock_timeout=10000 -c idle_in_transaction_session_timeout=15000',
})

export async function verifyConnection(client, settings, credentials) {
  const { rows: [info] } = await client.query(`
    SELECT current_database() AS db, current_user AS role, session_user AS login,
           host(inet_server_addr()) AS address, inet_server_port() AS port,
           rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls AS elevated
    FROM pg_roles WHERE rolname = current_user`)
  assert.ok(info?.db === database && info.role === credentials.user && info.login === credentials.user &&
    info.address === settings.serverAddress && info.port === settings.serverPort && info.elevated === false,
  'Yhteys ei vastaa hyväksyttyä kohdetta tai roolilla on ylläpito-oikeuksia')
}

export async function verifySchema(client) {
  const { rows } = await client.query(`
    SELECT c.relname AS tbl, a.attname AS col, format_type(a.atttypid, a.atttypmod) AS type,
           a.attnotnull AS required, pg_get_expr(d.adbin, d.adrelid) AS default_value
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
    WHERE n.nspname = 'public' AND c.relname = ANY($1) AND c.relkind = 'r'
      AND a.attnum > 0 AND NOT a.attisdropped`, [relations])
  const columns = new Map(rows.map((row) => [`${row.tbl}.${row.col}`, row]))
  const aliases = { timestamptz: 'timestamp with time zone', bool: 'boolean' }
  for (const [table, list] of Object.entries(tables)) {
    for (const entry of list.split(' ')) {
      const [column, type] = entry.split(':')
      assert.equal(columns.get(`${table}.${column}`)?.type, aliases[type] ?? type, `${table}.${column}`)
    }
  }
  const enabled = columns.get('game_sessions.server_round_confirmation_enabled')
  assert.ok(enabled.required && enabled.default_value === 'false', 'Käyttöoikeuden oletuksen on oltava NOT NULL DEFAULT FALSE')

  const { rows: [shape] } = await client.query(`
    SELECT ARRAY(
      SELECT format('%s.%s>%s.%s', c.relname, a.attname, p.relname, b.attname)
      FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_class p ON p.oid=k.confrelid
      JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.conkey[1]
      JOIN pg_attribute b ON b.attrelid=p.oid AND b.attnum=k.confkey[1]
      WHERE k.contype='f' AND (k.conrelid=ANY($1::regclass[]) OR k.confrelid=ANY($1::regclass[]))
        AND cardinality(k.conkey)=1 AND k.convalidated
    ) AS fks,
    (SELECT count(*)::int FROM pg_constraint k WHERE k.contype='f'
      AND (k.conrelid=ANY($1::regclass[]) OR k.confrelid=ANY($1::regclass[]))) AS fk_count,
    EXISTS (SELECT FROM pg_trigger WHERE NOT tgisinternal AND tgrelid=ANY($1::regclass[])) AS triggers,
    EXISTS (SELECT FROM pg_class WHERE oid=ANY($1::regclass[]) AND (relhasrules OR relrowsecurity)) AS rules,
    ARRAY(
      SELECT c.relname::text FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid
      WHERE i.indrelid=ANY($2::regclass[]) AND i.indisunique AND i.indisvalid AND i.indimmediate
        AND i.indpred IS NULL AND i.indnkeyatts=2
        AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
             FROM pg_attribute a WHERE a.attrelid=i.indrelid AND a.attnum IN (i.indkey[0], i.indkey[1]))
            = ARRAY['game_session_id','round_number']
    ) AS unique_rounds`, [relations.map((name) => `public.${name}`), decisionTables.map((name) => `public.${name}`)])
  const expected = [
    'games.teacher_id>teachers.id', 'games.setup_id>setup.id', 'game_sessions.game_id>games.id',
    'classroom_game_states.session_id>game_sessions.id', 'round_decisions.game_session_id>game_sessions.id',
    'round_results.game_session_id>game_sessions.id',
  ]
  assert.equal(shape.fk_count, expected.length, 'Odottamaton viiteavain')
  assert.deepEqual(shape.fks.sort(), expected.sort(), 'Viiteavaimet eivät vastaa siivoussuunnitelmaa')
  assert.ok(!shape.rules && !shape.triggers, 'Testitauluissa on odottamattomia triggereitä tai sääntöjä')
  assert.deepEqual([...new Set(shape.unique_rounds)].sort(), decisionTables, 'Kierrosten yksilöllisyys puuttuu')
}

export async function verifyPrivileges(appPool, fixturePool) {
  const check = async (pool, table, column, privilege) => {
    const { rows: [{ allowed }] } = column
      ? await pool.query('SELECT has_column_privilege($1, $2, $3) AS allowed', [`public.${table}`, column, privilege])
      : await pool.query('SELECT has_table_privilege($1, $2) AS allowed', [`public.${table}`, privilege])
    return allowed
  }
  for (const table of relations) {
    assert.ok(await check(fixturePool, table, null, 'SELECT') &&
      await check(fixturePool, table, null, 'INSERT') && await check(fixturePool, table, null, 'DELETE'),
    `Aineistoroolin oikeudet puuttuvat: ${table}`)
    assert.ok(await check(appPool, table, null, 'SELECT') && !await check(appPool, table, null, 'DELETE') &&
      !await check(appPool, table, null, 'TRUNCATE'), `Sovellusroolin oikeudet eivät vastaa rajausta: ${table}`)
  }
  for (const table of decisionTables) assert.ok(await check(appPool, table, null, 'INSERT'), `INSERT puuttuu: ${table}`)
  for (const table of ['games', 'game_sessions', 'classroom_game_states']) {
    assert.ok(!await check(appPool, table, null, 'INSERT'), `Sovellusroolilla on ylimääräinen INSERT-oikeus: ${table}`)
  }
  for (const [table, fields] of Object.entries({
    game_sessions: ['finished_at', 'completion_reason'],
    classroom_game_states: ['current_game_state', 'state_version', 'updated_at'],
  })) {
    for (const column of fields) assert.ok(await check(appPool, table, column, 'UPDATE'), `UPDATE puuttuu: ${table}.${column}`)
  }
  assert.ok(!await check(appPool, 'game_sessions', 'server_round_confirmation_enabled', 'UPDATE'),
    'Sovellusrooli ei saa muuttaa palvelinvahvistuksen oikeutusta')
  for (const table of ['games', 'game_sessions']) {
    const column = table === 'games' ? 'name' : 'player_name'
    assert.ok(await check(fixturePool, table, column, 'UPDATE'), `Rivilukituksen vaatima UPDATE puuttuu: ${table}.${column}`)
  }
}
