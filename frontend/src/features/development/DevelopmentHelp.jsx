import { useEffect, useRef, useState } from 'react'
import Button from '../../shared/ui/Button/Button.jsx'
import {
  markDevelopmentHelpSeen,
  readDevelopmentHelpPreferences,
  saveDevelopmentHelpPreference,
  shouldAutoOpenDevelopmentHelp,
} from './helpPreferences.js'
import './DevelopmentHelp.css'

export function DevelopmentHelpDialog({ hidden, errorMessage, onClose, onPreferenceChange }) {
  const dialogRef = useRef(null)
  const titleRef = useRef(null)

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

  return (
    <dialog
      className="development-help-dialog"
      ref={dialogRef}
      aria-labelledby="development-help-title"
      aria-describedby="development-help-description"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
        }
      }}
    >
      <header className="development-help-dialog__header">
        <h2 id="development-help-title" ref={titleRef} tabIndex={-1}>Kehitystyö</h2>
        <button
          className="development-help-dialog__close"
          type="button"
          aria-label="Sulje ohje"
          onClick={onClose}
        >
          <span aria-hidden="true">&times;</span>
        </button>
      </header>
      <div id="development-help-description" className="development-help-dialog__content">
        <p>
          Kohdenna kehitystunteja tuotannon parantamiseen. Kehitystyön vaikutus on aluksi
          voimakkaampi, mutta pienenee kehitystason noustessa.
        </p>
        <p>
          Liukusäädin määrää tuntipanoksen ja ohut palkki näyttää ennustetun kehitystason.
          Vaikutukset toteutuvat kierroksen vahvistuksessa.
        </p>
        <h3>Kehitysmenetelmät</h3>
        <ul>
          <li><strong>5S:</strong> Parantaa työpisteiden järjestystä ja sujuvuutta. Vaikuttaa käytettävyyteen, nopeuteen ja laatuun.</li>
          <li><strong>SMED:</strong> Lyhentää koneistuksen asetusaikoja ja parantaa käytettävyyttä.</li>
          <li><strong>TPM:</strong> Vähentää konehäiriöitä ja parantaa käytettävyyttä.</li>
          <li><strong>SPC:</strong> Vähentää prosessin vaihtelua ja parantaa koneistuksen laatua.</li>
          <li><strong>Menetelmäkehitys:</strong> Tehostaa työmenetelmiä ja parantaa nopeutta kokoonpanossa ja lähettämössä.</li>
          <li><strong>Poka-Yoke:</strong> Ehkäisee virheitä ja parantaa laatua kokoonpanossa ja lähettämössä.</li>
        </ul>
      </div>
      {errorMessage ? <p className="development-help-dialog__error" role="alert">{errorMessage}</p> : null}
      <footer className="development-help-dialog__actions">
        <label>
          <input type="checkbox" checked={hidden} onChange={onPreferenceChange} />
          Älä näytä enää
        </label>
        <Button type="button" onClick={onClose}>Selvä</Button>
      </footer>
    </dialog>
  )
}

function DevelopmentHelp() {
  const [initialHelp] = useState(() => {
    if (typeof window === 'undefined') {
      return { open: false, hidden: false, errorMessage: '', shouldMarkSeen: false }
    }
    try {
      const preferences = readDevelopmentHelpPreferences()
      const open = shouldAutoOpenDevelopmentHelp(preferences)
      return { open, hidden: preferences.hidden, errorMessage: '', shouldMarkSeen: open }
    } catch (error) {
      console.error('Kehitystyön ohjeasetuksen lukeminen epäonnistui.', error)
      return {
        open: true,
        hidden: false,
        errorMessage: `Ohjeasetuksen lukeminen epäonnistui: ${error.message}`,
        shouldMarkSeen: false,
      }
    }
  })
  const [open, setOpen] = useState(initialHelp.open)
  const [hidden, setHidden] = useState(initialHelp.hidden)
  const [errorMessage, setErrorMessage] = useState(initialHelp.errorMessage)

  useEffect(() => {
    if (!initialHelp.shouldMarkSeen) {
      return
    }
    try {
      markDevelopmentHelpSeen()
    } catch (error) {
      console.error('Kehitystyön ohjeen näyttökerran tallennus epäonnistui.', error)
    }
  }, [initialHelp.shouldMarkSeen])

  const handlePreferenceChange = (event) => {
    const nextHidden = event.target.checked
    try {
      saveDevelopmentHelpPreference(nextHidden)
      setHidden(nextHidden)
      setErrorMessage('')
    } catch (error) {
      console.error('Kehitystyön ohjeasetuksen tallennus epäonnistui.', error)
      setErrorMessage(`Valinnan tallennus epäonnistui: ${error.message}`)
    }
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Ohje
      </Button>
      {open ? (
        <DevelopmentHelpDialog
          hidden={hidden}
          errorMessage={errorMessage}
          onClose={() => setOpen(false)}
          onPreferenceChange={handlePreferenceChange}
        />
      ) : null}
    </>
  )
}

export default DevelopmentHelp
