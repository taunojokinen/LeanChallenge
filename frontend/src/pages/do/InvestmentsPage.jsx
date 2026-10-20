import { useEffect, useMemo, useState } from 'react'
import Card from '../../shared/ui/Card/Card.jsx'
import Button from '../../shared/ui/Button/Button.jsx'
import { getInvestmentsSnapshot } from '../../shared/api/investmentsApi.js'
import {
  buildDraftSelectionFromDecision,
  buildInvestmentsViewModel,
  getAdditionalPersonnelFromMachines,
} from '../../entities/investments/model.js'
import {
  loadInvestmentsDecision,
  saveInvestmentsDecision,
} from '../../features/investments/decisionStore.js'
import './InvestmentsPage.css'

const EMPTY_DRAFT_SELECTION = {
  newMachineCount: 0,
  expansionCount: 0,
}

const INTEGER_FORMATTER = new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 0 })

function formatPercent(value) {
  return `${new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 1 }).format(value * 100)} %`
}

function InvestmentRules({ settings }) {
  const machineSpace = settings.factory.machineSpaceM2
  const expansionSpace = settings.factory.factoryExpansionM2
  const machineRate = settings.finance.machineryDepreciationPerRound
  const expansionRate = settings.finance.buildingDepreciationPerRound

  return (
    <section className="investments-rules" aria-labelledby="investments-rules-title">
      <h2 id="investments-rules-title">Investointien säännöt</h2>
      <dl>
        <div>
          <dt>Rahoitus</dt>
          <dd>
            Investointeja voi tehdä investointivaran puitteissa. Korollinen velka voi olla
            korkeintaan {settings.finance.maxDebtToEquity} × oma pääoma.
          </dd>
        </div>
        <div>
          <dt>Tilantarve</dt>
          <dd>
            Uusi tuotantokone tarvitsee {INTEGER_FORMATTER.format(machineSpace)} m² tehdastilaa.
            Tehdaslaajennus lisää tilaa {INTEGER_FORMATTER.format(expansionSpace)} m².
          </dd>
        </div>
        <div>
          <dt>Poistot</dt>
          <dd>
            Koneista poistetaan {formatPercent(machineRate)} ja tehdaslaajennuksista
            {' '}{formatPercent(expansionRate)} kierroksittain jäljellä olevasta arvosta.
          </dd>
        </div>
        <div>
          <dt>Voimaantulo</dt>
          <dd>Investoinnit vaikuttavat seuraavalla simuloitavalla kierroksella.</dd>
        </div>
      </dl>
    </section>
  )
}

function InvestmentsPage({ round, gameState, factorySettings, onNavigate }) {
  const [snapshot, setSnapshot] = useState(null)
  const [savedDecision, setSavedDecision] = useState(null)
  const [draftSelection, setDraftSelection] = useState(EMPTY_DRAFT_SELECTION)
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      const investmentsData = await getInvestmentsSnapshot()

      if (!isMounted) {
        return
      }

      const investmentsDecision = loadInvestmentsDecision(round)

      setSnapshot(investmentsData)
      setSavedDecision(investmentsDecision)
      setDraftSelection(
        investmentsDecision ? buildDraftSelectionFromDecision(investmentsDecision) : EMPTY_DRAFT_SELECTION,
      )
    }

    loadData().catch(() => {
      if (isMounted) {
        setStatusMessage('Investointikatalogin lataus epäonnistui. Yritä uudelleen.')
      }
    })

    return () => {
      isMounted = false
    }
  }, [round])

  const viewModel = useMemo(() => {
    if (!snapshot || !gameState || !factorySettings) {
      return null
    }

    return buildInvestmentsViewModel({
      snapshot,
      gameState,
      factorySettings,
      draftSelection,
    })
  }, [snapshot, gameState, factorySettings, draftSelection])

  const machineSpace = factorySettings?.factory?.machineSpaceM2 ?? 250
  const machineCandidate = viewModel && snapshot && gameState && factorySettings
    ? buildInvestmentsViewModel({
      snapshot,
      gameState,
      factorySettings,
      draftSelection: { ...draftSelection, newMachineCount: draftSelection.newMachineCount + 1 },
    })
    : null
  const expansionCandidate = viewModel && snapshot && gameState && factorySettings
    ? buildInvestmentsViewModel({
      snapshot,
      gameState,
      factorySettings,
      draftSelection: { ...draftSelection, expansionCount: draftSelection.expansionCount + 1 },
    })
    : null
  const machineBlockedBySpace = machineCandidate?.space.projected.freeArea < 0
  const machineBlockedByFinancing = machineCandidate && !machineCandidate.financing.canFinance
  const expansionBlockedByFinancing = expansionCandidate && !expansionCandidate.financing.canFinance
  const currentDecisionIsInvalid = viewModel
    && (!viewModel.financing.canFinance || viewModel.space.projected.freeArea < 0)

  const persistSelection = (selectionModel) => {
    const decision = {
      round,
      investments: selectionModel.investmentRows,
      totalCost: selectionModel.totals.totalCost,
      financingNeed: selectionModel.financing.financingNeed,
      savedAt: new Date().toISOString(),
    }

    try {
      saveInvestmentsDecision(decision)
      setSavedDecision(decision)
      setStatusMessage('')
      return true
    } catch {
      setStatusMessage('Investointien tallennus epäonnistui. Yritä uudelleen.')
      return false
    }
  }

  const updateDraft = (changes) => {
    const nextDraft = { ...draftSelection, ...changes }
    setDraftSelection(nextDraft)

    if (!snapshot || !gameState || !factorySettings) {
      return
    }

    const nextModel = buildInvestmentsViewModel({
      snapshot,
      gameState,
      factorySettings,
      draftSelection: nextDraft,
    })

    if (nextModel.financing.canFinance && nextModel.space.projected.freeArea >= 0) {
      persistSelection(nextModel)
    }
  }

  const incrementMachine = () => {
    if (!viewModel || !machineCandidate) {
      return
    }

    if (machineBlockedBySpace || machineBlockedByFinancing || !viewModel.guards.canAddMachine) {
      return
    }

    updateDraft({ newMachineCount: draftSelection.newMachineCount + 1 })
  }

  const decrementMachine = () => {
    updateDraft({ newMachineCount: Math.max(0, draftSelection.newMachineCount - 1) })
  }

  const incrementExpansion = () => {
    if (!viewModel || expansionBlockedByFinancing || !viewModel.guards.canAddExpansion) {
      return
    }

    updateDraft({ expansionCount: draftSelection.expansionCount + 1 })
  }

  const decrementExpansion = () => {
    updateDraft({ expansionCount: Math.max(0, draftSelection.expansionCount - 1) })
  }

  const handleSave = () => {
    if (!snapshot || !viewModel || !viewModel.financing.canFinance || viewModel.space.projected.freeArea < 0) {
      setStatusMessage('Investointipäätöstä ei voi tallentaa - tarkista tila- ja rahoitusrajoitteet.')
      return
    }

    if (!persistSelection(viewModel)) {
      return
    }

    setStatusMessage(
      `Investoinnit tallennettu: ${viewModel.totals.totalCostText}, uusi velka ${viewModel.financing.financingNeedText}.`,
    )
    onNavigate?.('/check')
  }

  if (!viewModel) {
    return (
      <section className="investments-page" aria-label="Investoinnit-näkymä latautuu">
        <header className="investments-header">
          <h1>INVESTOINNIT</h1>
          <p>Ladataan investointikatalogia...</p>
          {statusMessage ? <p role="status">{statusMessage}</p> : null}
        </header>
      </section>
    )
  }

  const settings = factorySettings
  const machineInvestment = settings.investments.newMachine
  const expansionInvestment = settings.investments.factoryExpansion
  const roundsPerYear = 12 / settings.game.monthsPerRound

  return (
    <section className="investments-page" aria-label="DO-vaiheen investoinnit">
      <header className="investments-header">
        <h1>INVESTOINNIT</h1>
      </header>

      <section className="investments-kpi-grid" aria-label="Rahoitus ja tehdastila">
        <Card>
          <article className="investments-kpi-card">
            <small>Investointivara</small>
            <strong>{viewModel.financing.remainingFinancingCapacityText}</strong>
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
            <strong>{viewModel.space.usedAreaText} / {viewModel.space.freeAreaText}</strong>
          </article>
        </Card>
      </section>

      <InvestmentRules settings={settings} />

      <section className="investments-catalog" aria-label="Investointivaihtoehdot">
        <Card>
          <article className="investments-card">
            <header>
              <h2>Uusi tuotantokone</h2>
              <strong className="investments-card__price">
                {INTEGER_FORMATTER.format(machineInvestment.price)} € / kone
              </strong>
            </header>
            <ul className="investments-card__details">
              <li>Kapasiteetti: +{INTEGER_FORMATTER.format(settings.production.hoursPerMachinePerRound)} h / kone</li>
              <li>Henkilöstö: +{INTEGER_FORMATTER.format(getAdditionalPersonnelFromMachines(1))} henkilöä / kone</li>
              <li>Tilantarve: {INTEGER_FORMATTER.format(machineSpace)} m² / kone</li>
              <li>
                Poisto: {formatPercent(factorySettings.finance.machineryDepreciationPerRound)} / kierros
                {' '}({formatPercent(factorySettings.finance.machineryDepreciationPerRound * roundsPerYear)} vuodessa)
              </li>
            </ul>
            {machineBlockedBySpace || machineBlockedByFinancing ? (
              <p className="investments-notice investments-notice--warning" role="status">
                {machineBlockedBySpace ? (
                  <span>Yksi kone tarvitsee {INTEGER_FORMATTER.format(machineSpace)} m². Vapauta tehdastilaa tai hanki tehdaslaajennus.</span>
                ) : null}
                {machineBlockedByFinancing ? (
                  <span>Investointivara ei riitä uuden koneen hankintaan.</span>
                ) : null}
              </p>
            ) : null}
            <div className="investments-counter" aria-label="Koneiden määrä">
              <span>Koneita</span>
              <div className="investments-counter__controls">
                <Button type="button" aria-label="Vähennä koneita" onClick={decrementMachine}>−</Button>
                <output aria-live="polite">{draftSelection.newMachineCount}</output>
                <Button type="button" aria-label="Lisää koneita" onClick={incrementMachine}>+</Button>
              </div>
            </div>
          </article>
        </Card>

        <Card>
          <article className="investments-card">
            <header>
              <h2>Tehdaslaajennus</h2>
              <strong className="investments-card__price">
                {INTEGER_FORMATTER.format(expansionInvestment.price)} € / laajennus
              </strong>
            </header>
            <ul className="investments-card__details">
              <li>Lisätila: +{INTEGER_FORMATTER.format(factorySettings.factory.factoryExpansionM2)} m² / laajennus</li>
              <li>
                Poisto: {formatPercent(factorySettings.finance.buildingDepreciationPerRound)} / kierros
                {' '}({formatPercent(factorySettings.finance.buildingDepreciationPerRound * roundsPerYear)} vuodessa)
              </li>
            </ul>
            {expansionBlockedByFinancing ? (
              <p className="investments-notice" role="status">
                Investointivara ei riitä tehdaslaajennuksen hankintaan.
              </p>
            ) : null}
            <div className="investments-counter" aria-label="Tehdaslaajennusten määrä">
              <span>Laajennuksia</span>
              <div className="investments-counter__controls">
                <Button type="button" aria-label="Vähennä laajennuksia" onClick={decrementExpansion}>−</Button>
                <output aria-live="polite">{draftSelection.expansionCount}</output>
                <Button type="button" aria-label="Lisää laajennuksia" onClick={incrementExpansion}>+</Button>
              </div>
            </div>
          </article>
        </Card>
      </section>

      <footer className="investments-actions">
        <div>
          {currentDecisionIsInvalid ? (
            <p role="alert">Investointipäätöstä ei voi hyväksyä - tarkista tila- ja rahoitusrajoitteet.</p>
          ) : null}
          {statusMessage ? <p role="status">{statusMessage}</p> : null}
          {savedDecision ? <small>Tallennettu kierrokselle {savedDecision.round}.</small> : null}
        </div>
        <Button
          type="button"
          disabled={!viewModel.financing.canFinance || viewModel.space.projected.freeArea < 0}
          onClick={handleSave}
        >
          Tallenna ja jatka
        </Button>
      </footer>
    </section>
  )
}

export default InvestmentsPage
