import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#09080B] p-4 text-[#F5F2EE]">
          <div className="w-full max-w-md rounded-3xl border border-[#E85D75]/40 bg-[#16141A] p-6 text-center">
            <h1 className="font-display text-xl font-medium">Session Interrupted</h1>
            <p className="mt-2 break-words text-xs text-[#A099A8]">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 min-h-[40px] rounded-xl bg-[#E85D75] px-4 py-2 text-xs font-semibold text-white hover:bg-[#d94d66] cursor-pointer"
            >
              Reload Watch me Darling
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
