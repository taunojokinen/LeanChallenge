import { calculateFactorySpace, calculateMinimumFinishedGoodsContainers } from '../../../shared/factory-space/model.js'
import { getGameCompletion } from '../../../shared/game-round/completion.js'
import { calculateRoundConfirmation } from '../../../shared/game-round/confirmRound.js'
import { canFinanceInvestment } from '../../../shared/game-round/investmentFinancing.js'
import pool from '../db/pool.js'

export class RoundConfirmationError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

const invalid = () => new RoundConfirmationError(400, 'INVALID_CONFIRMATION', 'Kierrosvahvistuksen tiedot eivät kelpaa.')
const conflict = (code, message) => new RoundConfirmationError(409, code, message)
const integer = (value, min = 0, max = 2147483647) => Number.isInteger(value) && value >= min && value <= max
const bigintString = (value) => typeof value === 'string' && /^[1-9]\d{0,18}$/.test(value) &&
  BigInt(value) <= 9223372036854775807n
const shape = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).every((key) => keys.includes(key))

export function parseRoundConfirmation(body) {
  if (!shape(body, ['sessionId', 'roundNumber', 'expectedStateVersion', 'decisions']) ||
      !bigintString(body.sessionId) || !bigintString(body.expectedStateVersion) ||
      !integer(body.roundNumber, 1, 12)) throw invalid()

  const { decisions, roundNumber } = body
  if (!shape(decisions, [
    'actDecision', 'checkStaffingDecision', 'checkProductionDecision',
    'fiveSDecision', 'projectsDecision', 'investmentsDecision',
  ])) throw invalid()
  const { actDecision: act, checkStaffingDecision: staffing, checkProductionDecision: production,
    fiveSDecision: fiveS, projectsDecision: projects, investmentsDecision: investments } = decisions

  if (!shape(act, ['price', 'productionQuantity', 'addedVariations', 'useFinishedGoodsInventoryForDeliveries']) ||
      !integer(act.price, 1) || !integer(act.productionQuantity) || !integer(act.addedVariations, 0, 2) ||
      typeof act.useFinishedGoodsInventoryForDeliveries !== 'boolean') throw invalid()
  if (staffing != null && (!shape(staffing, ['staffing']) ||
      !shape(staffing.staffing, ['assembly', 'shipping']) ||
      !integer(staffing.staffing.assembly) || !integer(staffing.staffing.shipping))) throw invalid()
  if (production != null && (!shape(production, ['batchSize']) || !integer(production.batchSize, 1))) throw invalid()
  if (fiveS != null && (!shape(fiveS, ['investedHours']) ||
      !shape(fiveS.investedHours, ['machining', 'assembly', 'shipping']) ||
      !['machining', 'assembly', 'shipping'].every((key) => integer(fiveS.investedHours[key])))) throw invalid()
  if (projects != null && (!shape(projects, ['selections']) || !Array.isArray(projects.selections) ||
      projects.selections.length > 9 || !projects.selections.every((item) =>
        shape(item, ['department', 'method', 'investedHours']) &&
        ['machining', 'assembly', 'shipping'].includes(item.department) &&
        typeof item.method === 'string' && integer(item.investedHours, 1)))) throw invalid()
  if (investments != null && (!shape(investments, ['investments']) || !Array.isArray(investments.investments) ||
      investments.investments.length > 2 || !investments.investments.every((item) =>
        shape(item, ['type', 'quantity']) &&
        ['new-machine', 'factory-expansion'].includes(item.type) && integer(item.quantity, 1)))) throw invalid()

  return {
    ...body,
    decisions: Object.fromEntries(Object.entries({
      actDecision: act, checkStaffingDecision: staffing, checkProductionDecision: production,
      fiveSDecision: fiveS, projectsDecision: projects, investmentsDecision: investments,
    }).map(([key, value]) => [key, value == null ? null : { ...value, round: roundNumber }])),
  }
}

function validateDecisionSettings(decisions, state, settings) {
  if (decisions.actDecision.price !== state.market.price) throw invalid()
  const batchSize = decisions.checkProductionDecision?.batchSize
  if (batchSize != null && !integer(batchSize, settings.production.minBatchSize, settings.production.maxBatchSize)) {
    throw invalid()
  }
  const projects = decisions.projectsDecision?.selections ?? []
  if (new Set(projects.map(({ department, method }) => `${department}:${method}`)).size !== projects.length ||
      projects.some(({ department, method, investedHours }) =>
        !Object.hasOwn(settings.initialState.lean.methods[department], method) ||
        investedHours > settings.lean.methods.maxEffectiveHours ||
        (method === 'method-development' && investedHours !== settings.lean.methods.fixedHours))) throw invalid()
  const fiveSHours = Object.values(decisions.fiveSDecision?.investedHours ?? {})
  const totalHours = [...fiveSHours, ...projects.map(({ investedHours }) => investedHours)]
    .reduce((sum, value) => sum + value, 0)
  if (totalHours > state.lean.fiveS.focusBudgetHours) throw invalid()

  const investments = decisions.investmentsDecision?.investments ?? []
  if (new Set(investments.map(({ type }) => type)).size !== investments.length) throw invalid()
  const machines = investments.find(({ type }) => type === 'new-machine')?.quantity ?? 0
  const expansions = investments.find(({ type }) => type === 'factory-expansion')?.quantity ?? 0
  const cost = machines * settings.investments.newMachine.price + expansions * settings.investments.factoryExpansion.price
  const { cash, equity, bankLoans } = state.finance
  if (!canFinanceInvestment(cost, { cashBalance: cash, equity, bankLoanDebt: bankLoans }, settings.finance).canFinance) {
    throw invalid()
  }
  const staffing = decisions.checkStaffingDecision?.staffing ?? state.staffing
  const machineCount = state.production.machiningMachines + machines
  const space = {
    ...state.factory,
    totalAreaM2: state.factory.totalAreaM2 + expansions * settings.factory.factoryExpansionM2,
    machineCount,
    finishedGoodsContainers: state.inventory.finishedGoodsContainers,
  }
  if (machines > 0 && calculateFactorySpace({
    ...space,
    assemblyWorkers: state.staffing.assembly,
    shippingWorkers: state.staffing.shipping,
    minimumFinishedGoodsContainers: calculateMinimumFinishedGoodsContainers({
      variations: state.market.activeVariations, batchSize: state.market.batchSize, machineCount,
    }),
  }, settings).freeArea < 0) throw invalid()
  if (staffing.assembly + staffing.shipping > state.staffing.assembly + state.staffing.shipping &&
      calculateFactorySpace({ ...space, assemblyWorkers: staffing.assembly, shippingWorkers: staffing.shipping }, settings).freeArea < 0) {
    throw invalid()
  }
}

export async function confirmClassroomRound({ accessTokenHash, sessionId, roundNumber, expectedStateVersion, decisions }) {
  const client = await pool.connect()
  let releaseError
  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED')
    const locked = await client.query(
      `SELECT id FROM public.game_sessions
       WHERE id = $1 AND mode = 'classroom' AND access_token_hash = $2
       FOR UPDATE`,
      [sessionId, accessTokenHash],
    )
    const unauthorized = () => new RoundConfirmationError(401, 'UNAUTHORIZED', 'Pelisuorituksen valtuutus epäonnistui')
    if (locked.rowCount !== 1) throw unauthorized()

    const { rows: [state] } = await client.query(
      `SELECT schema_version, factory_settings, current_game_state, state_version::text AS state_version
       FROM public.classroom_game_states WHERE session_id = $1 FOR UPDATE`,
      [sessionId],
    )
    // Missing opt-in column evaluates to false until a separately approved rollout.
    const { rows: [session] } = await client.query(
      `SELECT finished_at, completion_reason,
              access_token_expires_at > clock_timestamp() AND access_token_revoked_at IS NULL AS authorized,
              COALESCE(to_jsonb(gs)->'server_round_confirmation_enabled' = 'true'::jsonb, false) AS enabled
       FROM public.game_sessions gs WHERE id = $1`,
      [sessionId],
    )
    if (!session.authorized) throw unauthorized()
    if (session.enabled !== true) {
      throw new RoundConfirmationError(403, 'SERVER_CONFIRMATION_DISABLED', 'Palvelinvahvistus ei ole käytössä tälle pelisuoritukselle.')
    }

    if (!state || state.schema_version !== 1) throw conflict('STATE_UNAVAILABLE', 'Yhteensopivaa pelitilaa ei löydy.')
    const { factory_settings: factorySettings, current_game_state: currentGameState } = state
    if (session.finished_at || session.completion_reason || getGameCompletion(currentGameState, factorySettings.game.totalRounds)) {
      throw conflict('GAME_COMPLETE', 'Peli on jo päättynyt.')
    }
    if (state.state_version !== expectedStateVersion) throw conflict('STALE_STATE', 'Pelitilan versio on vanhentunut.')
    if (currentGameState.round !== roundNumber) throw conflict('WRONG_ROUND', 'Vahvistettava kierros ei ole pelin nykyinen kierros.')
    validateDecisionSettings(decisions, currentGameState, factorySettings)

    const { metrics, nextGameState, completion } = calculateRoundConfirmation({
      factorySettings, currentGameState, decisions,
    })
    const { actDecision, checkStaffingDecision, checkProductionDecision,
      investmentsDecision, fiveSDecision, projectsDecision } = decisions

    const savedDecisions = await client.query(
      `INSERT INTO public.round_decisions
         (game_session_id, round_number, act_decision, check_staffing_decision,
          check_production_decision, investments_decision, five_s_decision, projects_decision)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (game_session_id, round_number) DO NOTHING`,
      [sessionId, roundNumber, actDecision, checkStaffingDecision, checkProductionDecision,
        investmentsDecision, fiveSDecision, projectsDecision],
    )
    if (savedDecisions.rowCount !== 1) throw conflict('ROUND_ALREADY_CONFIRMED', 'Kierros on jo vahvistettu.')
    const savedResult = await client.query(
      `INSERT INTO public.round_results
         (game_session_id, round_number, knl, production, revenue, result, equity, inventory_turnover)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (game_session_id, round_number) DO NOTHING`,
      [sessionId, roundNumber, metrics.knlRatio * 100, metrics.production,
        metrics.revenue, metrics.result, metrics.equity, metrics.inventoryTurnoverPerYear],
    )
    if (savedResult.rowCount !== 1) throw conflict('ROUND_ALREADY_CONFIRMED', 'Kierros on jo vahvistettu.')
    const updated = await client.query(
      `UPDATE public.classroom_game_states
       SET current_game_state = $2, state_version = state_version + 1, updated_at = clock_timestamp()
       WHERE session_id = $1 AND state_version = $3
       RETURNING state_version::text AS state_version`,
      [sessionId, nextGameState, expectedStateVersion],
    )
    if (updated.rowCount !== 1) throw conflict('STALE_STATE', 'Pelitilan versio on vanhentunut.')
    if (completion) {
      const finished = await client.query(
        `UPDATE public.game_sessions SET finished_at = clock_timestamp(), completion_reason = $2 WHERE id = $1`,
        [sessionId, completion.reason === 'bankruptcy' ? 'bankruptcy' : 'completed'],
      )
      if (finished.rowCount !== 1) throw new Error('Pelisuorituksen päättymistietoa ei tallennettu')
    }
    await client.query('COMMIT')
    return {
      sessionId, confirmedRound: roundNumber, stateVersion: updated.rows[0].state_version,
      currentGameState: nextGameState, metrics, completion,
    }
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch (rollbackError) {
      releaseError = rollbackError
      console.error('Kierrosvahvistuksen peruminen epäonnistui:', rollbackError.code)
    }
    throw error
  } finally {
    client.release(releaseError)
  }
}
