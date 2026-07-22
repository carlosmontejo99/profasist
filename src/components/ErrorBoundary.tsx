import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ProfAsist ErrorBoundary caught an unhandled exception:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    if (window.confirm("¿Deseas intentar reiniciar la aplicación limpiando temporales? Tus datos principales se conservarán.")) {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-slate-800 rounded-[2.5rem] p-8 border border-slate-700 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 bg-rose-500/20 text-rose-400 rounded-3xl flex items-center justify-center mx-auto">
              <AlertTriangle size={36} />
            </div>

            <div>
              <h2 className="text-2xl font-black tracking-tight text-white mb-2">
                ProfAsist encontró un inconveniente
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Se detectó una excepción no controlada en la pantalla actual. Puedes recargar la aplicación de forma segura sin perder tus datos.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-left overflow-x-auto max-h-32">
                <code className="text-[11px] font-mono text-rose-300 break-all">
                  {this.state.error.toString()}
                </code>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={this.handleReload}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <RefreshCw size={16} /> Recargar Aplicación
              </button>

              <button
                onClick={this.handleReset}
                className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-2xl text-xs transition-all"
              >
                Recuperación Segura
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (this as any).props?.children ?? null;
  }
}
