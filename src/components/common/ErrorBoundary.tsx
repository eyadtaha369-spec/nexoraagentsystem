import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportLovableError } from "@/lib/lovable-error-reporting";

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    reportLovableError(error, { boundary: "app_error_boundary", componentStack: info.componentStack });
  }
  reset = () => this.setState({ error: null });
  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-card p-10 text-center max-w-md">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {this.state.error.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={this.reset}
            className="btn-brand hover:btn-brand-hover mt-6 rounded-lg px-4 py-2 text-sm font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}
