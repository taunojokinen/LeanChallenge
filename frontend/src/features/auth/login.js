export function validateLoginFields({ username, password }) {
  const errors = {}

  if (!username.trim()) {
    errors.username = 'Syötä käyttäjätunnus.'
  }

  if (!password.trim()) {
    errors.password = 'Syötä salasana.'
  }

  return errors
}

export async function loginWithPlaceholder(credentials) {
  const errors = validateLoginFields(credentials)

  if (Object.keys(errors).length > 0) {
    return {
      ok: false,
      errors,
    }
  }

  return {
    ok: true,
  }
}