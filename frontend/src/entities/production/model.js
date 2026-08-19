const INTEGER_FORMATTER = new Intl.NumberFormat('fi-FI', {
  maximumFractionDigits: 0,
})

const PERCENT_FORMATTER = new Intl.NumberFormat('fi-FI', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

function formatPieces(value) {
  return `${INTEGER_FORMATTER.format(value)} kpl`
}

function formatPercent(value) {
  return `${INTEGER_FORMATTER.format(value)} %`
}

function formatDeltaPercent(value) {
  if (value === 0) {
    return '0 %'
  }

  const sign = value > 0 ? '+' : ''
  return `${sign}${PERCENT_FORMATTER.format(value)} %`
}

function calculateOee(availabilityPct, speedPct, qualityPct) {
  return (availabilityPct / 100) * (speedPct / 100) * (qualityPct / 100)
}

function buildPhase(phase) {
  const oeeRatio = calculateOee(phase.availabilityPct, phase.speedPct, phase.qualityPct)
  const oeePctOneDecimal = Math.round(oeeRatio * 1000) / 10
  const effectiveCapacity = Math.round(phase.maxCapacity * (oeePctOneDecimal / 100))

  return {
    key: phase.key,
    name: phase.name,
    availabilityPct: phase.availabilityPct,
    speedPct: phase.speedPct,
    qualityPct: phase.qualityPct,
    oeePct: Math.round(oeeRatio * 100),
    maxCapacity: phase.maxCapacity,
    effectiveCapacity,
    actualProduction: phase.actualProduction,
    largestLoss: phase.largestLoss,
    maxCapacityText: formatPieces(phase.maxCapacity),
    effectiveCapacityText: formatPieces(effectiveCapacity),
    actualProductionText: formatPieces(phase.actualProduction),
    oeeText: formatPercent(Math.round(oeeRatio * 100)),
    availabilityText: formatPercent(phase.availabilityPct),
    speedText: formatPercent(phase.speedPct),
    qualityText: formatPercent(phase.qualityPct),
    largestLossText: `${phase.largestLoss.name} ${INTEGER_FORMATTER.format(phase.largestLoss.pct)} %`,
  }
}

export function buildProductionViewModel(snapshot) {
  const phases = snapshot.phases.map(buildPhase)
  const bottleneck = phases.reduce((smallest, phase) =>
    phase.effectiveCapacity < smallest.effectiveCapacity ? phase : smallest,
  )

  const changePct = ((snapshot.currentProduction - snapshot.previousProduction) / snapshot.previousProduction) * 100

  return {
    round: snapshot.round,
    previousRound: snapshot.previousRound,
    flow: snapshot.flow,
    phases,
    bottleneck,
    summary: {
      bottleneckName: bottleneck.name,
      effectiveCapacity: bottleneck.effectiveCapacity,
      effectiveCapacityText: formatPieces(bottleneck.effectiveCapacity),
      currentProduction: snapshot.currentProduction,
      currentProductionText: formatPieces(snapshot.currentProduction),
      previousProduction: snapshot.previousProduction,
      previousProductionText: formatPieces(snapshot.previousProduction),
      changePct,
      changeText: formatDeltaPercent(changePct),
    },
    insight: `${bottleneck.name} rajoittaa tuotantovirtaa. Tutki erityisesti käytettävyyttä ja nopeutta sekä ${bottleneck.largestLoss.name.toLowerCase()} aiheuttamaa menetystä.`,
  }
}
