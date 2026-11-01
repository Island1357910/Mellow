import './lib/runtimeCompat.ts'
import './index.css'

declare global {
  interface Window {
    __mellowStartup?: { ready: () => void; fail: (message: string) => void }
  }
}

// Catch import/evaluation errors that occur before React can render its boundary.
void import('./renderApp.tsx').then(app => app.start()).catch(error => {
  window.__mellowStartup?.fail(error instanceof Error ? error.message : String(error))
})
