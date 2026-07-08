import { StrictMode, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider } from 'antd';
import './index.css';
import App from './App.tsx';
import { academicTheme } from './theme.ts';

/** Catches React tree errors and shows a readable fallback instead of a blank screen. */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', err, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100vh', background: '#0f1f3d', color: '#C8D8F0', fontFamily: 'monospace', padding: 32, gap: 16,
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#E06C6C' }}>⚠ Application Error</div>
          <pre style={{ background: '#1E3560', padding: 16, borderRadius: 6, maxWidth: 700, whiteSpace: 'pre-wrap', fontSize: 12 }}>
            {this.state.error}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '8px 20px', background: '#2B4C7E', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Disable default right-click context menu within the app window
document.addEventListener('contextmenu', (e) => e.preventDefault());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ConfigProvider theme={academicTheme}>
        <App />
      </ConfigProvider>
    </ErrorBoundary>
  </StrictMode>,
);
