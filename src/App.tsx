import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/ui/index';
import { Spinner } from './components/ui/index';

const MapPage     = lazy(() => import('./pages/MapPage'));
const StationPage = lazy(() => import('./pages/StationPage'));
const AddPage     = lazy(() => import('./pages/AddPage'));
const LoginPage   = lazy(() => import('./pages/LoginPage'));
const MePage      = lazy(() => import('./pages/MePage'));
const AdminPage   = lazy(() => import('./pages/AdminPage'));
const AboutPage   = lazy(() => import('./pages/AboutPage'));

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, maxWidth: 480, margin: '60px auto', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>⚠️</div>
          <h2 style={{ marginBottom: 12 }}>Something went wrong</h2>
          <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: 20 }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => { this.setState({ hasError: false }); window.location.href = '/'; }}
          >
            Go to Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Loading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <Spinner />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/"             element={<MapPage />} />
            <Route path="/station/:id"  element={<StationPage />} />
            <Route path="/add"          element={<AddPage />} />
            <Route path="/login"        element={<LoginPage />} />
            <Route path="/me"           element={<MePage />} />
            <Route path="/admin"        element={<AdminPage />} />
            <Route path="/about"        element={<AboutPage />} />
            <Route path="*"             element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ToastProvider>
    </BrowserRouter>
  </ErrorBoundary>
  );
}
