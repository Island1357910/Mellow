import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ensureFreshClient, watchForRemoteUpgrade } from './lib/upgrade.ts'
import { setupNativeApp } from './lib/native.ts'

export function start() {
  const container = document.getElementById('root')
  if (!container) throw new Error('找不到半糖的页面容器')

  // Modern and legacy bundles can both execute in the same WebView.
  // A module-local flag would be separate in each bundle.
  if (container.hasAttribute('data-mellow-mounted')) return
  container.setAttribute('data-mellow-mounted', '')
  try {
    createRoot(container).render(<StrictMode><App /></StrictMode>)
  } catch (error) {
    container.removeAttribute('data-mellow-mounted')
    throw error
  }
  window.__mellowStartup?.ready()
  void ensureFreshClient().catch(() => {})
  watchForRemoteUpgrade()
  void setupNativeApp().catch(() => {})
}
