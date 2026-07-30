import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="glass-card p-lg flex flex-col items-center gap-md text-center my-lg">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(220, 38, 38, 0.08)', border: '1px solid rgba(220, 38, 38, 0.2)' }}>
            <span className="material-symbols-outlined text-error" style={{ fontSize: 32 }}>error_outline</span>
          </div>
          <div>
            <p className="text-body-lg font-bold text-on-surface">Something went wrong</p>
            <p className="text-body-sm text-on-surface-variant mt-xs">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="btn-primary text-label-md flex items-center gap-sm"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export function ApiErrorToast({ error, onDismiss }) {
  if (!error) return null;

  return (
    <div className="fixed bottom-20 right-8 z-50 flex items-center gap-sm px-md py-sm rounded-xl shadow-lg row-animate" style={{ background: 'var(--error-container)', border: '1px solid rgba(220, 38, 38, 0.3)', maxWidth: 400 }}>
      <span className="material-symbols-outlined text-error shrink-0" style={{ fontSize: 18 }}>warning</span>
      <span className="text-body-sm font-medium flex-1" style={{ color: 'var(--on-error-container)' }}>{error}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 text-error hover:text-on-error-container">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
        </button>
      )}
    </div>
  );
}
