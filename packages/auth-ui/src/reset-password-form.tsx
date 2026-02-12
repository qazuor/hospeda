/**
 * Reset password form component.
 *
 * Renders a form with new password and confirmation fields.
 * Expects a token from the URL (provided by the password reset email).
 * Accepts a resetPassword callback as prop (decoupled from auth client).
 *
 * @module reset-password-form
 */

import { useState } from 'react';

/**
 * Props for the ResetPasswordForm component
 */
export interface ResetPasswordFormProps {
    /** Token from the password reset URL */
    token: string;
    /** Callback to reset the password */
    onResetPassword: (params: { newPassword: string; token: string }) => Promise<{
        data?: unknown;
        error?: { message?: string; code?: string } | null;
    }>;
    /** URL to redirect to after successful reset */
    signInUrl?: string;
    /** Callback after successful reset */
    onSuccess?: () => void;
}

/** Minimum password length */
const MIN_PASSWORD_LENGTH = 8;

/**
 * ResetPasswordForm renders new password / confirm password fields.
 * On success, shows a confirmation and link to sign in.
 */
export const ResetPasswordForm = ({
    token,
    onResetPassword,
    signInUrl = '/auth/signin',
    onSuccess
}: ResetPasswordFormProps) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isComplete, setIsComplete] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password.length < MIN_PASSWORD_LENGTH) {
            setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (!token) {
            setError('Invalid or missing reset token');
            return;
        }

        setIsLoading(true);
        try {
            const result = await onResetPassword({ newPassword: password, token });

            if (result.error) {
                setError(result.error.message || 'Failed to reset password');
                return;
            }

            setIsComplete(true);
            onSuccess?.();
        } catch {
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (isComplete) {
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
                <h3 className="font-medium text-gray-900 text-lg">Password reset successful</h3>
                <p className="text-gray-600 text-sm">
                    Your password has been updated. You can now sign in with your new password.
                </p>
                <a
                    href={signInUrl}
                    className="inline-block rounded-lg bg-gradient-to-r from-cyan-500 to-green-500 px-6 py-2 font-medium text-white shadow-sm transition-opacity hover:opacity-90"
                >
                    Sign in
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
                <h2 className="font-bold text-2xl text-gray-900">Set new password</h2>
                <p className="mt-1 text-gray-600 text-sm">Enter your new password below.</p>
            </div>

            {error && (
                <div className="rounded-md bg-red-50 p-3">
                    <p className="text-red-700 text-sm">{error}</p>
                </div>
            )}

            <div>
                <label
                    htmlFor="new-password"
                    className="block font-medium text-gray-700 text-sm"
                >
                    New password
                </label>
                <input
                    id="new-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    autoComplete="new-password"
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
            </div>

            <div>
                <label
                    htmlFor="confirm-password"
                    className="block font-medium text-gray-700 text-sm"
                >
                    Confirm password
                </label>
                <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your password"
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    autoComplete="new-password"
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-green-500 px-4 py-2 font-medium text-white shadow-sm transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {isLoading ? 'Resetting...' : 'Reset password'}
            </button>
        </form>
    );
};
