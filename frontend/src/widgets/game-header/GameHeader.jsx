import Button from '../../shared/ui/Button/Button.jsx'
import './GameHeader.css'

function GameHeader({ round, totalRounds, kpis, userName, onLogout }) {
  return (
    <header className="game-header">
      <div className="game-header-brand" aria-label="Lean Cockpit">
        <span className="game-header-brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <strong>LEAN COCKPIT</strong>
      </div>

      <div className="game-header-round" aria-label="Kierrostieto">
        <small>Kierros</small>
        <p>
          Kierros {round} / {totalRounds}
        </p>
      </div>

      <div className="game-header-kpis" aria-label="Pelin päätunnusluvut">
        {kpis.map((kpi) => (
          <article className="game-header-kpi" key={kpi.key}>
            <small>{kpi.label}</small>
            <p>{kpi.value}</p>
            <span className={kpi.delta.trim().startsWith('-') ? 'is-negative' : 'is-positive'}>
              {kpi.delta}
            </span>
          </article>
        ))}
      </div>

      <div className="game-header-user">
        <span>{userName}</span>
        <Button type="button" onClick={onLogout}>
          Uloskirjaus
        </Button>
      </div>
    </header>
  )
}

export default GameHeader
