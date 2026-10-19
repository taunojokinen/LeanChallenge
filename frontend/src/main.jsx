import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './app/styles/variables.css'
import './app/styles/typography.css'
import './app/styles/globals.css'
import App from './app/App.jsx'
import { APP_NAME } from './config/appConfig.js'

document.title = APP_NAME

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
