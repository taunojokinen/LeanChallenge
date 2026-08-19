import './GameSidebar.css'

const planSubPages = [
  { key: 'plan-cockpit', label: 'Cockpit', path: '/plan/cockpit' },
  { key: 'plan-income', label: 'Tulos', path: '/plan/income' },
  { key: 'plan-balance-sheet', label: 'Tase', path: '/plan/balance-sheet' },
  { key: 'plan-production', label: 'Tuotanto', path: '/plan/production' },
]

const doSubPages = [
  { key: 'do-5s', label: '5S', path: '/do/5s' },
  { key: 'do-projects', label: 'Projektit', path: '/do/projects' },
  { key: 'do-investments', label: 'Investoinnit', path: '/do/investments' },
]

const mainPages = [
  { key: 'plan', label: 'PLAN', path: '/plan/cockpit' },
  { key: 'do', label: 'DO', path: '/do' },
  { key: 'check', label: 'CHECK', path: '/check' },
  { key: 'act', label: 'ACT', path: '/act' },
  { key: 'investments', label: 'Investoinnit', path: '/investments' },
]

function GameSidebar({ pageKey, onNavigate }) {
  const isPlanSectionActive = pageKey.startsWith('plan-')
  const isDoSectionActive = pageKey === 'do' || pageKey.startsWith('do-')

  return (
    <aside className="game-sidebar" aria-label="Pelin sivunavigaatio">
      <nav className="game-sidebar-nav">
        {mainPages.map((item) => {
          const isActiveMain =
            item.key === 'plan'
              ? isPlanSectionActive
              : item.key === 'do'
              ? isDoSectionActive
              : pageKey === item.key || pageKey.startsWith(`${item.key}-`)

          return (
            <div className="game-sidebar-main-item" key={item.key}>
              <button
                type="button"
                className={`game-sidebar-main-link ${isActiveMain ? 'is-active' : ''}`}
                onClick={() => onNavigate(item.path)}
              >
                {item.label}
              </button>

              {item.key === 'plan' ? (
                <div className="game-sidebar-subnav" aria-label="PLAN alisivut">
                  {planSubPages.map((subPage) => (
                    <button
                      type="button"
                      key={subPage.key}
                      className={`game-sidebar-sub-link ${pageKey === subPage.key ? 'is-active' : ''}`}
                      onClick={() => onNavigate(subPage.path)}
                    >
                      {subPage.label}
                    </button>
                  ))}
                </div>
              ) : item.key === 'do' ? (
                <div className="game-sidebar-subnav" aria-label="DO alisivut">
                  {doSubPages.map((subPage) => (
                    <button
                      type="button"
                      key={subPage.key}
                      className={`game-sidebar-sub-link ${pageKey === subPage.key ? 'is-active' : ''}`}
                      onClick={() => onNavigate(subPage.path)}
                    >
                      {subPage.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}

export default GameSidebar
