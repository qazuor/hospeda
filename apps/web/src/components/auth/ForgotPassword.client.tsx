/**
 * @file ForgotPassword.client.tsx
 * @description Forgot-password form React island for web.
 *
 * Standalone component — no dependency on @repo/auth-ui.
 * Requests a password-reset email via forgetPassword() from auth-client.ts.
 * Shows a success state after submission instead of redirecting.
 */

import { EmailIcon } from '@repo/icons';
import { useState } from 'react';
import { z } from 'zod';
import { GradientButton } from '@/components/ui/GradientButtonReact';
import { translateApiError } from '@/lib/api-errors';
import { forgetPassword } from '@/lib/auth-client';
import { authEmailSchema } from '@/lib/forms/auth-form-schemas';
import { useZodForm } from '@/lib/forms/use-zod-form';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { AuthEmailField } from './AuthEmailField';
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
    const {
        fieldErrors,
        formError: error,
        setFormError: setError,
        validate,
        clearError
    } = useZodForm({
        schema: z.object({
            email: authEmailSchema({
                required: t('auth.forgotPassword.emailRequired'),
                invalid: t('auth.forgotPassword.emailInvalid')
            })
        }),
        fieldIdPrefix: 'forgot',
        validationToast: false
    });
    const [isSent, setIsSent] = useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
        e.preventDefault();
        setError(null);

        const parsed = validate({ email });
        if (!parsed.success) return;

        setIsLoading(true);

        try {
            const result = await forgetPassword({
                email: parsed.data.email,
                redirectTo: resetPasswordUrl
            });

            if (result.error) {
                setError(
                    translateApiError({
                        error: result.error,
                        t,
                        fallback: t(
                            'auth.forgotPassword.error',
                            'Error al enviar el correo de recuperación'
                        )
                    })
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
                    <EmailIcon size={48} />
                </div>
                <h2 className={styles.successTitle}>
                    {t('auth.forgotPassword.sentTitle', 'Revisá tu email')}
                </h2>
                <p className={styles.successMessage}>
                    {t(
                        'auth.forgotPassword.sentMessage',
                        'Te enviamos un enlace para restablecer tu contraseña. Revisá tu bandeja de entrada.'
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
                        'Ingresá tu correo y te enviamos un enlace para restablecer tu contraseña.'
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

            <AuthEmailField
                prefix="forgot"
                label={t('auth.forgotPassword.email')}
                value={email}
                onChange={(value) => {
                    setEmail(value);
                    clearError('email');
                }}
                placeholder={t('auth.forgotPassword.emailPlaceholder')}
                disabled={isLoading}
                error={fieldErrors.email}
            />

            <GradientButton
                as="button"
                type="submit"
                variant="accent"
                flat
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
