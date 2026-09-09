export function selectLatestConfirmedRounds({ baselineEntries = [], runtimeEntries = [], count = 2 }) {
  const entriesByRound = new Map()

  baselineEntries.forEach((entry) => {
    entriesByRound.set(Number(entry.round), entry)
  })

  runtimeEntries.forEach((entry) => {
    entriesByRound.set(Number(entry.round), entry)
  })

  return [...entriesByRound.values()]
    .sort((left, right) => Number(left.round) - Number(right.round))
    .slice(-count)
}
