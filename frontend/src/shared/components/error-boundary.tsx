'use client';

import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Recovery UI. `reset` clears the error so children re-mount. */
  fallback?: (args: { error: Error; reset: () => void }) => ReactNode;
  onError?: (error: Error) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// Generic React error boundary (boundaries must be class components). Without a
// fallback it fails quiet (renders nothing); pass `fallback` for recovery UI.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error): void {
    this.props.onError?.(error);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      return this.props.fallback ? this.props.fallback({ error, reset: this.reset }) : null;
    }
    return this.props.children;
  }
}
