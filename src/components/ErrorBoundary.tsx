import { Component } from 'react'
import type { ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean; error?: any; info?: { componentStack: string } }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: any): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: any, info: { componentStack: string }) {
    try { console.error('[ErrorBoundary]', error, info?.componentStack) } catch {}
    this.setState({ info })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-xl bg-white/5 text-white">
          <div className="text-xl font-semibold mb-2">Щось пішло не так</div>
          <div className="text-sm opacity-80">Оновіть сторінку або спробуйте ще раз. Деталі див. у консолі.</div>
        </div>
      )
    }
    return this.props.children
  }
}


