import React, { StrictMode, Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { LOGO_BASE64 } from './components/logoBase64';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class GlobalErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  props: ErrorBoundaryProps;
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('GlobalErrorBoundary caught an uncaught error:', error, errorInfo);
    
    // Check if this is a chunk failure or dynamic import failure
    const message = error.message || '';
    const isChunkError = 
      message.includes('dynamically imported module') ||
      message.includes('Loading chunk') ||
      message.includes('ChunkLoadError') ||
      message.includes('Failed to fetch');

    if (isChunkError) {
      const hasReloaded = sessionStorage.getItem('just_dosa_chunk_reload_attempted');
      if (!hasReloaded) {
        sessionStorage.setItem('just_dosa_chunk_reload_attempted', 'true');
        window.location.reload();
      }
    }
  }

  private handleReload = () => {
    sessionStorage.removeItem('just_dosa_chunk_reload_attempted');
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-[#1C1917] text-[#FDFBF7] font-sans antialiased">
          <div className="w-full max-w-md p-8 rounded-3xl bg-[#2D2926] border border-[#E8E2D2]/10 shadow-2xl text-center space-y-8">
            <div className="space-y-4">
              <div className="w-36 h-36 mx-auto flex items-center justify-center bg-transparent shrink-0 select-none relative">
                <div className="absolute inset-0 rounded-full bg-[#E37A08]/5 blur-xl scale-125" />
                <img src={LOGO_BASE64} alt="Just Dosa Logo" className="w-full h-full object-contain drop-shadow-md" referrerPolicy="no-referrer" />
              </div>
              <div>
                <span className="inline-block px-3 py-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold uppercase tracking-widest mb-3">
                  System Error
                </span>
                <h1 className="font-serif text-3xl font-bold text-white tracking-tight">
                  Something went wrong
                </h1>
                <p className="text-xs text-[#B8ACA0] uppercase tracking-widest font-semibold mt-1">
                  We encountered an issue loading this page
                </p>
              </div>
            </div>

            <div className="text-sm text-[#B8ACA0] leading-relaxed max-w-xs mx-auto">
              An unexpected error occurred. Please try reloading the application.
            </div>

            <div className="pt-2">
              <button
                onClick={this.handleReload}
                className="w-full py-4 px-6 rounded-xl bg-[#E37A08] hover:bg-[#c96906] text-white font-bold text-base shadow-lg shadow-[#E37A08]/15 transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 15H18" />
                </svg>
                <span>Reload Application</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (this.props as any).children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </StrictMode>,
);
