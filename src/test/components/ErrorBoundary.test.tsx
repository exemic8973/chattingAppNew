import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ErrorBoundary from '@/components/ErrorBoundary'
import { I18nProvider } from '@/i18n/I18nContext'

// Mock console.error to avoid test output pollution
const originalConsoleError = console.error
beforeEach(() => {
  console.error = vi.fn()
})

afterEach(() => {
  console.error = originalConsoleError
})

describe('ErrorBoundary Component', () => {
  const ThrowErrorComponent = ({ shouldThrow = false }) => {
    if (shouldThrow) {
      throw new Error('Test error')
    }
    return <div>No error</div>
  }

  it('renders children when there is no error', () => {
    render(
      <I18nProvider>
        <ErrorBoundary>
          <ThrowErrorComponent shouldThrow={false} />
        </ErrorBoundary>
      </I18nProvider>
    )

    expect(screen.getByText('No error')).toBeInTheDocument()
  })

  it('displays error UI when an error is thrown', () => {
    render(
      <I18nProvider>
        <ErrorBoundary>
          <ThrowErrorComponent shouldThrow={true} />
        </ErrorBoundary>
      </I18nProvider>
    )

    expect(screen.getByText(/Oops! Something went wrong/)).toBeInTheDocument()
    expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument()
  })

  it('shows retry and reload buttons', () => {
    render(
      <I18nProvider>
        <ErrorBoundary>
          <ThrowErrorComponent shouldThrow={true} />
        </ErrorBoundary>
      </I18nProvider>
    )

    expect(screen.getByText('Try Again')).toBeInTheDocument()
    expect(screen.getByText('Reload Page')).toBeInTheDocument()
  })

  it('shows error details in development mode', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    render(
      <I18nProvider>
        <ErrorBoundary>
          <ThrowErrorComponent shouldThrow={true} />
        </ErrorBoundary>
      </I18nProvider>
    )

    expect(screen.getByText(/Show Error Details/)).toBeInTheDocument()

    // Restore original environment
    process.env.NODE_ENV = originalEnv
  })

  it('logs error to service', async () => {
    const mockFetch = vi.fn()
    global.fetch = mockFetch

    render(
      <I18nProvider>
        <ErrorBoundary>
          <ThrowErrorComponent shouldThrow={true} />
        </ErrorBoundary>
      </I18nProvider>
    )

    // Wait for the error logging to be called
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/log-error',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.stringContaining('Test error'),
      })
    )
  })
})