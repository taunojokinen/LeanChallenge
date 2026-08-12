import './GameSidebar.css'

const planSubPages = [
  { key: 'plan-income', label: 'Tulos', path: '/plan/income' },
  { key: 'plan-balance-sheet', label: 'Tase', path: '/plan/balance-sheet' },
  { key: 'plan-production', label: 'Tuotanto', path: '/plan/production' },
]

const mainPages = [
  { key: 'plan', label: 'PLAN', path: '/plan/production' },
  { key: 'do', label: 'DO', path: '/do' },
  { key: 'check', label: 'CHECK', path: '/check' },
  { key: 'act', label: 'ACT', path: '/act' },
  { key: 'investments', label: 'Investoinnit', path: '/investments' },
]

function GameSidebar({ pageKey, onNavigate }) {
  const isPlanSectionActive = pageKey.startsWith('plan-')

  return (
    <aside className="game-sidebar" aria-label="Pelin sivunavigaatio">
      <nav className="game-sidebar-nav">
        {mainPages.map((item) => {
          const isActiveMain =
            item.key === 'plan' ? isPlanSectionActive : pageKey === item.key || pageKey.startsWith(`${item.key}-`)

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
              ) : null}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}

export default GameSidebar
