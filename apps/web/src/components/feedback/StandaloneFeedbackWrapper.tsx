/**
 * StandaloneFeedbackWrapper - Minimal error boundary for the standalone feedback page.
 *
 * Catches render errors from FeedbackForm and shows a mailto fallback instead
 * of a blank page. Does NOT use FeedbackErrorBoundary to avoid circular redirect
 * (the standalone page IS the fallback).
 */
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
    /** Child components (FeedbackForm) */
    children: ReactNode;
    /** Fallback email for error reports */
    fallbackEmail?: string;
}

interface State {
    hasError: boolean;
}

/**
 * Minimal error boundary for the standalone feedback page.
 *
 * When the FeedbackForm crashes, shows a simple message directing
 * users to report via email. This is the last resort since the
 * standalone page is itself the error reporting fallback.
 */
export class StandaloneFeedbackWrapper extends Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Log to console for debugging (useConsoleCapture is not available here)
        console.error('[StandaloneFeedbackWrapper] Form crashed:', error, errorInfo);
    }

    render(): ReactNode {
        if (this.state.hasError) {
            const email = this.props.fallbackEmail ?? 'feedback@hospeda.com';
            return (
                <div
                    style={{
                        textAlign: 'center',
                        padding: '40px 20px',
                        fontSize: '14px',
                        color: '#64748b',
                        lineHeight: '1.6'
                    }}
                >
                    <p style={{ marginBottom: '12px', fontWeight: 600, color: '#1e293b' }}>
                        El formulario tuvo un error inesperado.
                    </p>
                    <p>
                        Por favor, envia tu reporte por email a{' '}
                        <a
                            href={`mailto:${email}`}
                            style={{ color: '#2563eb', textDecoration: 'underline' }}
                        >
                            {email}
                        </a>
                    </p>
                </div>
            );
        }

        return this.props.children;
    }
}
