import { DEFAULT_FACTORY_SETTINGS } from './defaultFactorySettings.js'

export const TEACHER_SETTINGS_STORAGE_KEY = 'lean-challenge-teacher-settings-v1'
export const TEACHER_SETTINGS_VERSION = 3

export const TEACHER_SETTING_GROUPS = [
  { id: 'result', label: 'Tulos' },
  { id: 'balance', label: 'Tase' },
  { id: 'production', label: 'Tuotanto' },
  { id: 'development', label: 'Kehittäminen' },
  { id: 'market', label: 'Uudet asiakkuudet ja tuotevariaatiot' },
]

export const TEACHER_SETTING_DEFINITIONS = [
  {
    id: 'annualFixedCosts',
    group: 'result',
    label: 'Kiinteät kustannukset / neljännesvuosi',
    unit: '€/neljännesvuosi',
    step: 12500,
    min: 0,
    max: 5000000,
    easy: 500000,
    hard: 2000000,
    displayScale: 0.25,
    snapshotScale: 4,
    paths: [['costs', 'annualFixedCosts']],
    help: 'Pienemmät kiinteät kulut helpottavat kannattavan tuloksen saavuttamista.',
  },
  {
    id: 'equity',
    group: 'balance',
    label: 'Oma pääoma',
    unit: '€',
    step: 25000,
    min: 0,
    max: 10000000,
    easy: 3073975,
    hard: 1073975,
    paths: [['initialState', 'finance', 'equity']],
    help: 'Suurempi oma pääoma kasvattaa rahoituspuskuria ja investointien velkavaraa.',
  },
  {
    id: 'machineCount',
    group: 'production',
    label: 'Koneiden lukumäärä',
    unit: 'kpl',
    step: 1,
    min: 1,
    max: 10,
    easy: 4,
    hard: 1,
    paths: [['initialState', 'production', 'machiningMachines']],
    help: 'Lisäkone kasvattaa koneistuskapasiteettia ja samalla koneistuksen henkilöstöä.',
  },
  {
    id: 'newMachinePrice',
    group: 'production',
    label: 'Uuden koneen hinta',
    unit: '€/kpl',
    step: 25000,
    min: 0,
    max: 5000000,
    easy: 250000,
    hard: 1000000,
    paths: [['investments', 'newMachine', 'price']],
    help: 'Matalampi hinta helpottaa myöhempien koneinvestointien rahoittamista.',
  },
  {
    id: 'machiningTimePerUnit',
    group: 'production',
    label: 'Koneistusaika / yksikkö',
    unit: 'h/yksikkö',
    step: 0.5,
    min: 0.5,
    max: 24,
    easy: 4,
    hard: 8,
    paths: [['production', 'departments', 'machining', 'normHoursPerContainer']],
    help: 'Pienempi yksikköaika kasvattaa koneistuskapasiteettia. Koneiden ja työntekijöiden käytettävissä oleva aika pysyy 1 040 tunnissa kierroksessa.',
  },
  {
    id: 'initialSetupTimeHours',
    group: 'production',
    label: 'Asetusaika',
    unit: 'h',
    step: 0.5,
    min: 0.5,
    max: 40,
    easy: 5,
    hard: 20,
    paths: [['lean', 'smed', 'initialSetupTimeHours']],
    help: 'Lyhyempi lähtöasetusaika pienentää vaihtojen menetystä; SMED laskee sitä edelleen normaalilla käyrällä.',
  },
  {
    id: 'initialBatchSize',
    group: 'production',
    label: 'Alkueräkoko',
    unit: 'kpl',
    step: 1,
    min: 1,
    max: 20,
    easy: 10,
    hard: 20,
    paths: [['production', 'initialBatchSize']],
    help: 'Suurempi erä vähentää vaihtoja, mutta kasvattaa minimivaraston ja tilantarpeen vaikutusta.',
  },
  {
    id: 'factoryArea',
    group: 'production',
    label: 'Tehtaan kokonaispinta-ala',
    unit: 'm²',
    step: 100,
    min: 0,
    max: 20000,
    easy: 6000,
    hard: 2500,
    paths: [['initialState', 'factory', 'totalAreaM2']],
    help: 'Suurempi pinta-ala helpottaa koneiden, henkilöstön ja varaston mahduttamista.',
  },
  {
    id: 'knlHalfLifeHours',
    group: 'development',
    label: 'KNL-kehityksen puoliintumisaika',
    unit: 'kehitystuntia',
    step: 25,
    min: 25,
    max: 2000,
    easy: 200,
    hard: 800,
    paths: [['knl', 'knlHalfLifeHours']],
    help: 'Pienempi arvo nopeuttaa kaikkien yhdeksän tavallisen K/N/L-arvon kehitystä kehitystuntia kohti.',
  },
  {
    id: 'initialVariations',
    group: 'market',
    label: 'Tuotevariaatiot alussa',
    unit: 'kpl',
    step: 1,
    min: 1,
    max: 100,
    easy: 15,
    hard: 25,
    paths: [['initialState', 'market', 'activeVariations']],
    help: 'Jokainen variaatio kasvattaa kysyntää ja vaikuttaa tuotannon sekä varaston kuormaan.',
  },
  {
    id: 'goodQualityThreshold',
    group: 'market',
    label: 'Hyvän laadun raja',
    unit: '%',
    step: 1,
    min: 1,
    max: 95,
    displayScale: 100,
    easy: 70,
    hard: 80,
    paths: [['variationRules', 'minimumQualityForZeroAdditionalVariations']],
    help: 'Tällä laadulla avautuu mahdollisuus yhteen lisävariaatioon.',
  },
  {
    id: 'excellentQualityThreshold',
    group: 'market',
    label: 'Erinomaisen laadun raja',
    unit: '%',
    step: 1,
    min: 1,
    max: 95,
    displayScale: 100,
    easy: 75,
    hard: 90,
    paths: [['variationRules', 'oneVariationMinQuality']],
    help: 'Tällä laadulla avautuu mahdollisuus kahteen lisävariaatioon. Nykyisen pelimallin laatu yltää enintään 95 prosenttiin.',
  },
]

export function readTeacherSettingDefault(definition, factorySettings = DEFAULT_FACTORY_SETTINGS) {
  const path = definition.paths[0]
  let value = factorySettings

  for (const key of path) {
    value = value?.[key]
  }

  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue * (definition.displayScale ?? 1) : NaN
}

export function getTeacherSliderStepCount(parameterId, preferences) {
  const definition = TEACHER_SETTING_DEFINITIONS.find((item) => item.id === parameterId)
  const preference = preferences?.[parameterId]
  const easy = preference?.easy
  const hard = preference?.hard

  if (!definition || !Number.isFinite(easy) || !Number.isFinite(hard) || easy === hard) {
    return null
  }

  const rawSteps = Math.abs((hard - easy) / definition.step)
  const steps = Math.round(rawSteps)
  return Math.abs(rawSteps - steps) < 1e-8 ? steps : null
}

export function getTeacherSelectedValue(parameterId, preferences) {
  const definition = TEACHER_SETTING_DEFINITIONS.find((item) => item.id === parameterId)
  const preference = preferences?.[parameterId]
  const steps = getTeacherSliderStepCount(parameterId, preferences)

  if (
    !definition ||
    steps == null ||
    !Number.isInteger(preference?.position) ||
    preference.position < 0 ||
    preference.position > steps
  ) {
    return null
  }

  const direction = Math.sign(preference.hard - preference.easy)
  return preference.easy + direction * definition.step * preference.position
}

export function createDefaultTeacherPreferences(factorySettings = DEFAULT_FACTORY_SETTINGS) {
  return Object.fromEntries(TEACHER_SETTING_DEFINITIONS.map((definition) => {
    const defaultValue = readTeacherSettingDefault(definition, factorySettings)
    const direction = Math.sign(definition.hard - definition.easy)
    const position = Math.round((defaultValue - definition.easy) / (direction * definition.step))

    return [definition.id, {
      easy: definition.easy,
      hard: definition.hard,
      position,
    }]
  }))
}

export function validateTeacherPreferences(preferences) {
  const errors = []

  if (!preferences || typeof preferences !== 'object') {
    return { valid: false, errors: [{ id: 'settings', message: 'Asetuksia ei voitu lukea.' }] }
  }

  TEACHER_SETTING_DEFINITIONS.forEach((definition) => {
    const preference = preferences[definition.id]
    if (!preference || typeof preference !== 'object') {
      errors.push({ id: definition.id, message: `${definition.label}: asetus puuttuu.` })
      return
    }

    const defaultValue = readTeacherSettingDefault(definition)
    for (const field of ['easy', 'hard']) {
      const value = preference[field]
      if (!Number.isFinite(value)) {
        errors.push({ id: definition.id, message: `${definition.label}: ${field === 'easy' ? 'Helppo' : 'Vaikea'}-arvon tulee olla numero.` })
        continue
      }
      if (value < definition.min || value > definition.max) {
        errors.push({ id: definition.id, message: `${definition.label}: arvon tulee olla välillä ${definition.min}–${definition.max} ${definition.unit}.` })
      }
      const stepOffset = (value - defaultValue) / definition.step
      if (Math.abs(stepOffset - Math.round(stepOffset)) > 1e-8) {
        errors.push({ id: definition.id, message: `${definition.label}: käytä askelväliä ${definition.step} ${definition.unit}.` })
      }
    }

    if (Number.isFinite(preference.easy) && Number.isFinite(preference.hard)) {
      if (preference.easy === preference.hard) {
        errors.push({ id: definition.id, message: `${definition.label}: Helppo- ja Vaikea-arvojen tulee olla eri suuruiset.` })
      }
      if (getTeacherSliderStepCount(definition.id, preferences) == null) {
        errors.push({ id: definition.id, message: `${definition.label}: rajojen eron tulee jakautua tasan askelväleihin.` })
      }
    }

    const steps = getTeacherSliderStepCount(definition.id, preferences)
    if (!Number.isInteger(preference.position) || preference.position < 0 || (steps != null && preference.position > steps)) {
      errors.push({ id: definition.id, message: `${definition.label}: liukusäätimen sijainti ei ole sallittu.` })
    }
  })

  const qualityParameters = [
    ['Helppo', 'easy'],
    ['Pelin arvo', 'selected'],
    ['Vaikea', 'hard'],
  ]
  qualityParameters.forEach(([label, field]) => {
    const good = field === 'selected'
      ? getTeacherSelectedValue('goodQualityThreshold', preferences)
      : preferences.goodQualityThreshold?.[field]
    const excellent = field === 'selected'
      ? getTeacherSelectedValue('excellentQualityThreshold', preferences)
      : preferences.excellentQualityThreshold?.[field]

    if (Number.isFinite(good) && Number.isFinite(excellent) && good >= excellent) {
      errors.push({
        id: 'qualityThresholds',
        message: `${label}: hyvän laadun rajan tulee olla erinomaisen laadun rajaa pienempi.`,
      })
    }
  })

  return { valid: errors.length === 0, errors }
}

export function buildFactorySettingsSnapshot(preferences, factorySettings = DEFAULT_FACTORY_SETTINGS) {
  const validation = validateTeacherPreferences(preferences)
  if (!validation.valid) {
    throw new Error(validation.errors.map((error) => error.message).join(' '))
  }

  const snapshot = structuredClone(factorySettings ?? DEFAULT_FACTORY_SETTINGS)
  TEACHER_SETTING_DEFINITIONS.forEach((definition) => {
    const selectedValue = getTeacherSelectedValue(definition.id, preferences) * (definition.snapshotScale ?? 1 / (definition.displayScale ?? 1))
    definition.paths.forEach((path) => {
      let target = snapshot
      path.slice(0, -1).forEach((key) => {
        target = target[key]
      })
      target[path.at(-1)] = selectedValue
    })
  })

  return snapshot
}

function getStorage(storage) {
  return storage ?? globalThis.localStorage ?? null
}

function isValidV2FixedCostPreference(preference) {
  if (!preference || typeof preference !== 'object') {
    return false
  }

  const values = [preference.easy, preference.hard]
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 20000000)) {
    return false
  }

  if (values.some((value) => Math.abs((value - 4000000) / 50000 - Math.round((value - 4000000) / 50000)) > 1e-8)) {
    return false
  }

  const rawSteps = Math.abs((preference.hard - preference.easy) / 50000)
  const steps = Math.round(rawSteps)
  return preference.easy !== preference.hard
    && Math.abs(rawSteps - steps) < 1e-8
    && Number.isInteger(preference.position)
    && preference.position >= 0
    && preference.position <= steps
}

function isValidV2RoundHoursPreference(preference) {
  if (preference == null) {
    return true
  }

  if (!preference || typeof preference !== 'object') {
    return false
  }

  const values = [preference.easy, preference.hard]
  if (values.some((value) => !Number.isFinite(value) || value < 100 || value > 2500)) {
    return false
  }

  if (values.some((value) => Math.abs((value - 1040) / 10 - Math.round((value - 1040) / 10)) > 1e-8)) {
    return false
  }

  const rawSteps = Math.abs((preference.hard - preference.easy) / 10)
  const steps = Math.round(rawSteps)
  return preference.easy !== preference.hard
    && Math.abs(rawSteps - steps) < 1e-8
    && Number.isInteger(preference.position)
    && preference.position >= 0
    && preference.position <= steps
}

function migrateV2Preferences(preferences) {
  if (
    !isValidV2FixedCostPreference(preferences?.annualFixedCosts) ||
    !isValidV2RoundHoursPreference(preferences?.hoursPerRound)
  ) {
    return null
  }

  const migrated = structuredClone(preferences)
  migrated.annualFixedCosts = {
    ...migrated.annualFixedCosts,
    easy: migrated.annualFixedCosts.easy / 4,
    hard: migrated.annualFixedCosts.hard / 4,
  }
  if (!migrated.machiningTimePerUnit) {
    migrated.machiningTimePerUnit = createDefaultTeacherPreferences().machiningTimePerUnit
  }

  return validateTeacherPreferences(migrated).valid ? migrated : null
}

function storePreferencesRecord(storage, version, preferences, savedAt) {
  storage.setItem(TEACHER_SETTINGS_STORAGE_KEY, JSON.stringify({
    version,
    preferences,
    savedAt: savedAt ?? new Date().toISOString(),
  }))
}

export function loadTeacherPreferences(storage) {
  const targetStorage = getStorage(storage)
  if (!targetStorage) {
    return createDefaultTeacherPreferences()
  }

  try {
    const storedValue = targetStorage.getItem(TEACHER_SETTINGS_STORAGE_KEY)
    if (!storedValue) {
      return createDefaultTeacherPreferences()
    }

    const record = JSON.parse(storedValue)
    if (record?.version === 2) {
      const migratedPreferences = migrateV2Preferences(record.preferences)
      const preferences = migratedPreferences ?? createDefaultTeacherPreferences()
      storePreferencesRecord(targetStorage, TEACHER_SETTINGS_VERSION, preferences)
      return preferences
    }

    if (record?.version !== TEACHER_SETTINGS_VERSION) {
      return createDefaultTeacherPreferences()
    }

    const validation = validateTeacherPreferences(record.preferences)
    return validation.valid
      ? structuredClone(record.preferences)
      : createDefaultTeacherPreferences()
  } catch {
    return createDefaultTeacherPreferences()
  }
}

export function saveTeacherPreferences(preferences, storage) {
  const validation = validateTeacherPreferences(preferences)
  if (!validation.valid) {
    throw new Error(validation.errors.map((error) => error.message).join(' '))
  }

  const targetStorage = getStorage(storage)
  if (!targetStorage) {
    throw new Error('Selaimen tallennustila ei ole käytettävissä.')
  }

  const record = {
    version: TEACHER_SETTINGS_VERSION,
    preferences: structuredClone(preferences),
    savedAt: new Date().toISOString(),
  }
  targetStorage.setItem(TEACHER_SETTINGS_STORAGE_KEY, JSON.stringify(record))
  return record
}

export function resetTeacherPreferences(storage) {
  const defaults = createDefaultTeacherPreferences()
  saveTeacherPreferences(defaults, storage)
  return defaults
}