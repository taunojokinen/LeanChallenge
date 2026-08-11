import { useEffect, useMemo, useState } from 'react'
import GaugesPanel from '../../widgets/gauges-panel/GaugesPanel.jsx'
import Button from '../../shared/ui/Button/Button.jsx'
import Card from '../../shared/ui/Card/Card.jsx'
import { loadPlanGoals, savePlanGoals } from '../../features/plan-goals/goalStore.js'
import { getPlanSnapshot } from '../../shared/api/planApi.js'
import './PlanPage.css'

const MAX_GOALS = 3

const goalOptions = [
  { key: 'oee', label: 'KNL', unit: '%', defaultValue: 75 },
  { key: 'delivery', label: 'Toimitusvarmuus', unit: '%', defaultValue: 95 },
  { key: 'result', label: 'Tulos', unit: '€', defaultValue: 40000 },
  { key: 'capacity', label: 'Valmistuskapasiteetti', unit: 'kpl', defaultValue: 850 },
  { key: 'machiningAvailability', label: 'Koneistuksen käytettävyys', unit: '%', defaultValue: 80 },
]

function PlanPage() {
  const [snapshot, setSnapshot] = useState(null)
  const [selectedGoals, setSelectedGoals] = useState([])
  const [transitionMessage, setTransitionMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadSnapshot = async () => {
      const data = await getPlanSnapshot()

      if (isMounted) {
        setSnapshot(data)
      }
    }

    loadSnapshot()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    setSelectedGoals(loadPlanGoals())
  }, [])

  const remainingGoalOptions = useMemo(
    () => goalOptions.filter((option) => !selectedGoals.some((goal) => goal.key === option.key)),
    [selectedGoals],
  )

  const addGoal = (goalKey) => {
    const option = goalOptions.find((goal) => goal.key === goalKey)

    if (!option || selectedGoals.length >= MAX_GOALS) {
      return
    }

    const updatedGoals = [
      ...selectedGoals,
      {
        key: option.key,
        label: option.label,
        target: option.defaultValue,
        unit: option.unit,
      },
    ]

    setSelectedGoals(updatedGoals)
    savePlanGoals(updatedGoals)
  }

  const updateGoalTarget = (goalKey, value) => {
    const updatedGoals = selectedGoals.map((goal) =>
      goal.key === goalKey
        ? {
            ...goal,
            target: value,
          }
        : goal,
    )

    setSelectedGoals(updatedGoals)
    savePlanGoals(updatedGoals)
  }

  const removeGoal = (goalKey) => {
    const updatedGoals = selectedGoals.filter((goal) => goal.key !== goalKey)
    setSelectedGoals(updatedGoals)
    savePlanGoals(updatedGoals)
  }

  const handleProceedToDo = () => {
    savePlanGoals(selectedGoals)
    setTransitionMessage('Tavoitteet tallennettu. DO-vaiheen näkymä lisätään seuraavassa vaiheessa.')
  }

  if (!snapshot) {
    return (
      <div className="plan-page">
        <main className="plan-main">
          <section className="plan-header">
            <h1>PLAN</h1>
            <p>Ladataan PLAN-näkymää...</p>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="plan-page">
      <main className="plan-main">
        <section className="plan-header" aria-label="Kierrostieto">
          <div>
            <h1>PLAN</h1>
            <p>
              Kierros {snapshot.round} / {snapshot.totalRounds}
            </p>
            <small>Aktiivinen PDCA-vaihe: {snapshot.activePhase}</small>
          </div>
          <div className="plan-pdca-track" aria-label="PDCA eteneminen">
            <span className="is-active">PLAN</span>
            <span>DO</span>
            <span>CHECK</span>
            <span>ACT</span>
          </div>
        </section>

        <section className="plan-kpi-grid" aria-label="Yrityksen päätunnusluvut">
          {snapshot.kpis.map((kpi) => (
            <Card key={kpi.key}>
              <article className="plan-kpi-card">
                <h2>{kpi.label}</h2>
                <p>{kpi.value}</p>
                <small>Muutos: {kpi.delta}</small>
              </article>
            </Card>
          ))}
        </section>

        <section className="plan-section plan-knl-section" aria-label="KNL-mittarit">
          <header>
            <h2>KNL-mittarit</h2>
            <p>Käytettävyys, Nopeus ja Laatu edelliseltä kierrokselta.</p>
          </header>
          <GaugesPanel gauges={snapshot.gauges} />
        </section>

        <section className="plan-two-column" aria-label="Tuotannon ja talouden tila">
          <Card>
            <article className="plan-detail-card">
              <h2>Tuotannon tila</h2>
              <ul>
                {snapshot.production.departments.map((department) => (
                  <li key={department.name}>
                    <strong>{department.name}</strong>
                    <span>Kapasiteetti: {department.capacity}</span>
                    <span>Kuormitus: {department.utilization}</span>
                  </li>
                ))}
              </ul>
              <p>
                <strong>Pullonkaula:</strong>{' '}
                <span className="plan-bottleneck-pill">{snapshot.production.bottleneck}</span>
              </p>
              <p>
                <strong>WIP:</strong> {snapshot.production.wip}
              </p>
              <p>
                <strong>Toimittamattomat toimituserät:</strong> {snapshot.production.backlog}
              </p>
            </article>
          </Card>

          <Card>
            <article className="plan-detail-card">
              <h2>Taloudellinen tila</h2>
              <p>
                <strong>Tulos:</strong> {snapshot.financial.result}
              </p>
              <p>
                <strong>Kassatilanne:</strong> {snapshot.financial.cash}
              </p>
              <p>
                <strong>Velka / lainat:</strong> {snapshot.financial.debt}
              </p>
              <button type="button" className="plan-link-button">
                {snapshot.financial.detailsLabel}
              </button>
            </article>
          </Card>
        </section>

        <section className="plan-section" aria-label="Tavoitteiden asettaminen">
          <header>
            <h2>Tavoitteet seuraavalle kierrokselle</h2>
            <p>
              Voit asettaa enintään {MAX_GOALS} tavoitetta. Tavoitteet tallennetaan CHECK-vaiheen
              vertailua varten.
            </p>
          </header>

          <div className="plan-goals-toolbar">
            <label htmlFor="goal-select">Lisää tavoite</label>
            <select
              id="goal-select"
              onChange={(event) => {
                if (event.target.value) {
                  addGoal(event.target.value)
                  event.target.value = ''
                }
              }}
              disabled={remainingGoalOptions.length === 0 || selectedGoals.length >= MAX_GOALS}
              defaultValue=""
            >
              <option value="" disabled>
                Valitse tavoite
              </option>
              {remainingGoalOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="plan-goals-list">
            {selectedGoals.length === 0 ? (
              <p className="plan-empty-state">Tavoitteita ei ole vielä valittu.</p>
            ) : (
              selectedGoals.map((goal) => (
                <Card key={goal.key}>
                  <div className="plan-goal-item">
                    <strong>{goal.label}</strong>
                    <label>
                      Tavoitetaso
                      <div>
                        <input
                          type="number"
                          value={goal.target}
                          onChange={(event) => updateGoalTarget(goal.key, Number(event.target.value))}
                        />
                        <span>{goal.unit}</span>
                      </div>
                    </label>
                    <Button type="button" onClick={() => removeGoal(goal.key)}>
                      Poista
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </section>

        <section className="plan-footer" aria-label="PLAN-vaiheen toiminta">
          <p>
            Analysoi nykytila, tunnista tärkein kehityskohde ja aseta seuraavan kierroksen
            tavoitteet.
          </p>
          <Button className="plan-primary-action" type="button" onClick={handleProceedToDo}>
            SIIRRY DO-VAIHEESEEN
          </Button>
          {transitionMessage ? <small>{transitionMessage}</small> : null}
        </section>
      </main>
    </div>
  )
}

export default PlanPage