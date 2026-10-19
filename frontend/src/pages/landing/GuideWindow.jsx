import { useEffect } from 'react'
import { APP_NAME } from '../../config/appConfig.js'
import './GuideWindow.css'

function GuideWindow({ guide, onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <aside
      className="landing-guide-window"
      id="landing-guide-window"
      role="dialog"
      aria-modal="false"
      aria-labelledby="landing-guide-title"
    >
      <header className="landing-guide-window-header">
        <h2 id="landing-guide-title">{guide.title}</h2>
        <button
          className="landing-guide-close"
          type="button"
          aria-label={`Sulje ohje: ${guide.title}`}
          onClick={onClose}
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>
      <div className="landing-guide-window-content">
        <p>{guide.summary}</p>
        <h3>{APP_NAME} -pelissä</h3>
        <p>{guide.inGame}</p>
      </div>
    </aside>
  )
}

export default GuideWindow
