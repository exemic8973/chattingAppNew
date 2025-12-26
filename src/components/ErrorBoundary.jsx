import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Catch errors in any components below and re-render with error message
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Log error to service in production
    this.logErrorToService(error, errorInfo);
  }

  logErrorToService(error, errorInfo) {
    // In production, you would send this to an error logging service
    // like Sentry, LogRocket, or your own backend
    try {
      const errorData = {
        message: error.toString(),
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      };

      // Send to error logging endpoint
      fetch('/api/log-error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorData)
      }).catch(err => {
        console.error('Failed to log error:', err);
      });
    } catch (err) {
      console.error('Error logging failed:', err);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return <ErrorBoundaryFallback 
        error={this.state.error}
        errorInfo={this.state.errorInfo}
        onRetry={this.handleRetry}
        onReload={this.handleReload}
      />;
    }

    return this.props.children;
  }
}

// Fallback component without internationalization (to work even when I18nProvider fails)
const ErrorBoundaryFallback = ({ error, errorInfo, onRetry, onReload }) => {
  return (
    <div style={{
      padding: '20px',
      textAlign: 'center',
      backgroundColor: 'var(--background-color, #1a1a1a)',
      color: 'var(--text-color, #ffffff)',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <div style={{
        maxWidth: '500px',
        backgroundColor: 'var(--surface-color, #2a2a2a)',
        padding: '30px',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
      }}>
        <h2 style={{ 
          color: '#ff6b6b', 
          marginBottom: '20px',
          fontSize: '24px'
        }}>
          Oops! Something went wrong
        </h2>
        
        <p style={{ 
          marginBottom: '20px',
          lineHeight: '1.5',
          color: 'var(--text-secondary, #b0b0b0)'
        }}>
          An unexpected error occurred. We're sorry for the inconvenience.
        </p>

        {process.env.NODE_ENV === 'development' && error && (
          <details style={{
            textAlign: 'left',
            margin: '20px 0',
            padding: '15px',
            backgroundColor: 'rgba(255, 107, 107, 0.1)',
            border: '1px solid #ff6b6b',
            borderRadius: '8px',
            fontSize: '12px',
            fontFamily: 'monospace'
          }}>
            <summary style={{ 
              cursor: 'pointer', 
              fontWeight: 'bold',
              color: '#ff6b6b'
            }}>
              Show Error Details
            </summary>
            <pre style={{ 
              marginTop: '10px', 
              overflow: 'auto',
              maxHeight: '200px',
              color: '#ff9999'
            }}>
              {error && error.toString()}
              <br />
              {errorInfo.componentStack}
            </pre>
          </details>
        )}

        <div style={{ 
          display: 'flex', 
          gap: '10px', 
          justifyContent: 'center',
          marginTop: '25px'
        }}>
          <button
            onClick={onRetry}
            style={{
              padding: '12px 24px',
              backgroundColor: '#7289da',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#5a6fb8'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#7289da'}
          >
            Try Again
          </button>
          
          <button
            onClick={onReload}
            style={{
              padding: '12px 24px',
              backgroundColor: 'transparent',
              color: '#7289da',
              border: '1px solid #7289da',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = '#7289da';
              e.target.style.color = 'white';
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.color = '#7289da';
            }}
          >
            Reload Page
          </button>
        </div>

        <p style={{ 
          fontSize: '12px', 
          color: 'var(--text-muted, #808080)',
          marginTop: '20px'
        }}>
          If this problem persists, please contact support.
        </p>
      </div>
    </div>
  );
};

export default ErrorBoundary;