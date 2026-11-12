import 'dotenv/config'
import app from './app.js'

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log(`Lean Challenge API käynnissä osoitteessa http://localhost:${PORT}`)
})
