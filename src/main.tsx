import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ensureFreshClient, watchForRemoteUpgrade } from './lib/upgrade.ts'
import './index.css'

function start() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  void ensureFreshClient()
  watchForRemoteUpgrade()
}

start()
