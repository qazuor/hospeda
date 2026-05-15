/**
 * @file SetPassword.client.tsx
 * @description React island for the OAuth-only set-password sub-flow (SPEC-113 T-113-05 §3.6).
 *
 * Shown to users who signed up via Google or Facebook and have no credential account.
 * Two CTAs:
 *   - Primary: "Establecer contraseña" → POST /api/v1/protected/profile/set-password
 *   - Secondary: "Saltar por ahora" → confirmation modal → POST /api/v1/protected/profile/skip-set-password
 *
 * On success (either path): redirects to /{locale}/mi-cuenta/.
 *
 * Hydration: caller MUST use `client:load`.
 */

import { refreshBetterAuthSession } from '@/lib/auth-client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { queueToastForNextPage } from '@/store/toast-store';
import { PROFILE_COMPLETION_MIN_PASSWORD_LENGTH } from '@repo/schemas';
import { useState } from 'react';
import styles from './SetPassword.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

/** OAuth provider that the user used to sign up. */
type OAuthProvider = 'google' | 'facebook' | 'unknown';

/** Props for the SetPassword island. */
export interface SetPasswordProps {
    /** Active locale for i18n and redirect URLs. */
    readonly locale: SupportedLocale;
    /** API base URL (PUBLIC_API_URL from env). */
    readonly apiUrl: string;
    /**
     * OAuth provider the user authenticated with, used for context message.
     * Defaults to 'unknown' which uses a generic message.
     */
    readonly oauthProvider?: OAuthProvider;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Set-password form island for OAuth-only users.
 *
 * Presents a password input and two CTAs: set a password or skip.
 * The skip path shows a confirmation modal before calling the skip endpoint.
 *
 * @param props - Component props
 */
export function SetPassword({ locale, apiUrl, oauthProvider = 'unknown' }: SetPasswordProps) {
    const { t } = createTranslations(locale);

    // ── Form state ────────────────────────────────────────────────────────────

    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [globalError, setGlobalError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [showSkipModal, setShowSkipModal] = useState(false);
    const [skipping, setSkipping] = useState(false);

    // ── Context message ───────────────────────────────────────────────────────

    function getContextMessage(): string {
        if (oauthProvider === 'google') {
            return t(
                'account.setPassword.contextGoogle',
                'Te registraste con Google. Si querés, podés agregar una contraseña para también iniciar sesión con email.'
            );
        }
        if (oauthProvider === 'facebook') {
            return t(
                'account.setPassword.contextFacebook',
                'Te registraste con Facebook. Si querés, podés agregar una contraseña para también iniciar sesión con email.'
            );
        }
        return t(
            'account.setPassword.contextOAuth',
            'Te registraste con una cuenta social. Si querés, podés agregar una contraseña para también iniciar sesión con email.'
        );
    }

    // ── Submit (set password) ─────────────────────────────────────────────────

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setGlobalError(null);
        setPasswordError(null);

        if (password.length < PROFILE_COMPLETION_MIN_PASSWORD_LENGTH) {
            setPasswordError(
                t(
                    'account.setPassword.errors.passwordMin',
                    'La contraseña debe tener al menos 8 caracteres.'
                )
            );
            return;
        }

        setSubmitting(true);

        try {
            const response = await fetch(`${apiUrl}/api/v1/protected/profile/set-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ password })
            });

            if (!response.ok) {
                const errorData = (await response.json()) as {
                    error?: { message?: string };
                };
                setGlobalError(
                    errorData?.error?.message ??
                        t(
                            'account.setPassword.errors.submitFailed',
                            'No se pudo establecer la contraseña. Intentá nuevamente.'
                        )
                );
                return;
            }

            // Persist the toast across the hard navigation — the current
            // page tree unmounts on `window.location.href`, so calling
            // `addToast` here would never render. `queueToastForNextPage`
            // stashes the toast in sessionStorage and `ToastViewport` drains
            // it on the next page's mount.
            queueToastForNextPage({
                type: 'success',
                message: t(
                    'account.setPassword.successToast',
                    'Contraseña establecida correctamente'
                )
            });

            // Refresh the Better Auth session cookie cache so the next page
            // sees the newly linked credential account immediately.
            await refreshBetterAuthSession();

            window.location.href = `/${locale}/mi-cuenta/`;
        } catch {
            setGlobalError(
                t(
                    'account.setPassword.errors.submitFailed',
                    'No se pudo establecer la contraseña. Intentá nuevamente.'
                )
            );
        } finally {
            setSubmitting(false);
        }
    }

    // ── Skip ──────────────────────────────────────────────────────────────────

    function handleSkipClick(): void {
        setShowSkipModal(true);
    }

    async function handleSkipConfirm(): Promise<void> {
        setSkipping(true);
        setGlobalError(null);

        try {
            const response = await fetch(`${apiUrl}/api/v1/protected/profile/skip-set-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({})
            });

            if (!response.ok) {
                setShowSkipModal(false);
                const errorData = (await response.json()) as {
                    error?: { message?: string };
                };
                setGlobalError(
                    errorData?.error?.message ??
                        t(
                            'account.setPassword.errors.skipFailed',
                            'No se pudo saltar el paso. Intentá nuevamente.'
                        )
                );
                return;
            }

            // Refresh the session cookie cache so the next page reflects the
            // updated set_password_prompted flag (prevents middleware from
            // re-redirecting back to this screen if it stays in cache).
            await refreshBetterAuthSession();

            window.location.href = `/${locale}/mi-cuenta/`;
        } catch {
            setShowSkipModal(false);
            setGlobalError(
                t(
                    'account.setPassword.errors.skipFailed',
                    'No se pudo saltar el paso. Intentá nuevamente.'
                )
            );
        } finally {
            setSkipping(false);
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className={styles.wrapper}>
            <div className={styles.header}>
                <h1 className={styles.heading}>
                    {t('account.setPassword.heading', 'Agregá una contraseña')}
                </h1>
                <p className={styles.context}>{getContextMessage()}</p>
            </div>

            <div className={styles.card}>
                <form
                    className={styles.form}
                    onSubmit={handleSubmit}
                    noValidate
                >
                    {/* Password field */}
                    <div className={styles.field}>
                        <label
                            htmlFor="sp-password"
                            className={styles.label}
                        >
                            {t('account.setPassword.fields.password', 'Contraseña')}
                            <span
                                className={styles.required}
                                aria-hidden="true"
                            >
                                {' *'}
                            </span>
                        </label>
                        <input
                            id="sp-password"
                            type="password"
                            className={
                                passwordError
                                    ? `${styles.input} ${styles.inputError}`
                                    : styles.input
                            }
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={t(
                                'account.setPassword.fields.passwordPlaceholder',
                                'Mínimo 8 caracteres'
                            )}
                            aria-required="true"
                            aria-describedby={
                                passwordError ? 'sp-password-error' : 'sp-password-hint'
                            }
                            autoComplete="new-password"
                            disabled={submitting || skipping}
                        />
                        {passwordError ? (
                            <p
                                id="sp-password-error"
                                className={styles.errorMsg}
                                role="alert"
                            >
                                {passwordError}
                            </p>
                        ) : (
                            <p
                                id="sp-password-hint"
                                className={styles.hint}
                            >
                                {t(
                                    'account.setPassword.fields.passwordHint',
                                    'Mínimo 8 caracteres.'
                                )}
                            </p>
                        )}
                    </div>

                    {/* Global error banner */}
                    {globalError && (
                        <div
                            className={`${styles.feedbackBanner} ${styles.feedbackBannerError}`}
                            role="alert"
                        >
                            {globalError}
                        </div>
                    )}

                    {/* Actions */}
                    <div className={styles.actionRow}>
                        <button
                            type="button"
                            className={styles.skipBtn}
                            onClick={handleSkipClick}
                            disabled={submitting || skipping}
                        >
                            {t('account.setPassword.skip', 'Saltar por ahora')}
                        </button>

                        <button
                            type="submit"
                            className={styles.submitBtn}
                            disabled={submitting || skipping}
                        >
                            {submitting ? (
                                <>
                                    <span
                                        className={styles.spinner}
                                        aria-hidden="true"
                                    />
                                    {t('account.setPassword.submitting', 'Guardando...')}
                                </>
                            ) : (
                                t('account.setPassword.submit', 'Establecer contraseña')
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* Skip confirmation modal */}
            {showSkipModal && (
                <dialog
                    open
                    className={styles.modalOverlay}
                    aria-modal="true"
                    aria-labelledby="skip-modal-title"
                    aria-describedby="skip-modal-body"
                >
                    <div className={styles.modal}>
                        <h2
                            id="skip-modal-title"
                            className={styles.modalTitle}
                        >
                            {t('account.setPassword.skipModalTitle', '¿Saltar por ahora?')}
                        </h2>
                        <p
                            id="skip-modal-body"
                            className={styles.modalBody}
                        >
                            {t(
                                'account.setPassword.skipModalBody',
                                'Vas a poder establecerla más tarde desde tu perfil. ¿Continuar?'
                            )}
                        </p>
                        <div className={styles.modalActions}>
                            <button
                                type="button"
                                className={styles.modalCancelBtn}
                                onClick={() => setShowSkipModal(false)}
                                disabled={skipping}
                            >
                                {t('account.setPassword.skipModalCancel', 'Cancelar')}
                            </button>
                            <button
                                type="button"
                                className={styles.modalConfirmBtn}
                                onClick={handleSkipConfirm}
                                disabled={skipping}
                            >
                                {skipping ? (
                                    <>
                                        <span
                                            className={styles.spinner}
                                            aria-hidden="true"
                                        />
                                        {t('account.setPassword.submitting', 'Guardando...')}
                                    </>
                                ) : (
                                    t('account.setPassword.skipModalConfirm', 'Sí, saltar')
                                )}
                            </button>
                        </div>
                    </div>
                </dialog>
            )}
        </div>
    );
}
