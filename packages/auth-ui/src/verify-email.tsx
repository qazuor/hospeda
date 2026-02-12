/**
 * Email verification component.
 *
 * Reads a verification token (from props) and calls the verify callback.
 * Shows loading, success, or error states. Auto-redirects on success.
 *
 * @module verify-email
 */

import { useEffect, useState } from 'react';

/**
 * Props for the VerifyEmail component
 */
export interface VerifyEmailProps {
    /** Verification token from the URL */
    token: string;
    /** Callback to verify the email */
    onVerifyEmail: (params: { token: string }) => Promise<{
        data?: unknown;
        error?: { message?: string; code?: string } | null;
    }>;
    /** URL to redirect to after successful verification */
    redirectTo?: string;
    /** Delay in ms before auto-redirect (0 to disable) */
    redirectDelay?: number;
    /** Callback after successful verification */
    onSuccess?: () => void;
}

/** Verification states */
type VerifyState = 'loading' | 'success' | 'error';

/**
 * VerifyEmail attempts to verify the email token on mount.
 * Shows appropriate loading, success, or error states.
 */
export const VerifyEmail = ({
    token,
    onVerifyEmail,
    redirectTo = '/',
    redirectDelay = 3000,
    onSuccess
}: VerifyEmailProps) => {
    const [state, setState] = useState<VerifyState>('loading');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!token) {
            setState('error');
            setErrorMessage('Invalid or missing verification token');
            return;
        }

        let cancelled = false;

        const verify = async () => {
            try {
                const result = await onVerifyEmail({ token });

                if (cancelled) return;

                if (result.error) {
                    setState('error');
                    setErrorMessage(result.error.message || 'Verification failed');
                    return;
                }

                setState('success');
                onSuccess?.();

                // Auto-redirect after delay
                if (redirectDelay > 0 && redirectTo) {
                    setTimeout(() => {
                        if (!cancelled && typeof window !== 'undefined') {
                            window.location.href = redirectTo;
                        }
                    }, redirectDelay);
                }
            } catch {
                if (cancelled) return;
                setState('error');
                setErrorMessage('An unexpected error occurred during verification.');
            }
        };

        verify();

        return () => {
            cancelled = true;
        };
    }, [token, onVerifyEmail, redirectTo, redirectDelay, onSuccess]);

    if (state === 'loading') {
        return (
            <div className="space-y-4 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
                <h3 className="font-medium text-gray-900 text-lg">Verifying your email...</h3>
                <p className="text-gray-600 text-sm">
                    Please wait while we verify your email address.
                </p>
            </div>
        );
    }

    if (state === 'success') {
        return (
            <div className="space-y-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                    <svg
                        className="h-6 w-6 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                        />
                    </svg>
                </div>
                <h3 className="font-medium text-gray-900 text-lg">Email verified</h3>
                <p className="text-gray-600 text-sm">
                    Your email has been verified successfully.
                    {redirectDelay > 0 && ' Redirecting...'}
                </p>
                {redirectTo && (
                    <a
                        href={redirectTo}
                        className="inline-block text-cyan-600 text-sm hover:text-cyan-700"
                    >
                        Continue
                    </a>
                )}
            </div>
        );
    }

    // Error state
    return (
        <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <svg
                    className="h-6 w-6 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                    />
                </svg>
            </div>
            <h3 className="font-medium text-gray-900 text-lg">Verification failed</h3>
            <p className="text-gray-600 text-sm">
                {errorMessage || 'The verification link may be expired or invalid.'}
            </p>
            <p className="text-gray-500 text-xs">
                Please try signing in again to receive a new verification email.
            </p>
        </div>
    );
};
