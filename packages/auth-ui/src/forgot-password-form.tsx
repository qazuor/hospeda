/**
 * Forgot password form component.
 *
 * Renders a form with an email input that triggers a password reset email.
 * Accepts a forgotPassword callback as prop (decoupled from auth client).
 *
 * @module forgot-password-form
 */

import { useState } from 'react';

/**
 * Props for the ForgotPasswordForm component
 */
export interface ForgotPasswordFormProps {
    /** Callback to request password reset email */
    onForgotPassword: (params: { email: string; redirectTo: string }) => Promise<{
        data?: unknown;
        error?: { message?: string; code?: string } | null;
    }>;
    /** URL to redirect to after password reset (the reset-password page) */
    redirectTo?: string;
    /** URL for the sign-in page link */
    signInUrl?: string;
}

/**
 * ForgotPasswordForm renders an email input and sends a password reset email.
 * Shows a success message after the email is sent.
 */
export const ForgotPasswordForm = ({
    onForgotPassword,
    redirectTo = '/auth/reset-password',
    signInUrl = '/auth/signin'
}: ForgotPasswordFormProps) => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSent, setIsSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!email.trim()) {
            setError('Please enter your email address');
            return;
        }

        setIsLoading(true);
        try {
            const result = await onForgotPassword({ email: email.trim(), redirectTo });

            if (result.error) {
                setError(result.error.message || 'Failed to send reset email');
                return;
            }

            setIsSent(true);
        } catch {
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (isSent) {
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
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                    </svg>
                </div>
                <h3 className="font-medium text-gray-900 text-lg">Check your email</h3>
                <p className="text-gray-600 text-sm">
                    If an account exists for <span className="font-medium">{email}</span>, you will
                    receive a password reset link shortly.
                </p>
                <a
                    href={signInUrl}
                    className="inline-block text-cyan-600 text-sm hover:text-cyan-700"
                >
                    Back to sign in
                </a>
            </div>
        );
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-4"
        >
            <div>
                <h2 className="font-bold text-2xl text-gray-900">Reset your password</h2>
                <p className="mt-1 text-gray-600 text-sm">
                    Enter your email address and we will send you a reset link.
                </p>
            </div>

            {error && (
                <div className="rounded-md bg-red-50 p-3">
                    <p className="text-red-700 text-sm">{error}</p>
                </div>
            )}

            <div>
                <label
                    htmlFor="forgot-email"
                    className="block font-medium text-gray-700 text-sm"
                >
                    Email
                </label>
                <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-green-500 px-4 py-2 font-medium text-white shadow-sm transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {isLoading ? 'Sending...' : 'Send reset link'}
            </button>

            <div className="text-center">
                <a
                    href={signInUrl}
                    className="text-cyan-600 text-sm hover:text-cyan-700"
                >
                    Back to sign in
                </a>
            </div>
        </form>
    );
};
