import { Router } from 'express'
import { getAllSetups } from '../controllers/setups.controller.js'

const router = Router()

router.get('/', getAllSetups)

export default router
