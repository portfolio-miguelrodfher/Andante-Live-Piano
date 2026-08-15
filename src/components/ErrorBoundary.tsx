import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  name: string
  children: ReactNode
  onError?: (message: string) => void
}

interface ErrorBoundaryState {
  error?: Error
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {}

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[Andante ${this.props.name} error boundary]`, error, errorInfo)
    this.props.onError?.(`${this.props.name} encountered an error.`)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="component-error" role="alert">
          <strong>{this.props.name} encountered an error.</strong>
          <span>The rest of Andante is still available.</span>
        </div>
      )
    }

    return this.props.children
  }
}
