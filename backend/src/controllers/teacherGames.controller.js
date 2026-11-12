import crypto from 'node:crypto'
import {
  findGamesByTeacherId,
  isJoinCodeTaken,
  createGame,
  findSetupById,
} from '../repositories/teacherGames.repository.js'

export async function getTeacherGames(req, res) {
  try {
    const games = await findGamesByTeacherId(req.teacherId)

    res.json(games.map((game) => ({
      id: game.id,
      name: game.name,
      joinCode: game.join_code,
      setupName: game.setup_name,
    })))
  } catch (error) {
    console.error('Opettajan pelien haku epäonnistui:', error.message)
    res.status(500).json({
      status: 'error',
      message: 'Pelien hakeminen epäonnistui',
    })
  }
}

// Luo yksilöllisen liittymiskoodin muodossa LEAN-XXXX
async function generateUniqueJoinCode() {
  const maxAttempts = 10
  for (let i = 0; i < maxAttempts; i++) {
    const code = `LEAN-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
    if (!(await isJoinCodeTaken(code))) {
      return code
    }
  }
  throw new Error('Liittymiskoodin luominen epäonnistui')
}

export async function createTeacherGame(req, res) {
  const { name, setupId } = req.body ?? {}

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Pelin nimi vaaditaan',
    })
  }

  if (!setupId || !Number.isInteger(Number(setupId))) {
    return res.status(400).json({
      status: 'error',
      message: 'Vaikeustaso vaaditaan',
    })
  }

  try {
    const setup = await findSetupById(setupId)
    if (!setup) {
      return res.status(400).json({
        status: 'error',
        message: 'Valittua vaikeustasoa ei löytynyt',
      })
    }

    const joinCode = await generateUniqueJoinCode()
    const game = await createGame({
      teacherId: req.teacherId,
      setupId: Number(setupId),
      name: name.trim(),
      joinCode,
    })

    res.status(201).json({
      id: game.id,
      name: game.name,
      joinCode: game.join_code,
      setupName: setup.name,
    })
  } catch (error) {
    console.error('Pelin luominen epäonnistui:', error.message)
    res.status(500).json({
      status: 'error',
      message: 'Pelin luominen epäonnistui',
    })
  }
}
