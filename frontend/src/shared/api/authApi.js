// Opettajan autentikoinnin API-kutsut.
// Kaikki käyttävät credentials: 'include' istuntoevästeiden välittämiseksi
// ja X-Requested-With -otsaketta CSRF-suojauksen läpäisemiseksi.

const AUTH_HEADERS = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
}

export async function loginTeacher(username, password) {
  let response
  try {
    response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: AUTH_HEADERS,
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    })
  } catch {
    const error = new Error('Palvelimeen ei saada yhteyttä. Tarkista verkkoyhteys ja yritä uudelleen.')
    error.status = 0
    throw error
  }

  if (response.status === 401) {
    const error = new Error('Virheellinen käyttäjätunnus tai salasana')
    error.status = 401
    throw error
  }

  if (response.status === 429) {
    const error = new Error('Liikaa kirjautumisyrityksiä. Yritä myöhemmin uudelleen.')
    error.status = 429
    throw error
  }

  if (!response.ok) {
    const error = new Error('Kirjautuminen epäonnistui. Yritä myöhemmin uudelleen.')
    error.status = response.status
    throw error
  }

  return response.json()
}

export async function fetchCurrentTeacher() {
  let response
  try {
    response = await fetch('/api/auth/me', {
      credentials: 'include',
    })
  } catch {
    return null
  }

  if (!response.ok) {
    return null
  }

  return response.json()
}

export async function logoutTeacher() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: AUTH_HEADERS,
      credentials: 'include',
    })
  } catch {
    // Uloskirjautuminen onnistuu paikallisesti vaikka palvelin ei vastaisi
  }
}
