import { useEffect, useMemo, useState } from 'react'
import Card from '../../shared/ui/Card/Card.jsx'
import Button from '../../shared/ui/Button/Button.jsx'
import { getInvestmentsSnapshot } from '../../shared/api/investmentsApi.js'
import { getProjectsSnapshot } from '../../shared/api/projectsApi.js'
import { loadProjectsDecision } from '../../features/projects/decisionStore.js'
import { buildProjectsViewModel, buildSelectionMapFromDecision } from '../../entities/lean-projects/model.js'
import {
  buildDraftSelectionFromDecision,
  buildInvestmentsViewModel,
} from '../../entities/investments/model.js'
import {
  loadInvestmentsDecision,
  saveInvestmentsDecision,
} from '../../features/investments/decisionStore.js'
import './InvestmentsPage.css'

function InvestmentsPage({ round, gameState, factorySettings }) {
  const [snapshot, setSnapshot] = useState(null)
  const [projectsViewModel, setProjectsViewModel] = useState(null)
  const [savedDecision, setSavedDecision] = useState(null)
  const [draftSelection, setDraftSelection] = useState({
    newMachineCount: 0,
    expansionCount: 0,
    setupAutomation: false,
    automaticProcessMeasurement: false,
    conditionMonitoring: false,
  })
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      const [investmentsData, projectsData] = await Promise.all([
        getInvestmentsSnapshot(),
        getProjectsSnapshot(),
      ])

      if (!isMounted) {
        return
      }

      const projectsDecision = loadProjectsDecision(round)
      const selectionMap = projectsDecision ? buildSelectionMapFromDecision(projectsDecision) : {}
      const projectsModel = buildProjectsViewModel(projectsData, { selectionMap })

      const investmentsDecision = loadInvestmentsDecision(round)

      setSnapshot(investmentsData)
      setProjectsViewModel(projectsModel)
      setSavedDecision(investmentsDecision)

      if (investmentsDecision) {
        setDraftSelection(buildDraftSelectionFromDecision(investmentsDecision))
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [round])

  const viewModel = useMemo(() => {
    if (!snapshot || !gameState || !factorySettings || !projectsViewModel) {
      return null
    }

    return buildInvestmentsViewModel({
      snapshot,
      gameState,
      factorySettings,
      projectsViewModel,
      draftSelection,
    })
  }, [snapshot, gameState, factorySettings, projectsViewModel, draftSelection])

  const updateDraft = (changes) => {
    setDraftSelection((previousValue) => ({
      ...previousValue,
      ...changes,
    }))
  }

  const incrementMachine = () => {
    if (!viewModel || !viewModel.guards.canAddMachine) {
      const hasSpace = viewModel?.space.projected.freeArea >= 0
      const hasFinance = viewModel?.financing.canFinance
      setStatusMessage(
        !hasSpace && !hasFinance
          ? 'Ei mahdollista - vapaata tehdastilaa ja rahoitusvaraa ei ole riittävästi.'
          : !hasSpace
            ? 'Ei mahdollista - vapaata tehdastilaa ei ole riittävästi.'
            : 'Ei mahdollista - rahoitusvara ei ole riittävä.',
      )
      return
    }

    updateDraft({ newMachineCount: draftSelection.newMachineCount + 1 })
  }

  const decrementMachine = () => {
    updateDraft({ newMachineCount: Math.max(0, draftSelection.newMachineCount - 1) })
  }

  const incrementExpansion = () => {
    if (!viewModel || !viewModel.guards.canAddExpansion) {
      setStatusMessage('Ei mahdollista - rahoitusvara ei ole riittävä.')
      return
    }

    updateDraft({ expansionCount: draftSelection.expansionCount + 1 })
  }

  const decrementExpansion = () => {
    updateDraft({ expansionCount: Math.max(0, draftSelection.expansionCount - 1) })
  }

  const toggleFactorySystem = (key, canUnlock, alreadyInstalled, canFinance) => {
    if (alreadyInstalled) {
      return
    }

    if (!canUnlock) {
      setStatusMessage('Investointi on lukittu - avaamisehto ei täyty vielä.')
      return
    }

    if (!canFinance && !draftSelection[key]) {
      setStatusMessage('Ei mahdollista - rahoitusvara ei ole riittävä.')
      return
    }

    updateDraft({ [key]: !draftSelection[key] })
  }

  const handleSave = () => {
    if (!snapshot || !viewModel || !viewModel.financing.canFinance || viewModel.space.projected.freeArea < 0) {
      setStatusMessage('Investointipäätöstä ei voi tallentaa - tarkista tila- ja rahoitusrajoitteet.')
      return
    }

    const decision = {
      round,
      investments: viewModel.investmentRows,
      totalCost: viewModel.totals.totalCost,
      financingNeed: viewModel.financing.financingNeed,
      savedAt: new Date().toISOString(),
    }

    saveInvestmentsDecision(decision)
    setSavedDecision(decision)
    setStatusMessage(
      `Investoinnit tallennettu: ${viewModel.totals.totalCostText}, uusi velka ${viewModel.financing.financingNeedText}.`,
    )
  }

  if (!viewModel) {
    return (
      <section className="investments-page" aria-label="Investoinnit-näkymä latautuu">
        <header className="investments-header">
          <h1>INVESTOINNIT</h1>
          <p>Ladataan investointikatalogia...</p>
        </header>
      </section>
    )
  }

  return (
    <section className="investments-page" aria-label="DO-vaiheen investoinnit">
      <header className="investments-header">
        <h1>INVESTOINNIT</h1>
        <p>Valitse investoinnit seuraavalle simuloitavalle kierrokselle.</p>
      </header>

      <section className="investments-kpi-grid" aria-label="Rahoitus ja tehdastila">
        <Card>
          <article className="investments-kpi-card">
            <small>Velkaraja</small>
            <strong>{viewModel.financing.maxDebtText}</strong>
          </article>
        </Card>
        <Card>
          <article className="investments-kpi-card">
            <small>Korollinen velka</small>
            <strong>{viewModel.financing.currentDebtText}</strong>
          </article>
        </Card>
        <Card>
          <article className="investments-kpi-card">
            <small>Oma pääoma</small>
            <strong>{viewModel.financing.equityText}</strong>
          </article>
        </Card>
        <Card>
          <article className="investments-kpi-card">
            <small>Tehdastila käytössä / vapaana</small>
            <strong>
              {viewModel.space.usedAreaText} / {viewModel.space.freeAreaText}
            </strong>
          </article>
        </Card>
      </section>

      <section className="investments-catalog" aria-label="Investointikatalogi">
        <Card>
          <article className="investments-card">
            <h2>Uusi tuotantokone</h2>
            <p>Hinta: 500 000 € / kone</p>
            <p>Tilantarve: 250 m² / kone</p>
            <p>Vaikutus: +1 040 h kapasiteettia ja +5 henkilöä / kone</p>
            <p>Poisto: 5 % / kierros menojäännöksestä</p>
            {viewModel.space.projected.freeArea < 0 ? (
              <small>Ei mahdollista - vapaata tehdastilaa ei ole riittävästi.</small>
            ) : null}
            {!viewModel.financing.canFinance ? (
              <small>Ei mahdollista - vakavaraisuus ei riitä investoinnin rahoittamiseen.</small>
            ) : null}
            <div className="investments-counter">
              <Button type="button" onClick={decrementMachine}>
                -
              </Button>
              <strong>{draftSelection.newMachineCount}</strong>
              <Button type="button" onClick={incrementMachine}>
                +
              </Button>
            </div>
          </article>
        </Card>

        <Card>
          <article className="investments-card">
            <h2>Tehdaslaajennus</h2>
            <p>Hinta: 1 000 000 €</p>
            <p>Lisätila: +1 000 m²</p>
            <p>Poisto: 2,5 % / kierros menojäännöksestä</p>
            <div className="investments-counter">
              <Button type="button" onClick={decrementExpansion}>
                -
              </Button>
              <strong>{draftSelection.expansionCount}</strong>
              <Button type="button" onClick={incrementExpansion}>
                +
              </Button>
            </div>
          </article>
        </Card>

        <Card>
          <article className="investments-card">
            <h2>Asetus-/muotinvaihdon automaatio</h2>
            <p>Hinta: 250 000 €</p>
            <p>Vaikutus: tehtaan koneistuksen asetusten ja muotinvaihtojen automaatio.</p>
            <p>Poisto: 5 % / kierros</p>
            {viewModel.guards.canUnlockMoldAutomation ? null : (
              <small>
                Vaatii SMED-tason 4,0. Nykyinen taso {viewModel.methodLevels.smedLevelText}.
              </small>
            )}

            {viewModel.guards.setupAutomationInstalled ? (
              <small>Järjestelmä on jo asennettu.</small>
            ) : (
              <Button
                type="button"
                disabled={!viewModel.guards.canUnlockMoldAutomation}
                onClick={() =>
                  toggleFactorySystem(
                    'setupAutomation',
                    viewModel.guards.canUnlockMoldAutomation,
                    viewModel.guards.setupAutomationInstalled,
                    viewModel.guards.canAddSetupAutomation,
                  )
                }
              >
                {draftSelection.setupAutomation ? 'POISTA' : 'VALITSE'}
              </Button>
            )}
          </article>
        </Card>

        <Card>
          <article className="investments-card">
            <h2>Automaattinen prosessimittaus</h2>
            <p>Hinta: 250 000 €</p>
            <p>Vaikutus: Laatu +2 %-yks. (simulaatiossa)</p>
            <p>Poisto: 5 % / kierros</p>
            {viewModel.guards.canUnlockAutoMeasurement ? null : (
              <small>
                Vaatii SPC-tason 4,0. Nykyinen taso {viewModel.methodLevels.spcLevelText}.
              </small>
            )}
            {viewModel.guards.autoMeasurementAlreadyInstalled ? (
              <small>Järjestelmä on jo asennettu.</small>
            ) : (
              <Button
                type="button"
                onClick={() =>
                  toggleFactorySystem(
                    'automaticProcessMeasurement',
                    viewModel.guards.canUnlockAutoMeasurement,
                    viewModel.guards.autoMeasurementAlreadyInstalled,
                    viewModel.guards.canAddProcessMeasurement,
                  )
                }
              >
                {draftSelection.automaticProcessMeasurement ? 'POISTA' : 'VALITSE'}
              </Button>
            )}
          </article>
        </Card>

        <Card>
          <article className="investments-card">
            <h2>Kunnonvalvontajärjestelmä</h2>
            <p>Hinta: 200 000 €</p>
            <p>Vaikutus: Käytettävyys +2 %-yks. (simulaatiossa)</p>
            <p>Poisto: 5 % / kierros</p>
            {viewModel.guards.canUnlockConditionMonitoring ? null : (
              <small>
                Vaatii TPM-tason 4,0. Nykyinen taso {viewModel.methodLevels.tpmLevelText}.
              </small>
            )}
            {viewModel.guards.conditionMonitoringAlreadyInstalled ? (
              <small>Järjestelmä on jo asennettu.</small>
            ) : (
              <Button
                type="button"
                onClick={() =>
                  toggleFactorySystem(
                    'conditionMonitoring',
                    viewModel.guards.canUnlockConditionMonitoring,
                    viewModel.guards.conditionMonitoringAlreadyInstalled,
                    viewModel.guards.canAddConditionMonitoring,
                  )
                }
              >
                {draftSelection.conditionMonitoring ? 'POISTA' : 'VALITSE'}
              </Button>
            )}
          </article>
        </Card>
      </section>

      <section className="investments-summary" aria-label="Valitut investoinnit">
        <h2>Valitut investoinnit</h2>
        {viewModel.investmentRows.length === 0 ? (
          <p>Et ole valinnut investointeja tälle kierrokselle.</p>
        ) : (
          <div className="investments-summary-list">
            {viewModel.investmentRows.map((item, index) => (
              <p key={`${item.type}-${item.machineId ?? index}`}>
                <span>
                  {item.type}
                  {item.machineId ? ` / Kone ${item.machineId}` : item.quantity > 1 ? ` ×${item.quantity}` : ''}
                </span>
                <strong>{item.cost.toLocaleString('fi-FI')} €</strong>
              </p>
            ))}
          </div>
        )}

        <div className="investments-summary-financing">
          <p>
            <span>Investoinnit yhteensä</span>
            <strong>{viewModel.totals.totalCostText}</strong>
          </p>
          <p>
            <span>Vapaata velkakapasiteettia</span>
            <strong>{viewModel.financing.debtHeadroomText}</strong>
          </p>
          <p>
            <span>Investointeihin käytettävä kassa</span>
            <strong>{viewModel.financing.availableCashText}</strong>
          </p>
          <p>
            <span>Rahoitusvara yhteensä</span>
            <strong>{viewModel.financing.financingCapacityText}</strong>
          </p>
          <p>
            <span>Kassareservi</span>
            <strong>{viewModel.financing.targetCashText}</strong>
          </p>
          <p>
            <span>Kassasta käytetään</span>
            <strong>{viewModel.financing.cashUsedText}</strong>
          </p>
          <p>
            <span>Uutta velkaa</span>
            <strong>{viewModel.financing.financingNeedText}</strong>
          </p>
          <p>
            <span>Velka investoinnin jälkeen</span>
            <strong>{viewModel.financing.debtAfterText}</strong>
          </p>
          <p>
            <span>Velkaraja</span>
            <strong>{viewModel.financing.debtLimitText}</strong>
          </p>
          <p>
            <span>Arvioitu poisto / kierros</span>
            <strong>{viewModel.totals.depreciationPerRoundText}</strong>
          </p>
        </div>

        <div className="investments-actions">
          <Button
            type="button"
            disabled={!viewModel.financing.canFinance || viewModel.space.projected.freeArea < 0}
            onClick={handleSave}
          >
            TALLENNA INVESTOINNIT
          </Button>
          {statusMessage ? <p>{statusMessage}</p> : null}
          {savedDecision ? <small>Tallennettu kierrokselle {savedDecision.round}.</small> : null}
        </div>
      </section>
    </section>
  )
}

export default InvestmentsPage