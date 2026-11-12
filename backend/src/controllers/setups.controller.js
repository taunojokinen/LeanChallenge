import { findAllSetups } from '../repositories/setups.repository.js'

export async function getAllSetups(req, res) {
  try {
    const rows = await findAllSetups()

    res.json(rows.map((row) => ({
      id: row.id,
      name: row.name,
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
    })))
  } catch (error) {
    console.error('Vaikeustasojen haku epäonnistui:', error.message)
    res.status(500).json({
      status: 'error',
      message: 'Vaikeustasojen hakeminen epäonnistui',
    })
  }
}
