import { Router } from 'express'
import { getTeacherGames, createTeacherGame } from '../controllers/teacherGames.controller.js'
import { requireAuth } from '../auth/authMiddleware.js'

const router = Router()

router.get('/', requireAuth, getTeacherGames)
router.post('/', requireAuth, createTeacherGame)

export default router
