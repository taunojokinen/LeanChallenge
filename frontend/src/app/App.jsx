import { useEffect, useMemo, useState } from 'react'
import '../App.css'
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
import FinalReportPage from '../pages/game/FinalReportPage.jsx'
import { appRoutes } from './router/index.jsx'
import { resolveGamePath } from './router/gameNavigation.js'
import { DEFAULT_FACTORY_SETTINGS } from '../../../shared/factory-settings/defaultFactorySettings.js'
import { createInitialGameState } from '../../../shared/factory-settings/initialGameState.js'
import { calculateRoundForecast } from '../../../shared/forecast/model.js'
import { buildGameHeaderKpis } from './headerKpis.js'
import { advanceRoundState } from '../../../shared/game-round/advanceRound.js'
import { getGameCompletion } from '../../../shared/game-round/completion.js'
import { resetGameDecisionStorage } from '../features/session/resetGameSession.js'
import { loadCheckProductionDecision } from '../features/check/decisionStore.js'
import GameIntroDialog from '../features/game-intro/GameIntroDialog.jsx'
import { isGameIntroHidden } from '../features/game-intro/preferences.js'
import {
  TEACHER_TEST_GAME_MODE,
  CLASSROOM_GAME_MODE,
  clearTeacherTestGameSession,
  createTeacherTestGameSession,
  isTeacherTestGamePath,
  loadTeacherTestGameSession,
  saveTeacherTestGameSession,
  clearQuestGameSession,
  createQuestGameSession,
  loadQuestGameSession,
  saveQuestGameSession,
  clearClassroomGameSession,
  createClassroomGameSession,
  loadClassroomGameSession,
  saveClassroomGameSession,
} from '../features/session/teacherTestGameSession.js'
import { buildFactorySettingsFromSetup } from '../entities/factory-settings/setupToFactorySettings.js'
import { fetchCurrentTeacher, logoutTeacher } from '../shared/api/authApi.js'
import { fetchTeacherGames, createTeacherGame } from '../shared/api/teacherGamesApi.js'
import { fetchSetups } from '../shared/api/gamesApi.js'

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
  'game-report': 'REPORT',
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
  const [restoredSession] = useState(() => loadTeacherTestGameSession() ?? loadClassroomGameSession() ?? loadQuestGameSession())
  const [showGameIntro, setShowGameIntro] = useState(() => !restoredSession && !isGameIntroHidden())
  const [pathname, setPathname] = useState(() => normalizePath(window.location.pathname, true))
  const [lastGamePathname, setLastGamePathname] = useState(
    () => restoredSession?.pathname ?? '/plan/cockpit',
  )
  const [gameMode, setGameMode] = useState(() => restoredSession?.mode ?? 'quest')
  const [factorySettings, setFactorySettings] = useState(
    () => restoredSession?.factorySettings ?? DEFAULT_FACTORY_SETTINGS,
  )
  const [initialGameState, setInitialGameState] = useState(
    () => restoredSession?.initialGameState ?? createInitialGameState(DEFAULT_FACTORY_SETTINGS),
  )
  const [gameState, setGameState] = useState(
    () => restoredSession?.gameState ?? structuredClone(initialGameState),
  )
  const [playerName, setPlayerName] = useState(() => restoredSession?.playerName ?? '')
  const [selectedSetupName, setSelectedSetupName] = useState(() => restoredSession?.setupName ?? '')
  const [classroomSessionId, setClassroomSessionId] = useState(() => restoredSession?.classroomSessionId ?? null)
  const [teacher, setTeacher] = useState(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [teacherGames, setTeacherGames] = useState([])
  const [teacherGamesError, setTeacherGamesError] = useState('')
  const [isLoadingGames, setIsLoadingGames] = useState(false)
  const [setups, setSetups] = useState([])
  const [newGameName, setNewGameName] = useState('')
  const [newGameSetupId, setNewGameSetupId] = useState(null)
  const [createGameError, setCreateGameError] = useState('')
  const [isCreatingGame, setIsCreatingGame] = useState(false)
  const [roundStatus, setRoundStatus] = useState('')
  const completion = getGameCompletion(gameState, factorySettings.game.totalRounds)
  const effectivePathname = resolveGamePath(pathname, completion)

  const baseForecast = useMemo(
    () => completion ? null : calculateRoundForecast(gameState, {}, factorySettings),
    [completion, factorySettings, gameState],
  )

  const inventoryTurnover = useMemo(() => {
    const deliveries = Number(baseForecast?.summary.deliveries) || 0
    const averageInventory = Number(baseForecast?.summary.finishedGoodsInventory) || 0
    if (averageInventory <= 0) {
      return 0
    }

    return deliveries / averageInventory
  }, [baseForecast])

  const gameHeaderKpis = useMemo(
    () => buildGameHeaderKpis(gameState, factorySettings),
    [factorySettings, gameState],
  )

  // Tarkistetaan opettajan kirjautumistila sivun latautuessa
  useEffect(() => {
    fetchCurrentTeacher()
      .then((data) => setTeacher(data))
      .finally(() => setIsCheckingAuth(false))
  }, [])

  // Haetaan opettajan pelit ja vaikeustasot kun kirjautuminen on varmistettu
  useEffect(() => {
    if (!teacher) return

    let cancelled = false

    fetchTeacherGames()
      .then((games) => {
        if (!cancelled) setTeacherGames(games)
      })
      .catch((error) => {
        if (!cancelled) setTeacherGamesError(error.message)
      })
      .finally(() => {
        if (!cancelled) setIsLoadingGames(false)
      })

    fetchSetups()
      .then((data) => {
        if (!cancelled) setSetups(data)
      })
      .catch(() => {
        // Vaikeustasojen haku epäonnistui — lomake ei toimi, mutta pelilista näkyy
      })

    return () => { cancelled = true }
  }, [teacher])

  useEffect(() => {
    if (window.location.pathname !== effectivePathname) {
      window.history.replaceState({}, '', effectivePathname)
    }
  }, [effectivePathname, pathname])

  useEffect(() => {
    try {
      const createSession = gameMode === TEACHER_TEST_GAME_MODE
        ? createTeacherTestGameSession
        : gameMode === CLASSROOM_GAME_MODE
          ? createClassroomGameSession
          : createQuestGameSession
      const saveSession = gameMode === TEACHER_TEST_GAME_MODE
        ? saveTeacherTestGameSession
        : gameMode === CLASSROOM_GAME_MODE
          ? saveClassroomGameSession
          : saveQuestGameSession
      saveSession(createSession({
        factorySettings,
        initialGameState,
        gameState,
        playerName,
        setupName: selectedSetupName,
        classroomSessionId,
        pathname: completion ? '/game/report'
          : isTeacherTestGamePath(effectivePathname) ? effectivePathname : lastGamePathname,
      }))
    } catch (error) {
      console.error('Pelisession tallennus epäonnistui.', error)
    }
  }, [completion, effectivePathname, factorySettings, gameMode, gameState, initialGameState, lastGamePathname, playerName, selectedSetupName, classroomSessionId])

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
    const matchedRoute = appRoutes.find((route) => route.path === effectivePathname)

    return matchedRoute?.pageKey ?? 'landing'
  }, [effectivePathname])

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
    if (completion) {
      navigateTo('/game/report')
      return
    }

    const checkProductionDecision = loadCheckProductionDecision(gameState.round)
    const result = advanceRoundState({
      gameState,
      forecast,
      totalRounds: factorySettings.game.totalRounds,
      checkProductionDecision,
    })

    setGameState(result.nextGameState)

    if (result.isGameComplete) {
      setRoundStatus('')
      navigateTo('/game/report')
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
    clearQuestGameSession()
    clearClassroomGameSession()
    setGameMode(mode)
    setFactorySettings(sessionSettings)
    setInitialGameState(startState)
    setGameState(structuredClone(startState))
    setRoundStatus('')
    setShowGameIntro(!isGameIntroHidden())
    navigateTo(destination)
  }

  const handleLogout = () => {
    startNewGameSession('quest', DEFAULT_FACTORY_SETTINGS, '/login')
  }

  const handleStartQuest = (setup) => {
    const settings = setup ? buildFactorySettingsFromSetup(setup) : DEFAULT_FACTORY_SETTINGS
    setSelectedSetupName(setup?.name ?? '')
    startNewGameSession('quest', settings)
  }

  const handleStartTeacherTest = (settingsSnapshot) => {
    startNewGameSession(TEACHER_TEST_GAME_MODE, settingsSnapshot)
  }

  const handleJoinClassroomGame = ({ playerName: name, game }) => {
    const settings = buildFactorySettingsFromSetup(game.setup)
    setPlayerName(name)
    setClassroomSessionId(game.sessionId ?? null)
    startNewGameSession(CLASSROOM_GAME_MODE, settings)
  }

  const handleRestartGame = () => {
    startNewGameSession(gameMode, factorySettings)
  }

  const handleTeacherLogin = (teacherData) => {
    setTeacher(teacherData)
    setIsLoadingGames(true)
    setTeacherGamesError('')
  }

  const handleTeacherLogout = async () => {
    await logoutTeacher()
    setTeacher(null)
    setTeacherGames([])
    setTeacherGamesError('')
    setNewGameName('')
    setNewGameSetupId(null)
    setCreateGameError('')
    navigateTo('/login')
  }

  const handleCreateGame = async (event) => {
    event.preventDefault()
    setCreateGameError('')
    setIsCreatingGame(true)

    try {
      const newGame = await createTeacherGame(newGameName.trim(), newGameSetupId)
      setTeacherGames((prev) => [newGame, ...prev])
      setNewGameName('')
      setNewGameSetupId(null)
    } catch (error) {
      setCreateGameError(error.message)
    } finally {
      setIsCreatingGame(false)
    }
  }

  if (pageKey === 'login') {
    return (
      <LoginPage
        onBackToLanding={() => navigateTo('/')}
        onStartQuest={handleStartQuest}
        onJoinClassroomGame={handleJoinClassroomGame}
        onTeacherLogin={handleTeacherLogin}
      />
    )
  }

  if (pageKey === 'teacher-dashboard') {
    if (isCheckingAuth) {
      return null
    }

    if (!teacher) {
      navigateTo('/login')
      return null
    }

    return (
      <div className="teacher-dashboard">
        <h1>Tervetuloa, {teacher.displayName}</h1>

        <section className="teacher-create-game" aria-labelledby="create-game-title">
          <h2 id="create-game-title">Luo uusi peli</h2>

          <form onSubmit={handleCreateGame} className="teacher-create-form">
            <div className="teacher-field-group">
              <label htmlFor="game-name">Pelin nimi</label>
              <input
                id="game-name"
                type="text"
                value={newGameName}
                onChange={(e) => setNewGameName(e.target.value)}
                placeholder="Syötä pelin nimi"
                required
              />
            </div>

            <div className="teacher-field-group">
              <label htmlFor="game-setup">Vaikeustaso</label>
              <select
                id="game-setup"
                value={newGameSetupId ?? ''}
                onChange={(e) => setNewGameSetupId(Number(e.target.value))}
                required
              >
                <option value="" disabled>Valitse vaikeustaso</option>
                {setups.map((setup) => (
                  <option key={setup.id} value={setup.id}>{setup.name}</option>
                ))}
              </select>
            </div>

            {createGameError ? (
              <p className="teacher-games-notice teacher-games-notice--error" role="alert">{createGameError}</p>
            ) : null}

            <button type="submit" disabled={isCreatingGame || !newGameName.trim() || !newGameSetupId}>
              {isCreatingGame ? 'Luodaan…' : 'Luo peli'}
            </button>
          </form>
        </section>

        <section className="teacher-games" aria-labelledby="teacher-games-title">
          <h2 id="teacher-games-title">Omat pelit</h2>

          {isLoadingGames ? (
            <p className="teacher-games-notice" role="status">Ladataan pelejä…</p>
          ) : teacherGamesError ? (
            <p className="teacher-games-notice teacher-games-notice--error" role="alert">{teacherGamesError}</p>
          ) : teacherGames.length === 0 ? (
            <p className="teacher-games-notice">Ei pelejä vielä.</p>
          ) : (
            <ul className="teacher-games-list">
              {teacherGames.map((game) => (
                <li key={game.id} className="teacher-game-card">
                  <strong>{game.name}</strong>
                  <span className="teacher-game-code">Koodi: {game.joinCode}</span>
                  <span className="teacher-game-setup">{game.setupName}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <button type="button" onClick={handleTeacherLogout}>
          Kirjaudu ulos
        </button>
      </div>
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
        userName={playerName || 'Pelaaja'}
        onLogout={handleLogout}
        onNavigate={navigateTo}
        gameMode={gameMode}
        onReturnToTeacherSettings={() => navigateTo('/teacher/settings')}
        onRestartGame={handleRestartGame}
        completion={completion}
      >
        {pageKey === 'game-report' ? (
          <FinalReportPage
            gameState={gameState}
            totalRounds={factorySettings.game.totalRounds}
            onRestartGame={handleRestartGame}
          />
        ) : pageKey === 'plan-cockpit' ? (
          <PlanCockpitPage
            onNavigate={navigateTo}
            round={gameState.round}
            totalRounds={factorySettings.game.totalRounds}
            gameState={gameState}
            factorySettings={factorySettings}
            onOpenGameGoals={() => setShowGameIntro(true)}
          />
        ) : pageKey === 'plan-balance-sheet' ? (
          <PlanBalanceSheetPage
            inventoryTurnover={inventoryTurnover}
            gameState={gameState}
            factorySettings={factorySettings}
          />
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
        {pageKey === 'plan-cockpit' && showGameIntro ? (
          <GameIntroDialog onClose={() => setShowGameIntro(false)} />
        ) : null}
      </GameLayout>
    )
  }

  return <LandingPage onLogin={() => navigateTo('/login')} />
}

export default App
