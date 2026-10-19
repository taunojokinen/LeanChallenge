import { useEffect, useRef } from 'react'
import { formatChange, formatPercent } from './cockpitModel.js'

function getChangeClass(value) {
  if (value > 0) return 'is-positive'
  if (value < 0) return 'is-negative'
  return 'is-neutral'
}

function CockpitDepartmentDialog({ departments, onClose }) {
  const dialogRef = useRef(null)
  const closeRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    const previouslyFocused = document.activeElement
    const previousOverflow = document.body.style.overflow
    dialog.showModal()
    closeRef.current.focus()
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
      className="cockpit-department-dialog"
      ref={dialogRef}
      aria-labelledby="cockpit-details-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
        } else if (event.key === 'Tab') {
          event.preventDefault()
          closeRef.current.focus()
        }
      }}
    >
      <header className="cockpit-section-heading">
        <h2 id="cockpit-details-title">Osastojen tarkemmat tiedot</h2>
        <button className="ui-button cockpit-details-button" ref={closeRef} type="button" onClick={onClose}>
          Sulje
        </button>
      </header>
      <div className="cockpit-department-grid">
        {departments.map((department) => (
          <article className="cockpit-department-card" key={department.key}>
            <h3>{department.name}</h3>
            <table>
              <caption className="visually-hidden">{department.name} K/N/L/KNL-vertailu</caption>
              <thead>
                <tr>
                  <th scope="col">Mittari</th>
                  <th scope="col">Kierros {department.previousRound}</th>
                  <th scope="col">Kierros {department.currentRound}</th>
                  <th scope="col">Muutos</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(department.metrics).map((metric) => (
                  <tr key={metric.key}>
                    <th scope="row">{metric.label}</th>
                    <td>{formatPercent(metric.previous)}</td>
                    <td>{formatPercent(metric.current)}</td>
                    <td className={`comparison-change ${getChangeClass(metric.change)}`}>
                      {formatChange(metric.change)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        ))}
      </div>
    </dialog>
  )
}

export default CockpitDepartmentDialog
