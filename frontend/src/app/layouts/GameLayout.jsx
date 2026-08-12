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
        <section className="game-layout-content">{children}</section>
      </div>
    </div>
  )
}

export default GameLayout
