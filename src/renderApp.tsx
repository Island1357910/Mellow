import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ensureFreshClient, watchForRemoteUpgrade } from './lib/upgrade.ts'
import { setupNativeApp } from './lib/native.ts'

export function start() {
  createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
  window.__mellowStartup?.ready()
  void ensureFreshClient().catch(() => {})
  watchForRemoteUpgrade()
  void setupNativeApp().catch(() => {})
}
