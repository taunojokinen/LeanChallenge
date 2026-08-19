import snapshot from '../../mocks/productionSnapshot.json'

export async function getProductionSnapshot() {
  return Promise.resolve(snapshot)
}