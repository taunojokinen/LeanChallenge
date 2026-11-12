import { findGameByJoinCode, createGameSession } from '../repositories/games.repository.js'

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
    const session = await createGameSession({
      gameId: row.id,
      playerName: playerName.trim(),
    })

    // Muotoillaan vastaus: setup-asetukset omaan objektiinsa.
    // Opettajan tietoja (teacher_id) ei palauteta.
    res.json({
      id: row.id,
      name: row.name,
      joinCode: row.join_code,
      sessionId: session.id,
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
    console.error('Pelin haku liittymiskoodilla epäonnistui:', error.message)
    res.status(500).json({
      status: 'error',
      message: 'Pelin hakeminen epäonnistui',
    })
  }
}
