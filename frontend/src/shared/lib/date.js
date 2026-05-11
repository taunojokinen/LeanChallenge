export function formatDateTime(dateInput) {
  const date = new Date(dateInput)
  return date.toLocaleString('fi-FI')
}
