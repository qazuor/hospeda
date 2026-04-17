/**
 * @file ForgotPassword.client.tsx
 * @description Forgot-password form React island for web2.
 *
 * Standalone component — no dependency on @repo/auth-ui.
 * Requests a password-reset email via forgetPassword() from auth-client.ts.
 * Shows a success state after submission instead of redirecting.
 */

import { GradientButton } from '@/components/ui/GradientButtonReact';
import { forgetPassword } from '@/lib/auth-client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useState } from 'react';
import styles from './ForgotPassword.module.css';

/** Props for the ForgotPassword component. */
export interface ForgotPasswordProps {
    /** Active locale — used for translations. */
    readonly locale: SupportedLocale;
    /** Absolute URL embedded in the reset email (e.g. `/es/auth/reset-password/`). */
    readonly resetPasswordUrl: string;
    /** URL to the sign-in page — shown as a link inside the form. */
    readonly signInUrl: string;
}

/**
 * Forgot-password form that requests a password-reset email.
 *
 * Transitions to a success state (no redirect) after the email is sent.
 * Does NOT show OAuth buttons — this is a recovery flow only.
 *
 * @example
 * ```astro
 * <ForgotPassword
 *   client:load
 *   locale={locale}
 *   resetPasswordUrl="/es/auth/reset-password/"
 *   signInUrl="/es/auth/signin/"
 * />
 * ```
 */
export function ForgotPassword({ locale, resetPasswordUrl, signInUrl }: ForgotPasswordProps) {
    const { t } = createTranslations(locale);

    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSent, setIsSent] = useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
        e.preventDefault();
        setError(null);

        if (!email.trim()) {
            setError(t('auth.forgotPassword.emailRequired', 'Ingresa tu correo electrónico'));
            return;
        }

        setIsLoading(true);

        try {
            const result = await forgetPassword({ email, redirectTo: resetPasswordUrl });

            if (result.error) {
                setError(
                    result.error.message ??
                        t('auth.forgotPassword.error', 'Error al enviar el correo de recuperación')
                );
            } else {
                setIsSent(true);
            }
        } catch {
            setError(t('auth.forgotPassword.error', 'Error al enviar el correo de recuperación'));
        } finally {
            setIsLoading(false);
        }
    }

    if (isSent) {
        return (
            <output
                className={styles.success}
                aria-live="polite"
            >
                <div
                    className={styles.successIcon}
                    aria-hidden="true"
                >
                    <MailIcon />
                </div>
                <h2 className={styles.successTitle}>
                    {t('auth.forgotPassword.sentTitle', 'Revisa tu email')}
                </h2>
                <p className={styles.successMessage}>
                    {t(
                        'auth.forgotPassword.sentMessage',
                        'Te enviamos un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada.'
                    )}
                </p>
                <a
                    href={signInUrl}
                    className={styles.backLink}
                >
                    {t('auth.forgotPassword.backToSignIn', 'Volver al inicio de sesión')}
                </a>
            </output>
        );
    }

    return (
        <form
            className={styles.form}
            onSubmit={handleSubmit}
            noValidate
            aria-label={t('auth.forgotPassword.submit', 'Recuperar contraseña')}
        >
            <div className={styles.header}>
                <h2 className={styles.title}>
                    {t('auth.forgotPassword.title', 'Recuperar contraseña')}
                </h2>
                <p className={styles.description}>
                    {t(
                        'auth.forgotPassword.description',
                        'Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.'
                    )}
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
                    htmlFor="forgot-email"
                    className={styles.label}
                >
                    {t('auth.forgotPassword.email', 'Correo electrónico')}
                </label>
                <input
                    id="forgot-email"
                    type="email"
                    className={styles.input}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('auth.forgotPassword.emailPlaceholder', 'tu@email.com')}
                    required
                    autoComplete="email"
                    aria-required="true"
                    disabled={isLoading}
                />
            </div>

            <GradientButton
                as="button"
                type="submit"
                variant="accent"
                size="md"
                shape="rounded"
                label={
                    isLoading
                        ? t('auth.forgotPassword.loading', 'Enviando...')
                        : t('auth.forgotPassword.submit', 'Enviar enlace de recuperación')
                }
                disabled={isLoading}
                aria={{ busy: isLoading }}
                className={styles.submitButton}
            />

            <div className={styles.footer}>
                <a
                    href={signInUrl}
                    className={styles.backLink}
                >
                    {t('auth.forgotPassword.backToSignIn', 'Volver al inicio de sesión')}
                </a>
            </div>
        </form>
    );
}

function MailIcon() {
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
            <rect
                width="20"
                height="16"
                x="2"
                y="4"
                rx="2"
            />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
    );
}
