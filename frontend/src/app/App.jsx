import { useEffect, useMemo, useState } from 'react'
import CockpitPage from '../pages/cockpit/CockpitPage.jsx'
import LandingPage from '../pages/landing/LandingPage.jsx'
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

  if (pageKey === 'cockpit') {
    return <CockpitPage />
  }

  return <LandingPage onLogin={() => navigateTo('/cockpit')} />
}

export default App
