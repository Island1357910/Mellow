import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ensureFreshClient, watchForRemoteUpgrade } from './lib/upgrade.ts'
import './index.css'

async function start() {
  await ensureFreshClient()
  watchForRemoteUpgrade()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void start()
