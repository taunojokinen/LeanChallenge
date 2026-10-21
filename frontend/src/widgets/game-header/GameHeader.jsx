import Button from '../../shared/ui/Button/Button.jsx'
import { APP_NAME } from '../../config/appConfig.js'
import { formatConfirmedKpiRound, formatGameplayRound } from './roundDisplay.js'
import './GameHeader.css'

function GameHeader({ round, totalRounds, kpis, userName, onLogout, completion }) {
  return (
    <header className="game-header">
      <div className="game-header-brand" aria-label={APP_NAME}>
        <span className="game-header-brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <strong>{APP_NAME.toUpperCase()}</strong>
      </div>

      <div className="game-header-round" aria-label="Kierrostieto">
        <p>{formatGameplayRound(round, totalRounds)}</p>
        <small>{completion
          ? `KPI:t vahvistettu kierrokselta ${completion.confirmedRound}`
          : formatConfirmedKpiRound(round)}</small>
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
