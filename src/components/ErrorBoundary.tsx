import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  isolateSection?: boolean;
  sectionName?: string;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'Nieoczekiwany błąd renderowania sekcji.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 my-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                Wystąpił problem w sekcji {this.props.sectionName ?? 'interfejsu'}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {this.state.errorMessage}
              </p>
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#122144] dark:bg-sky-600 rounded-md hover:bg-slate-800 dark:hover:bg-sky-500 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Odśwież sekcję
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
