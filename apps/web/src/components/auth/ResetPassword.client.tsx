/**
 * @file ResetPassword.client.tsx
 * @description Reset-password form React island for web2.
 *
 * Standalone component — no dependency on @repo/auth-ui.
 * Validates password requirements and match before calling resetPassword().
 * Shows a success state with a sign-in link after the password is updated.
 */

import { resetPassword } from '@/lib/auth-client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useState } from 'react';
import styles from './ResetPassword.module.css';

/** Props for the ResetPassword component. */
export interface ResetPasswordProps {
    /** Active locale — used for translations. */
    readonly locale: SupportedLocale;
    /** One-time reset token extracted from the password-reset URL query string. */
    readonly token: string;
    /** URL to the sign-in page — shown as a link in the success state. */
    readonly signInUrl: string;
}

/**
 * Reset-password form that validates the new password and calls the API.
 *
 * Client-side validation:
 * - Password must be at least 8 characters.
 * - Passwords must match.
 * - Token must be present.
 *
 * @example
 * ```astro
 * <ResetPassword client:load locale={locale} token={token} signInUrl="/es/auth/signin/" />
 * ```
 */
export function ResetPassword({ locale, token, signInUrl }: ResetPasswordProps) {
    const { t } = createTranslations(locale);

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isComplete, setIsComplete] = useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
        e.preventDefault();
        setError(null);

        if (!token) {
            setError(
                t('auth.resetPassword.tokenMissing', 'El enlace de recuperación no es válido')
            );
            return;
        }

        if (password.length < 8) {
            setError(
                t(
                    'auth.resetPassword.passwordTooShort',
                    'La contraseña debe tener al menos 8 caracteres'
                )
            );
            return;
        }

        if (password !== confirmPassword) {
            setError(t('auth.resetPassword.passwordMismatch', 'Las contraseñas no coinciden'));
            return;
        }

        setIsLoading(true);

        try {
            const result = await resetPassword({ newPassword: password, token });

            if (result.error) {
                setError(
                    result.error.message ??
                        t('auth.resetPassword.error', 'No se pudo restablecer la contraseña')
                );
            } else {
                setIsComplete(true);
            }
        } catch {
            setError(t('auth.resetPassword.error', 'No se pudo restablecer la contraseña'));
        } finally {
            setIsLoading(false);
        }
    }

    if (isComplete) {
        return (
            <output
                className={styles.success}
                aria-live="polite"
            >
                <div
                    className={styles.successIcon}
                    aria-hidden="true"
                >
                    <CheckIcon />
                </div>
                <h2 className={styles.successTitle}>
                    {t('auth.resetPassword.successTitle', 'Contraseña actualizada')}
                </h2>
                <p className={styles.successMessage}>
                    {t(
                        'auth.resetPassword.successMessage',
                        'Tu contrasena fue actualizada exitosamente. Ya podes iniciar sesion.'
                    )}
                </p>
                <a
                    href={signInUrl}
                    className={styles.signInLink}
                >
                    {t('auth.resetPassword.goToSignIn', 'Iniciar sesión')}
                </a>
            </output>
        );
    }

    return (
        <form
            className={styles.form}
            onSubmit={handleSubmit}
            noValidate
            aria-label={t('auth.resetPassword.submit', 'Restablecer contraseña')}
        >
            <div className={styles.header}>
                <h2 className={styles.title}>
                    {t('auth.resetPassword.title', 'Nueva contrasena')}
                </h2>
                <p className={styles.description}>
                    {t('auth.resetPassword.description', 'Ingresa y confirma tu nueva contrasena.')}
                </p>
            </div>

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
                    htmlFor="reset-password"
                    className={styles.label}
                >
                    {t('auth.resetPassword.password', 'Nueva contraseña')}
                </label>
                <input
                    id="reset-password"
                    type="password"
                    className={styles.input}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('auth.resetPassword.passwordPlaceholder', 'Mínimo 8 caracteres')}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    aria-required="true"
                    disabled={isLoading}
                />
            </div>

            <div className={styles.field}>
                <label
                    htmlFor="reset-confirm-password"
                    className={styles.label}
                >
                    {t('auth.resetPassword.confirmPassword', 'Confirmar contraseña')}
                </label>
                <input
                    id="reset-confirm-password"
                    type="password"
                    className={styles.input}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t(
                        'auth.resetPassword.confirmPasswordPlaceholder',
                        'Repite tu contraseña'
                    )}
                    required
                    minLength={8}
                    autoComplete="new-password"
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
                    ? t('auth.resetPassword.loading', 'Actualizando...')
                    : t('auth.resetPassword.submit', 'Restablecer contraseña')}
            </button>

            <div className={styles.footer}>
                <a
                    href={signInUrl}
                    className={styles.backLink}
                >
                    {t('auth.resetPassword.backToSignIn', 'Volver al inicio de sesión')}
                </a>
            </div>
        </form>
    );
}

function CheckIcon() {
    return (
        <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            <circle
                cx="12"
                cy="12"
                r="10"
            />
            <path d="m9 12 2 2 4-4" />
        </svg>
    );
}
