import { useEffect, useRef, useState } from 'react'
import { APP_NAME } from '../../config/appConfig.js'
import Button from '../../shared/ui/Button/Button.jsx'
import { isGameIntroHidden, saveGameIntroPreference } from './preferences.js'
import './GameIntroDialog.css'

function GameIntroDialog({ onClose }) {
  const dialogRef = useRef(null)
  const titleRef = useRef(null)
  const [hidden, setHidden] = useState(() => isGameIntroHidden())
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    const previouslyFocused = document.activeElement
    const previousOverflow = document.body.style.overflow
    dialog.showModal()
    titleRef.current.focus()
    document.body.style.overflow = 'hidden'

    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus()
      }
    }
  }, [])

  const handlePreferenceChange = (event) => {
    const nextHidden = event.target.checked
    try {
      saveGameIntroPreference(nextHidden)
      setHidden(nextHidden)
      setErrorMessage('')
    } catch (error) {
      console.error('Aloitusikkunan näyttöasetuksen tallennus epäonnistui.', error)
      setErrorMessage(`Valinnan tallennus epäonnistui: ${error.message}`)
    }
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const controls = [...dialogRef.current.querySelectorAll('input, button')]
    const first = controls[0]
    const last = controls.at(-1)
    if (event.shiftKey && (document.activeElement === first || document.activeElement === titleRef.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <dialog
      className="game-intro-dialog"
      ref={dialogRef}
      aria-labelledby="game-intro-title"
      aria-describedby="game-intro-description"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onKeyDown={handleKeyDown}
    >
      <h2 id="game-intro-title" ref={titleRef} tabIndex={-1}>{APP_NAME.toUpperCase()}</h2>
      <div id="game-intro-description" className="game-intro-copy">
        <p>Onneksi olkoon! Olet juuri aloittanut uuden työsi tuotantopäällikkönä.</p>
        <p>Vastuullasi on kolme osastoa: <strong>koneistus, kokoonpano ja lähettämö</strong>.</p>
        <p>
          Yrityksen tilanne ei kuitenkaan näytä hyvältä. Ensimmäisellä tehdaskierroksellasi huomaat,
          että työpisteet ovat epäjärjestyksessä ja tuotanto toimii tehottomasti.
          Tämä näkyy myös tehtaan <strong>KNL-mittareissa</strong>.
        </p>
        <p>Heikko suorituskyky rasittaa yrityksen taloutta, ja tilanne uhkaa kriisiytyä.</p>
        <p>
          Sinulla on <strong>12 kierrosta aikaa</strong> osoittaa kykysi. Kehitä tuotantoa Lean-menetelmillä,
          paranna tehtaan suorituskykyä ja käännä yrityksen talous kestävälle pohjalle.
        </p>
        <p><strong>Onnea uuteen tehtävääsi!</strong></p>
      </div>
      {errorMessage ? <p className="game-intro-error" role="alert">{errorMessage}</p> : null}
      <div className="game-intro-actions">
        <label>
          <input type="checkbox" checked={hidden} onChange={handlePreferenceChange} />
          Älä näytä enää
        </label>
        <Button type="button" onClick={onClose}>Aloita peli</Button>
      </div>
    </dialog>
  )
}

export default GameIntroDialog
