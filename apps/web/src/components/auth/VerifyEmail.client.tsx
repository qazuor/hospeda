/**
 * @file VerifyEmail.client.tsx
 * @description Email verification React island for web2.
 *
 * Standalone component — no dependency on @repo/auth-ui.
 * NOT a form. Auto-verifies on mount using the token prop.
 * Redirects automatically after success (with configurable delay).
 */

import { verifyEmail } from '@/lib/auth-client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import styles from './VerifyEmail.module.css';

/** Possible verification states. */
type VerifyStatus = 'loading' | 'success' | 'error';

/** Props for the VerifyEmail component. */
export interface VerifyEmailProps {
    /** Active locale — used for translations. */
    readonly locale: SupportedLocale;
    /** One-time verification token from the email link query string. */
    readonly token: string;
    /** URL to redirect to after successful verification. */
    readonly redirectTo: string;
    /** Milliseconds to wait before redirecting on success. Defaults to 3000. */
    readonly redirectDelay?: number;
}

/**
 * Email verification component that auto-verifies on mount.
 *
 * Shows three distinct UI states:
 * - loading: spinner while the API call is in flight.
 * - success: checkmark + countdown message, then redirects.
 * - error: error message with a hint to check the link.
 *
 * @example
 * ```astro
 * <VerifyEmail
 *   client:load
 *   locale={locale}
 *   token={token}
 *   redirectTo="/es/auth/signin/"
 *   redirectDelay={3000}
 * />
 * ```
 */
export function VerifyEmail({ locale, token, redirectTo, redirectDelay = 3000 }: VerifyEmailProps) {
    const { t } = createTranslations(locale);

    const [status, setStatus] = useState<VerifyStatus>('loading');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        let redirectTimer: ReturnType<typeof setTimeout> | null = null;

        async function verify(): Promise<void> {
            if (!token) {
                setErrorMessage(
                    t('auth.verifyEmail.tokenMissing', 'El enlace de verificacion no es valido')
                );
                setStatus('error');
                return;
            }

            try {
                const result = await verifyEmail({ token });

                if (result.error) {
                    setErrorMessage(
                        result.error.message ??
                            t(
                                'auth.verifyEmail.error',
                                'La verificacion fallo. El enlace puede haber expirado.'
                            )
                    );
                    setStatus('error');
                } else {
                    setStatus('success');
                    redirectTimer = setTimeout(() => {
                        window.location.replace(redirectTo);
                    }, redirectDelay);
                }
            } catch {
                setErrorMessage(
                    t(
                        'auth.verifyEmail.error',
                        'La verificacion fallo. El enlace puede haber expirado.'
                    )
                );
                setStatus('error');
            }
        }

        void verify();

        return () => {
            if (redirectTimer !== null) {
                clearTimeout(redirectTimer);
            }
        };
    }, [token, redirectTo, redirectDelay, t]);

    if (status === 'loading') {
        return (
            <output
                className={styles.stateContainer}
                aria-live="polite"
                aria-label={t('auth.verifyEmail.verifying', 'Verificando correo electronico...')}
            >
                <div
                    className={styles.spinner}
                    aria-hidden="true"
                />
                <p className={styles.stateMessage}>
                    {t('auth.verifyEmail.verifying', 'Verificando correo electronico...')}
                </p>
            </output>
        );
    }

    if (status === 'success') {
        return (
            <output
                className={styles.stateContainer}
                aria-live="polite"
            >
                <div
                    className={styles.successIcon}
                    aria-hidden="true"
                >
                    <CheckCircleIcon />
                </div>
                <h2 className={styles.successTitle}>
                    {t('auth.verifyEmail.successTitle', 'Correo verificado')}
                </h2>
                <p className={styles.stateMessage}>
                    {t(
                        'auth.verifyEmail.successMessage',
                        'Tu correo fue verificado exitosamente. Redirigiendo...'
                    )}
                </p>
            </output>
        );
    }

    return (
        <div
            className={styles.stateContainer}
            role="alert"
            aria-live="assertive"
        >
            <div
                className={styles.errorIcon}
                aria-hidden="true"
            >
                <AlertCircleIcon />
            </div>
            <h2 className={styles.errorTitle}>
                {t('auth.verifyEmail.errorTitle', 'Verificacion fallida')}
            </h2>
            {errorMessage && <p className={styles.stateMessage}>{errorMessage}</p>}
            <p className={styles.hint}>
                {t(
                    'auth.verifyEmail.hint',
                    'El enlace puede haber expirado. Solicita uno nuevo desde la pagina de inicio de sesion.'
                )}
            </p>
        </div>
    );
}

function CheckCircleIcon() {
    return (
        <svg
            width="56"
            height="56"
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

function AlertCircleIcon() {
    return (
        <svg
            width="56"
            height="56"
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
            <line
                x1="12"
                x2="12"
                y1="8"
                y2="12"
            />
            <line
                x1="12"
                x2="12.01"
                y1="16"
                y2="16"
            />
        </svg>
    );
}
