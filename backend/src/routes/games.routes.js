import { Router } from 'express'
import { joinGame, getClassroomSession, getCurrentClassroomState } from '../controllers/games.controller.js'
import { requireClassroomSession } from '../auth/classroomSession.js'

const router = Router()

router.post('/join/:joinCode', joinGame)
router.get('/sessions/current', getCurrentClassroomState)
router.get('/sessions/:sessionId', requireClassroomSession, getClassroomSession)

export default router
