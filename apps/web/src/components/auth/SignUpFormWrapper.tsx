/**
 * Sign-up form wrapper for the web application.
 *
 * Provides a self-contained sign-up form using Better Auth.
 * Uses the auth client's signUp.email method for registration.
 */

import { type FormEvent, useState } from 'react';
import { signUp } from '../../lib/auth-client';

interface Props {
    apiBaseUrl?: string;
    redirectTo?: string;
}

/**
 * SignUpFormWrapper renders a complete sign-up form
 */
export const SignUpFormWrapper = ({ redirectTo = '/' }: Props): JSX.Element => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            const result = await signUp.email({ email, password, name });

            if (result.error) {
                setError(result.error.message || 'Sign up failed');
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
                    htmlFor="signup-name"
                    className="block font-medium text-gray-700 text-sm"
                >
                    Nombre completo
                </label>
                <input
                    id="signup-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
            </div>

            <div>
                <label
                    htmlFor="signup-email"
                    className="block font-medium text-gray-700 text-sm"
                >
                    Email
                </label>
                <input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="tu@email.com"
                />
            </div>

            <div>
                <label
                    htmlFor="signup-password"
                    className="block font-medium text-gray-700 text-sm"
                >
                    Password
                </label>
                <input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Minimo 8 caracteres"
                />
            </div>

            <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-md bg-emerald-600 px-4 py-2 font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
        </form>
    );
};
