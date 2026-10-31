import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ensureFreshClient, watchForRemoteUpgrade } from './lib/upgrade.ts'
import { setupNativeApp } from './lib/native.ts'
import './index.css'
import './theme/halloween.css'
import './theme/controls.css'
import './theme/apple.css'

function start() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  void ensureFreshClient()
  watchForRemoteUpgrade()
  void setupNativeApp()
}

start()
