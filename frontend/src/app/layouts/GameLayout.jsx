import GameHeader from '../../widgets/game-header/GameHeader.jsx'
import GameSidebar from '../../widgets/game-sidebar/GameSidebar.jsx'
import './GameLayout.css'

function GameLayout({
  round,
  totalRounds,
  phase,
  kpis,
  pageKey,
  userName,
  onLogout,
  onNavigate,
  gameMode,
  onReturnToTeacherSettings,
  onRestartGame,
  children,
}) {
  return (
    <div className="game-layout">
      <GameHeader
        round={round}
        totalRounds={totalRounds}
        phase={phase}
        kpis={kpis}
        userName={userName}
        onLogout={onLogout}
      />
      <div className="game-layout-body">
        <GameSidebar pageKey={pageKey} onNavigate={onNavigate} />
        <section className="game-layout-content">
          {gameMode === 'teacher-test' ? (
            <aside className="teacher-test-game-banner" aria-label="Opettajan testipeli">
              <strong>Opettajan testipeli</strong>
              <span>Pelissä käytetään tämän testin asetussnapshotia.</span>
              <div>
                <button className="ui-button teacher-test-game-action" type="button" onClick={onReturnToTeacherSettings}>
                  Opettajan asetuksiin
                </button>
                <button className="ui-button teacher-test-game-action" type="button" onClick={onRestartGame}>
                  Aloita testipeli alusta
                </button>
              </div>
            </aside>
          ) : null}
          {children}
        </section>
      </div>
    </div>
  )
}

export default GameLayout
