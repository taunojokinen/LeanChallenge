import snapshot from '../../mocks/incomeSnapshot.json'

export async function getIncomeSnapshot() {
  return Promise.resolve(snapshot)
}