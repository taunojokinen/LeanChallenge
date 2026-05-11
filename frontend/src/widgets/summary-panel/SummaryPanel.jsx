import './summary-panel.css'

function SummaryPanel({ summary }) {
  return (
    <section className="summary-panel">
      <div className="summary-cards">
        {summary.cards.map((card) => (
          <article className="summary-card" key={card.label}>
            <h3>{card.label}</h3>
            <p>{card.value}</p>
            <small>{card.target}</small>
          </article>
        ))}
      </div>
      <button type="button" className="ready-button">
        {summary.actionLabel}
      </button>
    </section>
  )
}

export default SummaryPanel
