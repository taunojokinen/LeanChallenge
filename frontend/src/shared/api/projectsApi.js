import snapshot from '../../mocks/projectsSnapshot.json'

export async function getProjectsSnapshot() {
  return Promise.resolve(snapshot)
}