import snapshot from '../../mocks/balanceSheetSnapshot.json'

export async function getBalanceSheetSnapshot() {
  return Promise.resolve(snapshot)
}