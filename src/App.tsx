import { Component, type ReactNode } from 'react'
import { PhoneShell } from './components/os/PhoneShell.tsx'

export default function App() {
  return (
    <AppErrorBoundary>
      <PhoneShell />
    </AppErrorBoundary>
  )
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { message: string }> {
  state = { message: '' }

  static getDerivedStateFromError(error: unknown): { message: string } {
    return { message: error instanceof Error ? error.message : '界面断了一下' }
  }

  render() {
    if (this.state.message) {
      return (
        <div className="grid min-h-dvh place-items-center px-6 text-center">
          <div>
            <p className="text-2xl">半糖晃了一下</p>
            <p className="mt-3 text-sm leading-6 text-neutral-600">{this.state.message}</p>
            <button type="button" className="mt-4 rounded-full bg-[#ffb5c5] px-4 py-2 text-sm" onClick={() => window.location.reload()}>
              重新打开
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
