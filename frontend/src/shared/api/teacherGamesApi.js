// Hakee kirjautuneen opettajan omat pelit.
// Istuntoeväste välittyy automaattisesti credentials: 'include' -asetuksella.
export async function fetchTeacherGames() {
  let response
  try {
    response = await fetch('/api/teacher/games', {
      credentials: 'include',
    })
  } catch {
    const error = new Error('Palvelimeen ei saada yhteyttä. Tarkista verkkoyhteys ja yritä uudelleen.')
    error.status = 0
    throw error
  }

  if (response.status === 401) {
    const error = new Error('Kirjautuminen vaaditaan')
    error.status = 401
    throw error
  }

  if (!response.ok) {
    const error = new Error('Pelien hakeminen epäonnistui. Yritä myöhemmin uudelleen.')
    error.status = response.status
    throw error
  }

  return response.json()
}

// Luo uuden pelin kirjautuneelle opettajalle.
export async function createTeacherGame(name, setupId) {
  let response
  try {
    response = await fetch('/api/teacher/games', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      credentials: 'include',
      body: JSON.stringify({ name, setupId }),
    })
  } catch {
    const error = new Error('Palvelimeen ei saada yhteyttä. Tarkista verkkoyhteys ja yritä uudelleen.')
    error.status = 0
    throw error
  }

  if (response.status === 401) {
    const error = new Error('Kirjautuminen vaaditaan')
    error.status = 401
    throw error
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    const error = new Error(data.message ?? 'Pelin luominen epäonnistui. Yritä myöhemmin uudelleen.')
    error.status = response.status
    throw error
  }

  return response.json()
}
