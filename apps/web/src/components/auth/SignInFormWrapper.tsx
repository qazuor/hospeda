/**
 * Sign-in form wrapper for the web application.
 *
 * Provides a self-contained sign-in form using Better Auth.
 * Uses the auth client's signIn.email method for authentication.
 */

import { type FormEvent, useState } from 'react';
import { signIn } from '../../lib/auth-client';

interface Props {
    apiBaseUrl?: string;
    redirectTo?: string;
}

/**
 * SignInFormWrapper renders a complete sign-in form
 */
export const SignInFormWrapper = ({ redirectTo = '/' }: Props): JSX.Element => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            const result = await signIn.email({ email, password });

            if (result.error) {
                setError(result.error.message || 'Sign in failed');
                return;
            }

            if (typeof window !== 'undefined') {
                window.location.href = redirectTo;
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-4"
        >
            {error && <div className="rounded-md bg-red-50 p-3 text-red-700 text-sm">{error}</div>}

            <div>
                <label
                    htmlFor="signin-email"
                    className="block font-medium text-gray-700 text-sm"
                >
                    Email
                </label>
                <input
                    id="signin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    placeholder="tu@email.com"
                />
            </div>

            <div>
                <label
                    htmlFor="signin-password"
                    className="block font-medium text-gray-700 text-sm"
                >
                    Password
                </label>
                <input
                    id="signin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
            </div>

            <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-md bg-cyan-600 px-4 py-2 font-medium text-white transition-colors hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {isSubmitting ? 'Ingresando...' : 'Iniciar sesion'}
            </button>
        </form>
    );
};
