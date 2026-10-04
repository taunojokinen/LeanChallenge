import './GameSidebar.css'

const planSubPages = [
  { key: 'plan-cockpit', label: 'Cockpit', path: '/plan/cockpit' },
  { key: 'plan-income', label: 'Tulos', path: '/plan/income' },
  { key: 'plan-balance-sheet', label: 'Tase', path: '/plan/balance-sheet' },
]

const doSubPages = [
  { key: 'plan-development', label: 'Kehitystyö', path: '/plan/development' },
  { key: 'do-investments', label: 'Investoinnit', path: '/do/investments' },
]

const mainPages = [
  { key: 'plan', label: 'PLAN', path: '/plan/cockpit' },
  { key: 'do', label: 'DO', path: '/do' },
  { key: 'check', label: 'CHECK', path: '/check' },
  { key: 'act', label: 'ACT', path: '/act' },
]

function GameSidebar({ pageKey, onNavigate }) {
  const isPlanSectionActive = planSubPages.some((page) => page.key === pageKey)
  const isDoSectionActive = pageKey === 'do' || doSubPages.some((page) => page.key === pageKey)

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
