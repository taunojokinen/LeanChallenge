import { useEffect, useMemo, useState } from 'react'
import LandingPage from '../pages/landing/LandingPage.jsx'
import LoginPage from '../pages/login/LoginPage.jsx'
import PlanPage from '../pages/plan/PlanPage.jsx'
import { appRoutes } from './router/index.jsx'

function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname || '/')

  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname || '/')
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
    if (nextPath === pathname) {
      return
    }

    window.history.pushState({}, '', nextPath)
    setPathname(nextPath)
  }

  if (pageKey === 'plan') {
    return <PlanPage />
  }

  if (pageKey === 'login') {
    return (
      <LoginPage
        onBackToLanding={() => navigateTo('/')}
        onLoginSuccess={() => navigateTo('/plan')}
      />
    )
  }

  return <LandingPage onLogin={() => navigateTo('/login')} />
}

export default App
