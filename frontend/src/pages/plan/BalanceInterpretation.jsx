const statusLabels = {
  danger: 'Kriittinen',
  warning: 'Seurattava',
  success: 'Hyvä',
  neutral: 'Ei arviota',
}

function InterpretationCard({ title, data, statusLabel = statusLabels[data.status], children }) {
  return (
    <article className={`balance-interpretation-card is-${data.status}`}>
      <header>
        <h3>{title}</h3>
        <span className="balance-interpretation-status">{statusLabel}</span>
      </header>
      <p className="balance-interpretation-value">{data.value}</p>
      {children}
      <p>{data.text}</p>
    </article>
  )
}

export default function BalanceInterpretation({ interpretation }) {
  return (
    <aside className="balance-interpretation" aria-labelledby="balance-interpretation-title">
      <h2 id="balance-interpretation-title">Taseen tulkinta</h2>
      <InterpretationCard title="Oman pääoman riittävyys" data={interpretation.capital} />
      <InterpretationCard
        title="Omavaraisuusaste ja lainanottovara"
        data={interpretation.solvency}
        statusLabel={interpretation.solvency.status === 'warning' ? 'Tyydyttävä' : undefined}
      >
        <p className="balance-interpretation-neutral">Lainanottovara: <strong>{interpretation.solvency.debtHeadroomText}</strong></p>
      </InterpretationCard>
      <InterpretationCard
        title="Varaston tehokkuus"
        data={interpretation.inventory}
        statusLabel={interpretation.inventory.status === 'danger' ? 'Heikko' : undefined}
      >
        <p>Varastoon sitoutunut pääoma: <strong>{interpretation.inventory.capitalText}</strong></p>
      </InterpretationCard>
    </aside>
  )
}
