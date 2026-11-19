// Normalisoi pelikoodin: poistaa välilyönnit ja muuntaa isoiksi kirjaimiksi.
export function normalizeJoinCode(joinCode) {
  return joinCode.trim().toUpperCase()
}

// Hakee kaikki vaikeustasot (setup-asetukset) backendistä.
export async function fetchSetups() {
  let response
  try {
    response = await fetch('/api/setups')
  } catch {
    const error = new Error('Palvelimeen ei saada yhteyttä. Tarkista verkkoyhteys ja yritä uudelleen.')
    error.status = 0
    throw error
  }

  if (!response.ok) {
    const error = new Error('Vaikeustasojen hakeminen epäonnistui. Yritä myöhemmin uudelleen.')
    error.status = response.status
    throw error
  }

  return response.json()
}

// Hakee pelin tiedot ja setup-asetukset backendistä liittymiskoodilla.
// Luo samalla game_sessions-tietueen tietokantaan.
// Heittää virheen, jonka status-kenttä kertoo HTTP-tilan (404 = tuntematon koodi).
export async function fetchGameByJoinCode(joinCode, playerName) {
  const normalizedCode = normalizeJoinCode(joinCode)
  let response
  try {
    response = await fetch(`/api/games/join/${encodeURIComponent(normalizedCode)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ playerName: playerName.trim() }),
    })
  } catch {
    const error = new Error('Palvelimeen ei saada yhteyttä. Tarkista verkkoyhteys ja yritä uudelleen.')
    error.status = 0
    throw error
  }

  if (response.status === 404) {
    const error = new Error('Peliä ei löytynyt annetulla pelikoodilla. Tarkista koodi ja yritä uudelleen.')
    error.status = 404
    throw error
  }

  if (!response.ok) {
    const error = new Error('Pelin tietojen hakeminen epäonnistui. Yritä myöhemmin uudelleen.')
    error.status = response.status
    throw error
  }

  return response.json()
}

export async function verifyClassroomSession(sessionId) {
  let response
  try {
    response = await fetch(`/api/games/sessions/${encodeURIComponent(sessionId)}`, {
      cache: 'no-store',
    })
  } catch {
    throw new Error('Pelisuoritusta ei voitu tarkistaa. Tarkista verkkoyhteys ja yritä uudelleen.')
  }
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Pelisuorituksen valtuutus ei ole voimassa. Liity peliin uudelleen.')
    }
    throw new Error('Pelisuoritusta ei voitu tarkistaa. Yritä uudelleen.')
  }
  const result = await response.json()
  if (result.sessionId !== sessionId) {
    throw new Error('Pelisuorituksen tunniste ei täsmää.')
  }
}
