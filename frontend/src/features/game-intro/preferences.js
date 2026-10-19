export const GAME_INTRO_HIDDEN_KEY = 'lean-challenge-hide-game-intro'

export function isGameIntroHidden(storage) {
  try {
    return (storage ?? globalThis.localStorage)?.getItem(GAME_INTRO_HIDDEN_KEY) === 'true'
  } catch (error) {
    console.error('Aloitusikkunan näyttöasetuksen lukeminen epäonnistui.', error)
    return false
  }
}

export function saveGameIntroPreference(hidden, storage) {
  const targetStorage = storage ?? globalThis.localStorage
  if (!targetStorage) {
    throw new Error('Selaimen paikallinen tallennustila ei ole käytettävissä.')
  }
  targetStorage.setItem(GAME_INTRO_HIDDEN_KEY, String(hidden))
}
