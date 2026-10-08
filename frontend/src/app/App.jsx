import { useEffect, useMemo, useState } from 'react'
import GameLayout from './layouts/GameLayout.jsx'
import LandingPage from '../pages/landing/LandingPage.jsx'
import LoginPage from '../pages/login/LoginPage.jsx'
import TeacherSettingsPage from '../pages/teacher/TeacherSettingsPage.jsx'
import GamePlaceholderPage from '../pages/game/GamePlaceholderPage.jsx'
import PlanCockpitPage from '../pages/plan/PlanCockpitPage.jsx'
import PlanBalanceSheetPage from '../pages/plan/PlanBalanceSheetPage.jsx'
import PlanIncomePage from '../pages/plan/PlanIncomePage.jsx'
import DevelopmentPage from '../pages/do/DevelopmentPage.jsx'
import InvestmentsPage from '../pages/do/InvestmentsPage.jsx'
import CheckPage from '../pages/check/CheckPage.jsx'
import ActPage from '../pages/act/ActPage.jsx'
import { appRoutes } from './router/index.jsx'
import { DEFAULT_FACTORY_SETTINGS } from '../entities/factory-settings/defaultFactorySettings.js'
import { createInitialGameState } from '../entities/factory-settings/initialGameState.js'
import { calculateRoundForecast } from '../entities/forecast/model.js'
import { buildGameHeaderKpis } from './headerKpis.js'
import { advanceRoundState } from '../entities/game-round/advanceRound.js'
import { resetGameDecisionStorage } from '../features/session/resetGameSession.js'
import { loadCheckProductionDecision } from '../features/check/decisionStore.js'
import {
  TEACHER_TEST_GAME_MODE,
  clearTeacherTestGameSession,
  createTeacherTestGameSession,
  isTeacherTestGamePath,
  loadTeacherTestGameSession,
  saveTeacherTestGameSession,
} from '../features/session/teacherTestGameSession.js'

function normalizePath(pathname, shouldReplace = false) {
  const currentPath = pathname || '/'

  if (currentPath === '/plan') {
    if (shouldReplace) {
      window.history.replaceState({}, '', '/plan/cockpit')
    }

    return '/plan/cockpit'
  }

  if (currentPath === '/do' || currentPath === '/do/') {
    if (shouldReplace) {
      window.history.replaceState({}, '', '/plan/development')
    }

    return '/plan/development'
  }

  return currentPath
}

const gamePhaseByPageKey = {
  'plan-cockpit': 'PLAN',
  'plan-income': 'PLAN',
  'plan-balance-sheet': 'PLAN',
  'plan-development': 'PLAN',
  'do-investments': 'DO',
  do: 'DO',
  check: 'CHECK',
  act: 'ACT',
  investments: 'ACT',
}

const placeholderContentByPageKey = {
  'plan-balance-sheet': {
    title: 'PLAN - Tase',
    description: 'Tasesivu toteutetaan seuraavassa vaiheessa.',
  },
  do: {
    title: 'DO',
    description: 'DO-vaiheen Lean-toimenpiteet toteutetaan seuraavassa vaiheessa.',
  },
  'do-investments': {
    title: 'DO - Investoinnit',
    description: 'DO-vaiheen investointinäkymä toteutetaan seuraavassa vaiheessa.',
  },
  check: {
    title: 'CHECK',
    description: 'CHECK-vaiheen ennuste- ja vertailunäkymä toteutetaan seuraavassa vaiheessa.',
  },
  act: {
    title: 'ACT',
    description: 'ACT-vaiheen kaupalliset päätökset toteutetaan seuraavassa vaiheessa.',
  },
  investments: {
    title: 'Investoinnit',
    description: 'Investointien näkymä toteutetaan seuraavassa vaiheessa.',
  },
}

function App() {
  const [restoredTeacherSession] = useState(() => loadTeacherTestGameSession())
  const [pathname, setPathname] = useState(() => normalizePath(window.location.pathname, true))
  const [lastGamePathname, setLastGamePathname] = useState(
    () => restoredTeacherSession?.pathname ?? '/plan/cockpit',
  )
  const [gameMode, setGameMode] = useState(() => restoredTeacherSession?.mode ?? 'quest')
  const [factorySettings, setFactorySettings] = useState(
    () => restoredTeacherSession?.factorySettings ?? DEFAULT_FACTORY_SETTINGS,
  )
  const [initialGameState, setInitialGameState] = useState(
    () => restoredTeacherSession?.initialGameState ?? createInitialGameState(DEFAULT_FACTORY_SETTINGS),
  )
  const [gameState, setGameState] = useState(
    () => restoredTeacherSession?.gameState ?? createInitialGameState(DEFAULT_FACTORY_SETTINGS),
  )
  const [roundStatus, setRoundStatus] = useState('')

  const baseForecast = useMemo(
    () => calculateRoundForecast(gameState, {}, factorySettings),
    [factorySettings, gameState],
  )

  const inventoryTurnover = useMemo(() => {
    const deliveries = Number(baseForecast.summary.deliveries) || 0
    const averageInventory = Number(baseForecast.summary.finishedGoodsInventory) || 0
    if (averageInventory <= 0) {
      return 0
    }

    return deliveries / averageInventory
  }, [baseForecast])

  const gameHeaderKpis = useMemo(
    () => buildGameHeaderKpis(gameState, factorySettings),
    [factorySettings, gameState],
  )

  useEffect(() => {
    if (gameMode !== TEACHER_TEST_GAME_MODE) {
      clearTeacherTestGameSession()
      return
    }

    try {
      saveTeacherTestGameSession(createTeacherTestGameSession({
        factorySettings,
        initialGameState,
        gameState,
        pathname: isTeacherTestGamePath(pathname) ? pathname : lastGamePathname,
      }))
    } catch (error) {
      console.error('Testipelin session tallennus epäonnistui.', error)
    }
  }, [factorySettings, gameMode, gameState, initialGameState, lastGamePathname, pathname])

  useEffect(() => {
    const handlePopState = () => {
      const nextPathname = normalizePath(window.location.pathname, true)
      setPathname(nextPathname)
      if (isTeacherTestGamePath(nextPathname)) {
        setLastGamePathname(nextPathname)
      }
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  const pageKey = useMemo(() => {
    const matchedRoute = appRoutes.find((route) => route.path === pathname)

    return matchedRoute?.pageKey ?? 'landing'
  }, [pathname])

  const navigateTo = (nextPath) => {
    const normalizedPath = normalizePath(nextPath)

    if (normalizedPath === pathname) {
      return
    }

    window.history.pushState({}, '', normalizedPath)
    setPathname(normalizedPath)
    if (isTeacherTestGamePath(normalizedPath)) {
      setLastGamePathname(normalizedPath)
    }
  }

  const handleAdvanceRound = (forecast) => {
    const checkProductionDecision = loadCheckProductionDecision(gameState.round)
    const result = advanceRoundState({
      gameState,
      forecast,
      totalRounds: factorySettings.game.totalRounds,
      checkProductionDecision,
    })

    setGameState(result.nextGameState)

    if (result.isGameOver) {
      setRoundStatus('Peli päättyi, koska closing equity on nolla tai negatiivinen.')
      return result
    }

    if (result.isGameComplete) {
      setRoundStatus('Kaikki pelatut kierrokset on vahvistettu.')
      return result
    }

    setRoundStatus('Kierros vahvistettu.')
    navigateTo('/plan/cockpit')
    return result
  }

  const startNewGameSession = (mode, settings, destination = '/plan/cockpit') => {
    const sessionSettings = structuredClone(settings)
    const startState = createInitialGameState(sessionSettings)
    resetGameDecisionStorage()
    clearTeacherTestGameSession()
    setGameMode(mode)
    setFactorySettings(sessionSettings)
    setInitialGameState(startState)
    setGameState(structuredClone(startState))
    setRoundStatus('')
    navigateTo(destination)
  }

  const handleLogout = () => {
    startNewGameSession('quest', DEFAULT_FACTORY_SETTINGS, '/login')
  }

  const handleStartQuest = () => {
    startNewGameSession('quest', DEFAULT_FACTORY_SETTINGS)
  }

  const handleStartTeacherTest = (settingsSnapshot) => {
    startNewGameSession(TEACHER_TEST_GAME_MODE, settingsSnapshot)
  }

  const handleRestartGame = () => {
    startNewGameSession(gameMode, factorySettings)
  }

  if (pageKey === 'login') {
    return (
      <LoginPage
        onBackToLanding={() => navigateTo('/')}
        onStartQuest={handleStartQuest}
        onOpenTeacherSettings={() => navigateTo('/teacher/settings')}
      />
    )
  }

  if (pageKey === 'teacher-settings') {
    return (
      <TeacherSettingsPage
        onBackToLogin={() => navigateTo('/login')}
        onStartTestGame={handleStartTeacherTest}
      />
    )
  }

  if (pageKey in gamePhaseByPageKey) {
    const phase = gamePhaseByPageKey[pageKey]
    const placeholderContent = placeholderContentByPageKey[pageKey]

    return (
      <GameLayout
        round={gameState.round}
        totalRounds={factorySettings.game.totalRounds}
        phase={phase}
        kpis={gameHeaderKpis}
        pageKey={pageKey}
        userName="Pelaaja"
        onLogout={handleLogout}
        onNavigate={navigateTo}
        gameMode={gameMode}
        onReturnToTeacherSettings={() => navigateTo('/teacher/settings')}
        onRestartGame={handleRestartGame}
      >
        {pageKey === 'plan-cockpit' ? (
          <PlanCockpitPage
            onNavigate={navigateTo}
            round={gameState.round}
            totalRounds={factorySettings.game.totalRounds}
            gameState={gameState}
            factorySettings={factorySettings}
          />
        ) : pageKey === 'plan-balance-sheet' ? (
          <PlanBalanceSheetPage inventoryTurnover={inventoryTurnover} gameState={gameState} />
        ) : pageKey === 'plan-income' ? (
          <PlanIncomePage
            gameState={gameState}
            factorySettings={factorySettings}
          />
        ) : pageKey === 'plan-development' ? (
          <DevelopmentPage
            onNavigate={navigateTo}
            gameState={gameState}
            factorySettings={factorySettings}
          />
        ) : pageKey === 'do-investments' ? (
          <InvestmentsPage
            onNavigate={navigateTo}
            round={gameState.round}
            gameState={gameState}
            factorySettings={factorySettings}
          />
        ) : pageKey === 'check' ? (
          <CheckPage
            onNavigate={navigateTo}
            gameState={gameState}
            factorySettings={factorySettings}
          />
        ) : pageKey === 'act' ? (
          <ActPage
            onNavigate={navigateTo}
            gameState={gameState}
            factorySettings={factorySettings}
            onAdvanceRound={handleAdvanceRound}
            statusMessage={roundStatus}
          />
        ) : (
          <GamePlaceholderPage title={placeholderContent.title} description={placeholderContent.description} />
        )}
      </GameLayout>
    )
  }

  return <LandingPage onLogin={() => navigateTo('/login')} />
}

export default App
