import snapshot from '../../mocks/investmentsSnapshot.json'

export async function getInvestmentsSnapshot() {
  return Promise.resolve(snapshot)
}