import { useEffect, useMemo, useState } from 'react'
import GameLayout from './layouts/GameLayout.jsx'
import LandingPage from '../pages/landing/LandingPage.jsx'
import LoginPage from '../pages/login/LoginPage.jsx'
import GamePlaceholderPage from '../pages/game/GamePlaceholderPage.jsx'
import planSnapshot from '../mocks/planSnapshot.json'
import PlanCockpitPage from '../pages/plan/PlanCockpitPage.jsx'
import PlanPage from '../pages/plan/PlanPage.jsx'
import { appRoutes } from './router/index.jsx'

function normalizePath(pathname, shouldReplace = false) {
  const currentPath = pathname || '/'

  if (currentPath === '/plan') {
    if (shouldReplace) {
      window.history.replaceState({}, '', '/plan/cockpit')
    }

    return '/plan/cockpit'
  }

  return currentPath
}

const gamePhaseByPageKey = {
  'plan-cockpit': 'PLAN',
  'plan-production': 'PLAN',
  'plan-income': 'PLAN',
  'plan-balance-sheet': 'PLAN',
  do: 'DO',
  check: 'CHECK',
  act: 'ACT',
  investments: 'ACT',
}

const placeholderContentByPageKey = {
  'plan-income': {
    title: 'PLAN - Tulos',
    description: 'Tulossivu toteutetaan seuraavassa vaiheessa.',
  },
  'plan-balance-sheet': {
    title: 'PLAN - Tase',
    description: 'Tasesivu toteutetaan seuraavassa vaiheessa.',
  },
  do: {
    title: 'DO',
    description: 'DO-vaiheen Lean-toimenpiteet toteutetaan seuraavassa vaiheessa.',
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

const headerKpiMap = {
  oee: 'KNL',
  production: 'Tuotantomäärä',
  revenue: 'Liikevaihto',
  result: 'Tulos',
  inventoryTurnover: 'Varaston kiertonopeus',
}

const gameHeaderKpis = ['oee', 'production', 'revenue', 'result', 'inventoryTurnover']
  .map((key) => planSnapshot.kpis.find((item) => item.key === key))
  .filter(Boolean)
  .map((item) => ({
    key: item.key,
    label: headerKpiMap[item.key] ?? item.label,
    value:
      item.key === 'inventoryTurnover'
        ? `${Number(item.value).toLocaleString('fi-FI', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}x`
        : item.value,
    delta: item.delta,
  }))

function App() {
  const [pathname, setPathname] = useState(() => normalizePath(window.location.pathname, true))

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
        round={planSnapshot.round}
        totalRounds={planSnapshot.totalRounds}
        phase={phase}
        kpis={gameHeaderKpis}
        pageKey={pageKey}
        userName="Pelaaja"
        onLogout={() => navigateTo('/login')}
        onNavigate={navigateTo}
      >
        {pageKey === 'plan-cockpit' ? (
          <PlanCockpitPage onNavigate={navigateTo} />
        ) : pageKey === 'plan-production' ? (
          <PlanPage />
        ) : (
          <GamePlaceholderPage title={placeholderContent.title} description={placeholderContent.description} />
        )}
      </GameLayout>
    )
  }

  return <LandingPage onLogin={() => navigateTo('/login')} />
}

export default App
