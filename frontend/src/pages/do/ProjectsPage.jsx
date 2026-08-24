import { useEffect, useMemo, useState } from 'react'
import Card from '../../shared/ui/Card/Card.jsx'
import Button from '../../shared/ui/Button/Button.jsx'
import { getProjectsSnapshot } from '../../shared/api/projectsApi.js'
import { getBalanceSheetSnapshot } from '../../shared/api/balanceSheetApi.js'
import { loadFiveSDecision } from '../../features/five-s/decisionStore.js'
import { loadProjectsDecision, saveProjectsDecision } from '../../features/projects/decisionStore.js'
import {
  canSelectMethodDevelopment,
  METHOD_DEVELOPMENT_FIXED_HOURS,
  buildProjectsViewModel,
  buildSelectionMapFromDecision,
} from '../../entities/lean-projects/model.js'
import './ProjectsPage.css'

function ProjectsPage() {
  const [snapshot, setSnapshot] = useState(null)
  const [fiveSDecision, setFiveSDecision] = useState(null)
  const [savedProjectsDecision, setSavedProjectsDecision] = useState(null)
  const [selectionMap, setSelectionMap] = useState({})
  const [hourInputDrafts, setHourInputDrafts] = useState({})
  const [cashAmount, setCashAmount] = useState(null)
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      const [projectsSnapshot, balanceSheetSnapshot] = await Promise.all([
        getProjectsSnapshot(),
        getBalanceSheetSnapshot(),
      ])

      if (!isMounted) {
        return
      }

      setSnapshot(projectsSnapshot)
      setCashAmount(balanceSheetSnapshot.assets?.cash ?? null)

      const loadedFiveSDecision = loadFiveSDecision(projectsSnapshot.round)
      const loadedProjectsDecision = loadProjectsDecision(projectsSnapshot.round)

      setFiveSDecision(loadedFiveSDecision)
      setSavedProjectsDecision(loadedProjectsDecision)

      if (loadedProjectsDecision) {
        setSelectionMap(buildSelectionMapFromDecision(loadedProjectsDecision))
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [])

  const viewModel = useMemo(() => {
    if (!snapshot) {
      return null
    }

    return buildProjectsViewModel(snapshot, {
      fiveSDecision,
      projectsDecision: savedProjectsDecision,
      selectionMap,
    })
  }, [snapshot, fiveSDecision, savedProjectsDecision, selectionMap])

  const setMethodHours = (departmentKey, methodKey, hours) => {
    const key = `${departmentKey}:${methodKey}`

    setSelectionMap((previousValue) => ({
      ...previousValue,
      [key]: hours,
    }))
  }

  const handleMethodHoursChange = (departmentKey, methodKey, rawValue) => {
    const key = `${departmentKey}:${methodKey}`

    setHourInputDrafts((previousValue) => ({
      ...previousValue,
      [key]: rawValue,
    }))
  }

  const commitHourInput = (departmentKey, methodKey) => {
    if (!viewModel) {
      return
    }

    const key = `${departmentKey}:${methodKey}`
    const draftValue = hourInputDrafts[key] ?? String(selectionMap[key] ?? 0)

    const currentCommittedHours = Number(selectionMap[key] ?? 0)
    const maxAssignableHours = Math.max(0, viewModel.focus.remainingHours + currentCommittedHours)

    let parsedHours = Number(draftValue)

    if (draftValue === '' || !Number.isFinite(parsedHours)) {
      parsedHours = 0
    }

    parsedHours = Math.max(0, parsedHours)
    parsedHours = Math.min(parsedHours, maxAssignableHours)
    parsedHours = Math.round(parsedHours)

    setMethodHours(departmentKey, methodKey, parsedHours)
    setHourInputDrafts((previousValue) => ({
      ...previousValue,
      [key]: String(parsedHours),
    }))
  }

  const handleMethodHoursFocus = (departmentKey, methodKey) => {
    const key = `${departmentKey}:${methodKey}`
    const hasDraft = hourInputDrafts[key] !== undefined
    const draftValue = hasDraft ? hourInputDrafts[key] : String(selectionMap[key] ?? 0)

    if (draftValue === '0') {
      setHourInputDrafts((previousValue) => ({
        ...previousValue,
        [key]: '',
      }))
    }
  }

  const toggleMethodDevelopment = (departmentKey, methodKey) => {
    const key = `${departmentKey}:${methodKey}`

    setSelectionMap((previousValue) => {
      const isSelected = (previousValue[key] ?? 0) > 0

      if (!isSelected && viewModel && !canSelectMethodDevelopment(viewModel.focus.remainingHours)) {
        setStatusMessage(
          'Menetelmäkehitystä ei voi valita, koska yhteisestä fokusbudjetista on jäljellä alle 50 h.',
        )
        return previousValue
      }

      return {
        ...previousValue,
        [key]: isSelected ? 0 : METHOD_DEVELOPMENT_FIXED_HOURS,
      }
    })
  }

  const handleSaveProjects = () => {
    if (!snapshot || !viewModel || !viewModel.focus.canSave) {
      setStatusMessage('Projektit ylittävät yhteisen 400 h fokusbudjetin 5S:n kanssa.')
      return
    }

    const selections = viewModel.selections.map((selection) => ({
      department: selection.departmentKey,
      method: selection.methodKey,
      investedHours: selection.investedHours,
      cost: selection.cost,
      targetProblem: selection.targetProblem,
      targetLoss: selection.targetLoss,
    }))

    const nextDecision = {
      round: snapshot.round,
      selections,
      usedFocusHours: viewModel.focus.projectsSelectedHours,
      totalCost: viewModel.costs.total,
      savedAt: new Date().toISOString(),
    }

    saveProjectsDecision(nextDecision)
    setSavedProjectsDecision(nextDecision)
    setStatusMessage(
      `Projektipäätös tallennettu: ${viewModel.focus.projectsSelectedHoursText} ja ${viewModel.costs.totalText}.`,
    )
  }

  if (!viewModel) {
    return (
      <section className="projects-page" aria-label="Projektit-näkymä latautuu">
        <header className="projects-header">
          <h1>Projektit</h1>
          <p>Ladataan projektikatalogia...</p>
        </header>
      </section>
    )
  }

  return (
    <section className="projects-page" aria-label="DO-vaiheen projektit">
      <header className="projects-header">
        <h1>Projektit</h1>
        <p>
          Valitse osastokohtaiset Lean-projektit kierrokselle. Projektit käyttävät samaa fokusresurssia
          kuin 5S.
        </p>
      </header>

      <section className="projects-summary-grid" aria-label="Resurssiyhteenveto">
        <Card>
          <article className="projects-summary-card">
            <h2>Lean-kehitysfokus</h2>
            <p>
              <span>Lean-kehitysfokus</span>
              <strong>{viewModel.focus.totalHoursText}</strong>
            </p>
            <p>
              <span>5S:ään käytetty</span>
              <strong>{viewModel.focus.fiveSUsedHoursText}</strong>
            </p>
            <p>
              <span>Projekteihin valittu</span>
              <strong>{viewModel.focus.projectsSelectedHoursText}</strong>
            </p>
            <p>
              <span>Jäljellä</span>
              <strong>{viewModel.focus.remainingHoursText}</strong>
            </p>
          </article>
        </Card>

        <Card>
          <article className="projects-summary-card">
            <h2>Projektikustannukset</h2>
            <p>
              <span>Valitut projektit yhteensä</span>
              <strong>{viewModel.costs.totalText}</strong>
            </p>
            <p>
              <span>Käytettävissä oleva raha</span>
              <strong>{cashAmount === null ? '-' : `${Number(cashAmount).toLocaleString('fi-FI')} €`}</strong>
            </p>
          </article>
        </Card>
      </section>

      {viewModel.focus.remainingHours <= 0 ? (
        <p className="projects-focus-warning" role="status" aria-live="polite">
          Kehitysfokus on käytetty kokonaan 5S:ään. Vapauta tunteja 5S-sivulla käynnistääksesi
          projekteja.
        </p>
      ) : null}

      <section className="projects-department-rows" aria-label="Osastokohtaiset projektit">
        {viewModel.departments.map((department) => (
          <article className="projects-department-row" key={department.key}>
            <div className="projects-department-label">
              <h2>{department.name}</h2>
              <p>Valitse osastolle sopivat kehitysmenetelmät.</p>
            </div>

            {department.methods.map((method) => (
              <Card key={method.key}>
                <div className="projects-method-item">
                  <div className="projects-method-head">
                    <strong>{method.name}</strong>
                    {method.type === 'progressive' ? <span>{method.currentLevelText}</span> : <span>Vakio</span>}
                  </div>

                  <p className="projects-method-meta">
                    <span>Nykyinen vaihe</span>
                    <strong>{method.currentPhaseDescription}</strong>
                  </p>

                  {method.targetProblem ? (
                    <p className="projects-method-meta">
                      <span>Nykyinen suurin ongelma</span>
                      <strong>{method.targetProblem}</strong>
                    </p>
                  ) : null}

                  <p className="projects-method-meta">
                    <span>Kehityskohde</span>
                    <strong>{method.targetLoss}</strong>
                  </p>

                  {method.type === 'progressive' ? (
                    <>
                      <label className="projects-hour-input">
                        <span>Panostus</span>
                        <div>
                          {(() => {
                            const inputKey = `${department.key}:${method.key}`
                            const inputValue =
                              hourInputDrafts[inputKey] !== undefined
                                ? hourInputDrafts[inputKey]
                                : String(method.selectedHours)

                            return (
                              <input
                                type="number"
                                min="0"
                                max="400"
                                step="1"
                                value={inputValue}
                                onChange={(event) =>
                                  handleMethodHoursChange(department.key, method.key, event.target.value)
                                }
                                onFocus={() => handleMethodHoursFocus(department.key, method.key)}
                                onBlur={() => commitHourInput(department.key, method.key)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault()
                                    commitHourInput(department.key, method.key)
                                    event.currentTarget.blur()
                                  }
                                }}
                              />
                            )
                          })()}
                          <small>h</small>
                        </div>
                      </label>

                      <div className="projects-method-footer">
                        <p className="projects-method-impact">
                          <span>Kustannus</span>
                          <strong>{method.costText}</strong>
                        </p>

                        <p className="projects-method-impact">
                          <span>Vaikutusarvio</span>
                          <strong>{method.impactCategory}</strong>
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="projects-fixed-method">
                      <p>
                        <span>Panostus</span>
                        <strong>{method.displayHoursText}</strong>
                      </p>
                      <p>
                        <span>Kustannus</span>
                        <strong>{method.displayCostText}</strong>
                      </p>
                      <p>
                        <span>Vaikutusarvio</span>
                        <strong>{method.displayImpactCategory}</strong>
                      </p>
                      <Button
                        type="button"
                        onClick={() => toggleMethodDevelopment(department.key, method.key)}
                        disabled={
                          !method.isSelected &&
                          !canSelectMethodDevelopment(viewModel.focus.remainingHours)
                        }
                      >
                        {method.isSelected ? 'POISTA' : 'VALITSE'}
                      </Button>
                    </div>
                  )}

                </div>
              </Card>
            ))}
          </article>
        ))}
      </section>

      <section className="projects-footer" aria-label="Projektipäätöksen yhteenveto">
        <h2>Valitut projektit</h2>

        {viewModel.selections.length === 0 ? (
          <p className="projects-empty">Et ole vielä valinnut projekteja tälle kierrokselle.</p>
        ) : (
          <div className="projects-selection-list">
            {viewModel.selections.map((selection) => (
              <p key={`${selection.departmentKey}-${selection.methodKey}`}>
                <span>
                  {selection.departmentName} / {selection.methodName}
                </span>
                <strong>{selection.investedHoursText}</strong>
                <strong>{selection.costText}</strong>
              </p>
            ))}
          </div>
        )}

        <div className="projects-totals">
          <p>
            <span>Projektit yhteensä</span>
            <strong>{viewModel.focus.projectsSelectedHoursText}</strong>
            <strong>{viewModel.costs.totalText}</strong>
          </p>
          <p>
            <span>5S</span>
            <strong>{viewModel.focus.fiveSUsedHoursText}</strong>
          </p>
          <p>
            <span>Koko kierroksen fokus</span>
            <strong>
              {viewModel.focus.combinedUsedHours} / {viewModel.focus.totalHours} h
            </strong>
          </p>
          <p>
            <span>Jäljellä</span>
            <strong>{viewModel.focus.remainingHoursText}</strong>
          </p>
        </div>

        <div className="projects-actions">
          <Button type="button" disabled={!viewModel.focus.canSave} onClick={handleSaveProjects}>
            TALLENNA PROJEKTIT
          </Button>
          {!viewModel.focus.canSave ? (
            <small>5S + Projektit ylittää 400 h. Pienennä projektitunteja ennen tallennusta.</small>
          ) : (
            <small>Projektipäätös tallennetaan tälle kierrokselle.</small>
          )}
          {statusMessage ? <p className="projects-status-message">{statusMessage}</p> : null}
        </div>
      </section>
    </section>
  )
}

export default ProjectsPage