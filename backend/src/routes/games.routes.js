import { Router } from 'express'
import { joinGame } from '../controllers/games.controller.js'

const router = Router()

router.post('/join/:joinCode', joinGame)

export default router
