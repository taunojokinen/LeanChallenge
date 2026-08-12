import './GamePlaceholderPage.css'

function GamePlaceholderPage({ title, description }) {
  return (
    <div className="game-placeholder-page">
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  )
}

export default GamePlaceholderPage
