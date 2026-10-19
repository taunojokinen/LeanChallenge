import { useState } from 'react'
import { APP_NAME } from '../../config/appConfig.js'
import Button from '../../shared/ui/Button/Button.jsx'
import {
  TEACHER_SETTING_DEFINITIONS,
  TEACHER_SETTING_GROUPS,
  buildFactorySettingsSnapshot,
  createDefaultTeacherPreferences,
  getTeacherSelectedValue,
  getTeacherSliderStepCount,
  loadTeacherPreferences,
  resetTeacherPreferences,
  saveTeacherPreferences,
  validateTeacherPreferences,
} from '../../entities/factory-settings/teacherGameSettings.js'
import './TeacherSettingsPage.css'

const INTEGER_FORMATTER = new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 0 })
const DECIMAL_FORMATTER = new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 1 })
const DISPLAY_GROUP_ORDER = ['result', 'balance', 'development', 'production', 'market']
const DISPLAY_GROUPS = [...TEACHER_SETTING_GROUPS].sort(
  (a, b) => DISPLAY_GROUP_ORDER.indexOf(a.id) - DISPLAY_GROUP_ORDER.indexOf(b.id),
)

function formatSettingValue(definition, value) {
  if (!Number.isFinite(value)) {
    return 'Tarkista rajat'
  }

  const formatted = definition.step < 1
    ? DECIMAL_FORMATTER.format(value)
    : INTEGER_FORMATTER.format(value)
  return `${formatted} ${definition.unit}`
}

function SettingRow({ definition, preferences, errors, onBoundaryChange, onPositionChange }) {
  const preference = preferences[definition.id]
  const value = getTeacherSelectedValue(definition.id, preferences)
  const defaultValue = getTeacherSelectedValue(definition.id, createDefaultTeacherPreferences())
  const sliderSteps = getTeacherSliderStepCount(definition.id, preferences)
  const parameterErrors = errors.filter((error) => error.id === definition.id)
  const hasError = parameterErrors.length > 0
  const sliderDisabled = sliderSteps == null || sliderSteps < 1
  const sliderPosition = sliderDisabled
    ? 0
    : Math.min(sliderSteps, Math.max(0, Number(preference.position) || 0))
  const describedBy = [`setting-help-${definition.id}`, hasError ? `setting-error-${definition.id}` : null]
    .filter(Boolean)
    .join(' ')

  const renderBoundaryInput = (field, label) => (
    <label className={`teacher-boundary teacher-boundary-${field}`}>
      <span>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={definition.min}
        max={definition.max}
        step="any"
        value={preference[field]}
        aria-label={`${definition.label}, ${label}-raja`}
        aria-invalid={hasError}
        aria-describedby={describedBy}
        onChange={(event) => onBoundaryChange(definition.id, field, event.target.value)}
      />
    </label>
  )

  return (
    <article className={`teacher-setting-row${hasError ? ' has-error' : ''}`}>
      <div className="teacher-setting-name">
        <strong>{definition.label}</strong>
        <span className="teacher-setting-unit">{definition.unit}</span>
      </div>
      {renderBoundaryInput('easy', 'Minimi')}
      <div className="teacher-game-value">
        <label htmlFor={`setting-position-${definition.id}`}>Pelin arvo</label>
        <output htmlFor={`setting-position-${definition.id}`}>
          {formatSettingValue(definition, value)}
        </output>
      </div>
      {renderBoundaryInput('hard', 'Maksimi')}
      <input
        className="teacher-setting-slider"
        id={`setting-position-${definition.id}`}
        type="range"
        min="0"
        max={Math.max(1, sliderSteps ?? 1)}
        step="1"
        value={sliderPosition}
        disabled={sliderDisabled}
        aria-label={`${definition.label}, pelin arvo minimi- ja maksimirajan välillä`}
        aria-describedby={describedBy}
        onChange={(event) => onPositionChange(definition.id, Number(event.target.value))}
      />
      <small className="teacher-setting-default">Moottorin oletus {formatSettingValue(definition, defaultValue)}</small>
      <p className="teacher-setting-help" id={`setting-help-${definition.id}`}>
        {definition.help}
      </p>
      {hasError ? (
        <ul className="teacher-setting-errors" id={`setting-error-${definition.id}`}>
          {parameterErrors.map((error) => <li key={error.message}>{error.message}</li>)}
        </ul>
      ) : null}
    </article>
  )
}

function TeacherSettingsPage({ onBackToLogin, onStartTestGame }) {
  const [preferences, setPreferences] = useState(() => loadTeacherPreferences())
  const [status, setStatus] = useState('Suosikkiasetukset ladataan tästä selaimesta.')
  const validation = validateTeacherPreferences(preferences)

  const markUnsaved = () => setStatus('Tallentamattomia muutoksia.')

  const handleBoundaryChange = (parameterId, field, rawValue) => {
    const value = rawValue === '' ? '' : Number(rawValue)
    setPreferences((current) => {
      const next = {
        ...current,
        [parameterId]: {
          ...current[parameterId],
          [field]: value,
        },
      }
      const steps = getTeacherSliderStepCount(parameterId, next)
      if (steps != null && Number.isInteger(next[parameterId].position)) {
        next[parameterId].position = Math.min(next[parameterId].position, steps)
      }
      return next
    })
    markUnsaved()
  }

  const handlePositionChange = (parameterId, position) => {
    setPreferences((current) => ({
      ...current,
      [parameterId]: {
        ...current[parameterId],
        position,
      },
    }))
    markUnsaved()
  }

  const handleSave = () => {
    try {
      saveTeacherPreferences(preferences)
      setStatus('Suosikkiasetukset tallennettu tähän selaimeen.')
    } catch (error) {
      setStatus(`Tallennus epäonnistui: ${error.message}`)
    }
  }

  const handleReset = () => {
    if (!window.confirm('Palautetaanko opettajan asetukset alkuarvoihin?')) {
      return
    }

    try {
      const defaults = resetTeacherPreferences()
      setPreferences(defaults)
      setStatus('Oletusasetukset palautettu ja tallennettu tähän selaimeen.')
    } catch (error) {
      setStatus(`Palautus epäonnistui: ${error.message}`)
    }
  }

  const handleStartTestGame = () => {
    try {
      const settingsSnapshot = buildFactorySettingsSnapshot(preferences)
      onStartTestGame(settingsSnapshot)
    } catch (error) {
      setStatus(`Testipelin käynnistys epäonnistui: ${error.message}`)
    }
  }

  return (
    <main className="teacher-settings-page">
      <header className="teacher-settings-topbar">
        <div className="teacher-settings-brand">
          <Button className="teacher-back-button" onClick={onBackToLogin} aria-label="Takaisin kirjautumiseen">
            ‹
          </Button>
          <div>
            <p>{APP_NAME}</p>
            <h1>Opettajan asetukset</h1>
          </div>
        </div>
        <div className="teacher-settings-actions">
          <Button className="ui-button teacher-reset-button" onClick={handleReset}>Palauta oletusasetukset</Button>
          <Button className="ui-button teacher-save-button" onClick={handleSave} disabled={!validation.valid}>
            Tallenna asetukset
          </Button>
        </div>
      </header>

      <div className="teacher-settings-banner" role="note">
        <span aria-hidden="true">i</span>
        <div>
          <strong>Säädä pelin lähtötilannetta</strong>
          <p>
            Minimi- ja maksimirajat määrittävät kunkin muuttuvan asetuksen sallitun alueen. Ne eivät kuvaa pelin vaikeustasoa.
            Kiinteät lähtöarvot ovat samat Questissa ja opettajan testipelissä; suosikit tallentuvat tähän selaimeen.
          </p>
        </div>
      </div>

      <div className="teacher-settings-layout">
        <div className="teacher-settings-groups">
          {DISPLAY_GROUPS.map((group) => {
            const definitions = TEACHER_SETTING_DEFINITIONS.filter((item) => item.group === group.id)
            return (
              <section className={`teacher-settings-group group-${group.id}`} key={group.id} aria-labelledby={`group-title-${group.id}`}>
                <header className="teacher-settings-group-heading">
                  <span className="teacher-group-mark" aria-hidden="true" />
                  <h2 id={`group-title-${group.id}`}>{group.label}</h2>
                </header>
                <div className="teacher-settings-rows">
                  {definitions.map((definition) => (
                    <SettingRow
                      key={definition.id}
                      definition={definition}
                      preferences={preferences}
                      errors={validation.errors}
                      onBoundaryChange={handleBoundaryChange}
                      onPositionChange={handlePositionChange}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>

        <footer className="teacher-settings-footer">
          <div className="teacher-settings-snapshot-action">
            <Button className="ui-button teacher-snapshot-button" onClick={handleStartTestGame} disabled={!validation.valid}>
              Kokeile peliä näillä asetuksilla
            </Button>
            <p className="teacher-snapshot-status">
              Käynnistys luo peliin oman asetussnapshotin. Myöhemmät suosikkimuutokset eivät muuta aloitettua peliä.
            </p>
          </div>

          <div className="teacher-settings-status" role="status" aria-live="polite">{status}</div>
          {validation.errors.length > 0 ? (
            <div className="teacher-settings-validation" role="alert">
              <strong>Tarkista asetukset</strong>
              <ul>
                {validation.errors.map((error, index) => <li key={`${error.id}-${index}`}>{error.message}</li>)}
              </ul>
            </div>
          ) : null}

          <p className="teacher-settings-notice">
            Tallennus on selainkohtainen. Asetuksia ei ole kytketty Quest-peliin eikä vielä palvelintallennukseen.
          </p>
        </footer>
      </div>
    </main>
  )
}

export default TeacherSettingsPage