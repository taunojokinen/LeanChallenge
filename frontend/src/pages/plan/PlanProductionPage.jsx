import { useEffect, useMemo, useState } from 'react'
import { buildProductionViewModel } from '../../entities/production/model.js'
import { getProductionSnapshot } from '../../shared/api/productionApi.js'
import './PlanProductionPage.css'

function ProgressMetric({ label, value, text }) {
  return (
    <div className="plan-production-progress-item">
      <div>
        <span>{label}</span>
        <strong>{text}</strong>
      </div>
      <div className="plan-production-progress-track" aria-hidden="true">
        <span className="plan-production-progress-fill" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function PlanProductionPage() {
  const [snapshot, setSnapshot] = useState(null)

  useEffect(() => {
    let isMounted = true

    const loadSnapshot = async () => {
      const data = await getProductionSnapshot()

      if (isMounted) {
        setSnapshot(data)
      }
    }

    loadSnapshot()

    return () => {
      isMounted = false
    }
  }, [])

  const viewModel = useMemo(() => {
    if (!snapshot) {
      return null
    }

    return buildProductionViewModel(snapshot)
  }, [snapshot])

  if (!viewModel) {
    return (
      <section className="plan-production-page" aria-label="Tuotannon diagnostiikka latautuu">
        <h1>TUOTANTO</h1>
        <p>Ladataan tuotannon diagnostiikkaa...</p>
      </section>
    )
  }

  return (
    <section className="plan-production-page" aria-label="Tuotannon diagnostiikka">
      <header className="plan-production-header">
        <h1>TUOTANTO</h1>
        <p>Kierroksen {viewModel.round} tuotannon diagnostiikka</p>
      </header>

      <div className="plan-production-flow" aria-label="Tuotantovirta">
        {viewModel.flow.map((step, index) => (
          <div className="plan-production-flow-step" key={step}>
            <span>{step}</span>
            {index < viewModel.flow.length - 1 ? <small aria-hidden="true">→</small> : null}
          </div>
        ))}
      </div>

      <div className="plan-production-cards" aria-label="Tuotantovaiheiden analyysi">
        {viewModel.phases.map((phase) => {
          const isBottleneck = phase.key === viewModel.bottleneck.key

          return (
            <article className="plan-production-card" key={phase.key}>
              <header>
                <h2>{phase.name}</h2>
                {isBottleneck ? <span className="plan-production-bottleneck-pill">PULLONKAULA</span> : null}
              </header>

              <p className="plan-production-oee">
                <strong>KNL:</strong> {phase.oeeText}
              </p>

              <div className="plan-production-progress-list" aria-label={`${phase.name} KNL-tekijät`}>
                <ProgressMetric label="Käytettävyys" value={phase.availabilityPct} text={phase.availabilityText} />
                <ProgressMetric label="Nopeus" value={phase.speedPct} text={phase.speedText} />
                <ProgressMetric label="Laatu" value={phase.qualityPct} text={phase.qualityText} />
              </div>

              <div className="plan-production-stats">
                <p>
                  <span>Maksimikapasiteetti</span>
                  <strong>{phase.maxCapacityText}</strong>
                </p>
                <p>
                  <span>Tehollinen kapasiteetti</span>
                  <strong>{phase.effectiveCapacityText}</strong>
                </p>
                <p>
                  <span>Toteutunut tuotanto</span>
                  <strong>{phase.actualProductionText}</strong>
                </p>
                <p>
                  <span>Suurin menetys</span>
                  <strong>{phase.largestLossText}</strong>
                </p>
              </div>
            </article>
          )
        })}
      </div>

      <section className="plan-production-summary" aria-label="Tuotannon yhteenveto">
        <p>
          <strong>Pullonkaula:</strong> {viewModel.summary.bottleneckName}
        </p>
        <p>
          <strong>Tehollinen kapasiteetti:</strong> {viewModel.summary.effectiveCapacityText}
        </p>
        <p>
          <strong>Kokonaistuotanto:</strong> {viewModel.summary.currentProductionText}
        </p>
        <p>
          <strong>Edellinen kierros:</strong> {viewModel.summary.previousProductionText}
        </p>
        <p>
          <strong>Muutos:</strong> {viewModel.summary.changeText}
        </p>
      </section>

      <p className="plan-production-insight">{viewModel.insight}</p>
    </section>
  )
}

export default PlanProductionPage