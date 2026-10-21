import { isTeacherTestGamePath } from '../../features/session/teacherTestGameSession.js'

export function resolveGamePath(pathname, completion) {
  if (completion && isTeacherTestGamePath(pathname)) {
    return '/game/report'
  }

  return pathname === '/game/report' && !completion ? '/plan/cockpit' : pathname
}
