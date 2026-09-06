import { useEffect, useMemo, useState } from 'react'
import GameLayout from './layouts/GameLayout.jsx'
import LandingPage from '../pages/landing/LandingPage.jsx'
import LoginPage from '../pages/login/LoginPage.jsx'
import GamePlaceholderPage from '../pages/game/GamePlaceholderPage.jsx'
import PlanCockpitPage from '../pages/plan/PlanCockpitPage.jsx'
import PlanBalanceSheetPage from '../pages/plan/PlanBalanceSheetPage.jsx'
import PlanIncomePage from '../pages/plan/PlanIncomePage.jsx'
import PlanProductionPage from '../pages/plan/PlanProductionPage.jsx'
import FiveSPage from '../pages/do/FiveSPage.jsx'
import ProjectsPage from '../pages/do/ProjectsPage.jsx'
import InvestmentsPage from '../pages/do/InvestmentsPage.jsx'
import CheckPage from '../pages/check/CheckPage.jsx'
import ActPage from '../pages/act/ActPage.jsx'
import { appRoutes } from './router/index.jsx'
import { DEFAULT_FACTORY_SETTINGS } from '../entities/factory-settings/defaultFactorySettings.js'
import { createInitialGameState } from '../entities/factory-settings/initialGameState.js'
import { calculateRoundForecast } from '../entities/forecast/model.js'
import { buildGameHeaderKpis } from './headerKpis.js'

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
      window.history.replaceState({}, '', '/do/5s')
    }

    return '/do/5s'
  }

  return currentPath
}

const gamePhaseByPageKey = {
  'plan-cockpit': 'PLAN',
  'plan-production': 'PLAN',
  'plan-income': 'PLAN',
  'plan-balance-sheet': 'PLAN',
  'do-5s': 'DO',
  'do-projects': 'DO',
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
  'do-projects': {
    title: 'DO - Projektit',
    description: 'Projektien näkymä toteutetaan seuraavassa vaiheessa.',
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
  const [pathname, setPathname] = useState(() => normalizePath(window.location.pathname, true))
  const [gameState] = useState(() => createInitialGameState(DEFAULT_FACTORY_SETTINGS))

  const baseForecast = useMemo(
    () => calculateRoundForecast(gameState, {}, DEFAULT_FACTORY_SETTINGS),
    [gameState],
  )

  const inventoryTurnover = useMemo(() => {
    const deliveries = Number(baseForecast.summary.deliveries) || 0
    const averageInventory = Number(baseForecast.summary.finishedGoodsInventory) || 0
    if (averageInventory <= 0) {
      return 0
    }

    return deliveries / averageInventory
  }, [baseForecast])

  const gameHeaderKpis = useMemo(() => buildGameHeaderKpis(gameState, DEFAULT_FACTORY_SETTINGS), [gameState])

  useEffect(() => {
    const handlePopState = () => {
      setPathname(normalizePath(window.location.pathname, true))
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
  }

  if (pageKey === 'login') {
    return (
      <LoginPage
        onBackToLanding={() => navigateTo('/')}
        onLoginSuccess={() => navigateTo('/plan/cockpit')}
      />
    )
  }

  if (pageKey in gamePhaseByPageKey) {
    const phase = gamePhaseByPageKey[pageKey]
    const placeholderContent = placeholderContentByPageKey[pageKey]

    return (
      <GameLayout
        round={gameState.round}
        totalRounds={DEFAULT_FACTORY_SETTINGS.game.totalRounds}
        phase={phase}
        kpis={gameHeaderKpis}
        pageKey={pageKey}
        userName="Pelaaja"
        onLogout={() => navigateTo('/login')}
        onNavigate={navigateTo}
      >
        {pageKey === 'plan-cockpit' ? (
          <PlanCockpitPage
            onNavigate={navigateTo}
            round={gameState.round}
            totalRounds={DEFAULT_FACTORY_SETTINGS.game.totalRounds}
          />
        ) : pageKey === 'plan-balance-sheet' ? (
          <PlanBalanceSheetPage inventoryTurnover={inventoryTurnover} gameState={gameState} />
        ) : pageKey === 'plan-income' ? (
          <PlanIncomePage gameState={gameState} />
        ) : pageKey === 'plan-production' ? (
          <PlanProductionPage />
        ) : pageKey === 'do-5s' ? (
          <FiveSPage round={gameState.round} />
        ) : pageKey === 'do-projects' ? (
          <ProjectsPage round={gameState.round} />
        ) : pageKey === 'do-investments' ? (
          <InvestmentsPage round={gameState.round} />
        ) : pageKey === 'check' ? (
          <CheckPage
            onNavigate={navigateTo}
            gameState={gameState}
            factorySettings={DEFAULT_FACTORY_SETTINGS}
          />
        ) : pageKey === 'act' ? (
          <ActPage
            onNavigate={navigateTo}
            gameState={gameState}
            factorySettings={DEFAULT_FACTORY_SETTINGS}
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
