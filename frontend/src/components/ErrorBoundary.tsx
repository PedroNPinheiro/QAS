import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-page px-4">
          <div className="w-full max-w-md rounded-xl border border-hairline bg-surface p-8 text-center">
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="mt-2 text-sm text-ink-secondary">
              An unexpected error occurred in the app. Your data is safe — reload the page to
              continue.
            </p>
            <p className="mt-2 break-words text-xs text-ink-muted">{this.state.error.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-dark"
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
