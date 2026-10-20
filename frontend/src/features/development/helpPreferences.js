export const DEVELOPMENT_HELP_SEEN_KEY = 'lean-challenge-development-help-seen'
export const DEVELOPMENT_HELP_HIDDEN_KEY = 'lean-challenge-hide-development-help'

export function readDevelopmentHelpPreferences(storage = globalThis.localStorage) {
  if (!storage) {
    throw new Error('Selaimen paikallinen tallennustila ei ole käytettävissä.')
  }

  return {
    seen: storage.getItem(DEVELOPMENT_HELP_SEEN_KEY) === 'true',
    hidden: storage.getItem(DEVELOPMENT_HELP_HIDDEN_KEY) === 'true',
  }
}

export function shouldAutoOpenDevelopmentHelp(preferences) {
  return !preferences.seen && !preferences.hidden
}

export function markDevelopmentHelpSeen(storage = globalThis.localStorage) {
  if (!storage) {
    throw new Error('Selaimen paikallinen tallennustila ei ole käytettävissä.')
  }
  storage.setItem(DEVELOPMENT_HELP_SEEN_KEY, 'true')
}

export function saveDevelopmentHelpPreference(hidden, storage = globalThis.localStorage) {
  if (!storage) {
    throw new Error('Selaimen paikallinen tallennustila ei ole käytettävissä.')
  }
  storage.setItem(DEVELOPMENT_HELP_HIDDEN_KEY, String(hidden))
}
