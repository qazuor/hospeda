/**
 * Sign-in form component for Better Auth.
 *
 * Provides email/password sign-in and OAuth (Google, Facebook) buttons.
 * Accepts auth client methods as props for decoupled usage.
 *
 * @module sign-in-form
 */

import React, { useState } from 'react';
import { useAuthTranslations } from './hooks/use-auth-translations';
import { authLogger } from './logger';
import type { SignInMethods } from './types';

/**
 * SignInForm component props
 */
export interface SignInFormProps {
    /** Sign-in methods from the auth client */
    signIn: SignInMethods;
    /** URL to redirect after successful sign-in */
    redirectTo?: string;
    /** Callback after successful sign-in */
    onSuccess?: () => void;
    /** Whether to show OAuth buttons */
    showOAuth?: boolean;
}

/**
 * SignInForm renders email/password login with optional OAuth buttons
 */
export const SignInForm = ({
    signIn,
    redirectTo,
    onSuccess,
    showOAuth = true
}: SignInFormProps) => {
    const { t } = useAuthTranslations();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isClientReady, setIsClientReady] = useState(false);

    // Ensure consistent rendering between server and client
    React.useEffect(() => {
        setIsClientReady(true);
    }, []);

    if (!isClientReady) {
        return (
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                    <div className="flex w-full items-center justify-center rounded-md border px-4 py-2 text-sm">
                        {t('auth-ui.common.loading')}
                    </div>
                    <div className="flex w-full items-center justify-center rounded-md border px-4 py-2 text-sm">
                        {t('auth-ui.common.loading')}
                    </div>
                </div>
                <div className="flex items-center gap-3 text-center text-muted-foreground text-xs">
                    <div className="h-px flex-1 bg-border" />
                    <span>{t('auth-ui.signIn.or')}</span>
                    <div className="h-px flex-1 bg-border" />
                </div>
                <div className="flex flex-col gap-3">
                    <div className="h-10 rounded border bg-gray-50" />
                    <div className="h-10 rounded border bg-gray-50" />
                    <div className="h-10 rounded bg-gray-200" />
                </div>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        try {
            const result = await signIn.email({ email, password });
            if (result.error) {
                setError(result.error.message || 'Sign in failed');
                return;
            }
            onSuccess?.();
            if (redirectTo && typeof window !== 'undefined') {
                window.location.replace(redirectTo);
            }
        } catch (err) {
            authLogger.error('Sign in error', err);
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsLoading(false);
        }
    };

    const handleOauth = async (provider: 'google' | 'facebook') => {
        try {
            setIsLoading(true);
            setError(null);
            const callbackURL = redirectTo ?? window.location.pathname ?? '/';
            await signIn.social({ provider, callbackURL });
        } catch (err) {
            authLogger.error('OAuth error', err);
            setError(err instanceof Error ? err.message : 'OAuth authentication failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            {showOAuth && (
                <>
                    <div className="flex flex-col gap-3">
                        <button
                            type="button"
                            aria-label="Continue with Google"
                            onClick={() => void handleOauth('google')}
                            disabled={isLoading}
                            className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-4 font-medium text-gray-700 text-sm shadow-sm transition-all duration-200 hover:border-gray-400 hover:bg-gray-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <svg
                                className="h-5 w-5"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <path
                                    fill="#4285F4"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="#34A853"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="#FBBC05"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                />
                                <path
                                    fill="#EA4335"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                />
                            </svg>
                            {t('auth-ui.signIn.signInWithGoogle')}
                        </button>
                        <button
                            type="button"
                            aria-label="Continue with Facebook"
                            onClick={() => void handleOauth('facebook')}
                            disabled={isLoading}
                            className="flex w-full items-center justify-center gap-3 rounded-lg border border-blue-600 px-4 py-4 font-medium text-sm text-white shadow-sm transition-all duration-200 hover:border-blue-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            style={{ backgroundColor: '#1877F2' }}
                        >
                            <svg
                                className="h-5 w-5"
                                fill="white"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                            </svg>
                            {t('auth-ui.signIn.signInWithFacebook')}
                        </button>
                    </div>

                    <div className="flex items-center gap-3 text-center text-muted-foreground text-xs">
                        <div className="h-px flex-1 bg-border" />
                        <span>{t('auth-ui.signIn.or')}</span>
                        <div className="h-px flex-1 bg-border" />
                    </div>
                </>
            )}

            <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-4"
            >
                <div className="space-y-1">
                    <label
                        htmlFor="email"
                        className="block font-medium text-gray-700 text-sm"
                    >
                        {t('auth-ui.signIn.email')}
                    </label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t('auth-ui.signIn.emailPlaceholder')}
                        className="w-full rounded-lg border border-gray-300 px-4 py-4 text-sm transition-colors placeholder:text-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
                        required
                        autoComplete="email"
                    />
                </div>
                <div className="space-y-1">
                    <label
                        htmlFor="password"
                        className="block font-medium text-gray-700 text-sm"
                    >
                        {t('auth-ui.signIn.password')}
                    </label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t('auth-ui.signIn.passwordPlaceholder')}
                        className="w-full rounded-lg border border-gray-300 px-4 py-4 text-sm transition-colors placeholder:text-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
                        required
                        autoComplete="current-password"
                    />
                </div>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full rounded-lg px-4 py-4 font-medium text-sm text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                        background: 'linear-gradient(to right, #0891b2, #059669)',
                        borderColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                        if (!isLoading) {
                            e.currentTarget.style.background =
                                'linear-gradient(to right, #0e7490, #047857)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!isLoading) {
                            e.currentTarget.style.background =
                                'linear-gradient(to right, #0891b2, #059669)';
                        }
                    }}
                >
                    {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg
                                className="h-4 w-4 animate-spin"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    fill="none"
                                />
                                <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                            </svg>
                            {t('auth-ui.signIn.loading')}
                        </span>
                    ) : (
                        t('auth-ui.signIn.signInButton')
                    )}
                </button>
                {error ? (
                    <div
                        className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-600 text-sm"
                        role="alert"
                    >
                        {error}
                    </div>
                ) : null}
            </form>
        </div>
    );
};
