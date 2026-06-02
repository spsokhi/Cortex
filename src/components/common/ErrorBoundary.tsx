import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Cortex] Uncaught render error:", error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center h-full w-full px-6 gap-5 bg-cortex-bg text-center">
        <div className="w-14 h-14 rounded-2xl bg-cortex-error/10 border border-cortex-error/30 flex items-center justify-center">
          <AlertTriangle size={26} className="text-cortex-error" />
        </div>
        <div className="max-w-md">
          <h1 className="text-lg font-semibold text-cortex-text">Something went wrong</h1>
          <p className="text-sm text-cortex-text-muted mt-1.5">
            Cortex hit an unexpected error and couldn't render this view. Your
            conversations and data are safe — they're stored locally.
          </p>
          {this.state.error && (
            <pre className="mt-3 max-h-32 overflow-auto text-2xs text-left font-mono text-cortex-text-dim bg-cortex-surface-2 border border-cortex-border rounded-lg p-3 whitespace-pre-wrap break-words">
              {this.state.error.message}
            </pre>
          )}
        </div>
        <button
          onClick={this.handleReload}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-cortex-accent text-white hover:bg-cortex-accent/90 transition-colors"
        >
          <RotateCcw size={14} />
          Reload Cortex
        </button>
      </div>
    );
  }
}
