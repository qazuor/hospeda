/**
 * @file SignIn.client.tsx
 * @description Sign-in form React island for web2.
 *
 * Standalone component — no dependency on @repo/auth-ui.
 * Calls auth-client.ts directly, styled with CSS Modules + web2 design tokens.
 * Shows a skeleton while hydrating to prevent layout shift.
 */

import { signIn } from '@/lib/auth-client';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import styles from './SignIn.module.css';

/** Props for the SignIn component. */
export interface SignInProps {
    /** Active locale — used for translations. */
    readonly locale: SupportedLocale;
    /** URL to redirect to after a successful sign-in. */
    readonly redirectTo: string;
    /** Whether to show OAuth provider buttons. Defaults to true. */
    readonly showOAuth?: boolean;
}

/**
 * Sign-in form with email/password and optional OAuth providers.
 *
 * Handles its own loading, error, and hydration-skeleton states.
 * Redirects via `window.location.replace` after success.
 *
 * @example
 * ```astro
 * <SignIn client:load locale={locale} redirectTo="/es/mi-cuenta/" showOAuth={true} />
 * ```
 */
export function SignIn({ locale, redirectTo, showOAuth = true }: SignInProps) {
    const { t } = createTranslations(locale);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [oauthLoading, setOauthLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isClientReady, setIsClientReady] = useState(false);

    useEffect(() => {
        setIsClientReady(true);
    }, []);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            const result = await signIn.email({ email, password });

            if (result.error) {
                setError(result.error.message ?? t('auth.signIn.error', 'Error al iniciar sesion'));
            } else {
                window.location.replace(redirectTo);
            }
        } catch {
            setError(t('auth.signIn.error', 'Error al iniciar sesion'));
        } finally {
            setIsLoading(false);
        }
    }

    async function handleOauth(provider: 'google' | 'facebook'): Promise<void> {
        setError(null);
        setOauthLoading(provider);

        try {
            await signIn.social({
                provider,
                callbackURL: redirectTo || window.location.pathname
            });
        } catch {
            setError(t('auth.signIn.error', 'Error al iniciar sesion'));
            setOauthLoading(null);
        }
    }

    if (!isClientReady) {
        return (
            <div
                className={styles.skeleton}
                aria-busy="true"
                aria-label="Cargando formulario"
            >
                <div className={cn(styles.skeletonLine, styles.skeletonTitle)} />
                <div className={styles.skeletonField} />
                <div className={styles.skeletonField} />
                <div className={styles.skeletonButton} />
            </div>
        );
    }

    return (
        <form
            className={styles.form}
            onSubmit={handleSubmit}
            noValidate
            aria-label={t('auth.signIn.submit', 'Iniciar Sesion')}
        >
            {error && (
                <div
                    role="alert"
                    className={styles.error}
                >
                    {error}
                </div>
            )}

            <div className={styles.field}>
                <label
                    htmlFor="signin-email"
                    className={styles.label}
                >
                    {t('auth.signIn.email', 'Correo electronico')}
                </label>
                <input
                    id="signin-email"
                    type="email"
                    className={styles.input}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('auth.signIn.emailPlaceholder', 'tu@email.com')}
                    required
                    autoComplete="email"
                    aria-required="true"
                    disabled={isLoading}
                />
            </div>

            <div className={styles.field}>
                <label
                    htmlFor="signin-password"
                    className={styles.label}
                >
                    {t('auth.signIn.password', 'Contrasena')}
                </label>
                <input
                    id="signin-password"
                    type="password"
                    className={styles.input}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('auth.signIn.passwordPlaceholder', 'Tu contrasena')}
                    required
                    autoComplete="current-password"
                    aria-required="true"
                    disabled={isLoading}
                />
            </div>

            <button
                type="submit"
                className={styles.submitButton}
                disabled={isLoading}
                aria-busy={isLoading}
            >
                {isLoading
                    ? t('auth.signIn.loading', 'Ingresando...')
                    : t('auth.signIn.submit', 'Iniciar Sesion')}
            </button>

            {showOAuth && (
                <>
                    <div
                        className={styles.divider}
                        aria-hidden="true"
                    >
                        <span className={styles.dividerLine} />
                        <span>{t('auth.signIn.or', 'o')}</span>
                        <span className={styles.dividerLine} />
                    </div>

                    <button
                        type="button"
                        className={styles.oauthButton}
                        onClick={() => handleOauth('google')}
                        disabled={oauthLoading !== null}
                        aria-busy={oauthLoading === 'google'}
                    >
                        <GoogleIcon />
                        {t('auth.signIn.withGoogle', 'Continuar con Google')}
                    </button>

                    <button
                        type="button"
                        className={styles.oauthButton}
                        onClick={() => handleOauth('facebook')}
                        disabled={oauthLoading !== null}
                        aria-busy={oauthLoading === 'facebook'}
                    >
                        <FacebookIcon />
                        {t('auth.signIn.withFacebook', 'Continuar con Facebook')}
                    </button>
                </>
            )}
        </form>
    );
}

function GoogleIcon() {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            aria-hidden="true"
            focusable="false"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                fill="#4285F4"
            />
            <path
                d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
                fill="#34A853"
            />
            <path
                d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                fill="#FBBC05"
            />
            <path
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                fill="#EA4335"
            />
        </svg>
    );
}

function FacebookIcon() {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
            xmlns="http://www.w3.org/2000/svg"
            fill="#1877F2"
        >
            <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.024 4.388 11.018 10.125 11.927v-8.437H7.078v-3.49h3.047V9.413c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.266h3.328l-.532 3.49h-2.796v8.437C19.612 23.091 24 18.097 24 12.073z" />
        </svg>
    );
}
