import {
  findGameByJoinCode,
  createGameSessionWithInitialState,
  findAuthorizedClassroomState,
} from '../repositories/games.repository.js'
import { buildFactorySettingsFromSetup } from '../../../shared/factory-settings/setupToFactorySettings.js'
import { createInitialGameState } from '../../../shared/factory-settings/initialGameState.js'
import {
  CLASSROOM_SESSION_COOKIE,
  classroomCookieOptions,
  createClassroomToken,
  hashClassroomToken,
  readClassroomToken,
} from '../auth/classroomSession.js'

export async function joinGame(req, res) {
  const { joinCode } = req.params
  const { playerName } = req.body ?? {}

  if (!playerName || typeof playerName !== 'string' || playerName.trim().length === 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Pelaajan nimi vaaditaan',
    })
  }

  try {
    const row = await findGameByJoinCode(joinCode)

    if (!row) {
      return res.status(404).json({
        status: 'error',
        message: 'Peliä ei löytynyt annetulla liittymiskoodilla',
      })
    }

    // Luodaan peli-istunto vasta kun liittymiskoodi on varmistettu oikeaksi
    const token = createClassroomToken()
    const setup = {
      fixedCostsQuarter: row.fixed_costs_quarter,
      initialEquity: row.initial_equity,
      newMachinePrice: row.new_machine_price,
      setupTimeHours: row.setup_time_hours,
      initialBatchSize: row.initial_batch_size,
      factoryAreaM2: row.factory_area_m2,
      knlTimeConstantHours: row.knl_time_constant_hours,
      goodQualityThreshold: row.good_quality_threshold,
      excellentQualityThreshold: row.excellent_quality_threshold,
    }
    const factorySettings = buildFactorySettingsFromSetup(setup)
    const initialGameState = createInitialGameState(factorySettings)
    const session = await createGameSessionWithInitialState({
      gameId: row.id,
      playerName: playerName.trim(),
      accessTokenHash: hashClassroomToken(token),
      factorySettings,
      initialGameState,
    })

    res.cookie(CLASSROOM_SESSION_COOKIE, token, classroomCookieOptions())
    res.set('Cache-Control', 'no-store')
    // Muotoillaan vastaus: setup-asetukset omaan objektiinsa.
    // Opettajan tietoja (teacher_id) ei palauteta.
    res.json({
      id: row.id,
      name: row.name,
      joinCode: row.join_code,
      sessionId: String(session.id),
      setup: {
        id: row.setup_id,
        name: row.setup_name,
        version: row.version,
        fixedCostsQuarter: row.fixed_costs_quarter,
        initialEquity: row.initial_equity,
        newMachinePrice: row.new_machine_price,
        setupTimeHours: row.setup_time_hours,
        initialBatchSize: row.initial_batch_size,
        factoryAreaM2: row.factory_area_m2,
        knlTimeConstantHours: row.knl_time_constant_hours,
        goodQualityThreshold: row.good_quality_threshold,
        excellentQualityThreshold: row.excellent_quality_threshold,
        fiveSInitialMultiplier: row.five_s_initial_multiplier,
        fiveSMultiplierTimeConstant: row.five_s_multiplier_time_constant,
        priceDeclinePercentPerRound: row.price_decline_percent_per_round,
      },
    })
  } catch (error) {
    // Älä paljasta tietokannan sisäisiä tietoja virheilmoituksessa
    console.error('Pelin liittyminen epäonnistui:', error.message)
    res.status(500).json({
      status: 'error',
      message: 'Pelin hakeminen epäonnistui',
    })
  }

}

export function getClassroomSession(req, res) {
  res.set('Cache-Control', 'no-store')
  res.json({ sessionId: req.classroomSessionId })
}

export async function getCurrentClassroomState(req, res) {
  res.set('Cache-Control', 'no-store')
  const unauthorized = () =>
    res.status(401).json({ status: 'error', message: 'Pelisuorituksen valtuutus epäonnistui' })
  const token = readClassroomToken(req)
  if (!token) return unauthorized()

  try {
    const row = await findAuthorizedClassroomState(hashClassroomToken(token))
    if (!row) return unauthorized()

    if (row.state_session_id === null) {
      return res.status(404).json({
        status: 'error',
        code: 'CLASSROOM_STATE_NOT_FOUND',
        message: 'Pelisuoritukselle ei ole tallennettu pelitilaa',
      })
    }

    return res.json({
      sessionId: String(row.id),
      gameId: String(row.game_id),
      gameName: row.game_name,
      playerName: row.player_name,
      startedAt: row.started_at,
      schemaVersion: row.schema_version,
      factorySettings: row.factory_settings,
      initialGameState: row.initial_game_state,
      currentGameState: row.current_game_state,
      stateVersion: String(row.state_version),
    })
  } catch (error) {
    console.error('Luokkahuonepelin tilan haku epäonnistui:', error.message)
    return res.status(503).json({
      status: 'error',
      message: 'Pelisuorituksen tilaa ei voitu hakea',
    })
  }
}
