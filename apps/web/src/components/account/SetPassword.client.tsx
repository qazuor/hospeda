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

import {
    Dialog,
    DialogBody,
    DialogFooter,
    DialogHeader
} from '@/components/shared/ui/Dialog.client';
import { refreshBetterAuthSession } from '@/lib/auth-client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { queueToastForNextPage } from '@/store/toast-store';
import { PROFILE_COMPLETION_MIN_PASSWORD_LENGTH, StrongPasswordRegex } from '@repo/schemas';
import { useState } from 'react';
import { PasswordField } from '../ui/PasswordField.client';
import type { PasswordFieldI18n } from '../ui/PasswordField.client';
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
 * Presents password + confirm-password fields (via `PasswordField`) with
 * show/hide toggles and a strength bar. Two CTAs: set a password or skip.
 * The skip path shows a confirmation modal before calling the skip endpoint.
 *
 * @param props - Component props (see {@link SetPasswordProps})
 */
export function SetPassword({ locale, apiUrl, oauthProvider = 'unknown' }: SetPasswordProps) {
    const { t } = createTranslations(locale);

    // ── Form state ────────────────────────────────────────────────────────────

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [confirmError, setConfirmError] = useState<string | null>(null);
    const [globalError, setGlobalError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [showSkipModal, setShowSkipModal] = useState(false);
    const [skipping, setSkipping] = useState(false);

    // ── i18n for PasswordField ────────────────────────────────────────────────

    const passwordI18n: PasswordFieldI18n = {
        showPassword: t('account.setPassword.showPassword', 'Mostrar contraseña'),
        hidePassword: t('account.setPassword.hidePassword', 'Ocultar contraseña'),
        strength: {
            weak: t('account.setPassword.passwordStrength.weak', 'Débil'),
            medium: t('account.setPassword.passwordStrength.medium', 'Media'),
            strong: t('account.setPassword.passwordStrength.strong', 'Fuerte')
        },
        rules: {
            length: t('account.setPassword.rules.length', 'Mínimo 8 caracteres'),
            upper: t('account.setPassword.rules.upper', 'Al menos 1 mayúscula'),
            lower: t('account.setPassword.rules.lower', 'Al menos 1 minúscula'),
            digit: t('account.setPassword.rules.digit', 'Al menos 1 número'),
            special: t(
                'account.setPassword.rules.special',
                'Al menos 1 carácter especial (@$!%*?&)'
            )
        }
    };

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
        setConfirmError(null);

        if (password.length < PROFILE_COMPLETION_MIN_PASSWORD_LENGTH) {
            setPasswordError(
                t(
                    'account.setPassword.errors.passwordMin',
                    'La contraseña debe tener al menos 8 caracteres.'
                )
            );
            return;
        }

        if (!StrongPasswordRegex.test(password)) {
            setPasswordError(
                t(
                    'account.setPassword.errors.passwordWeak',
                    'La contraseña debe tener mayúsculas, minúsculas, un número y un carácter especial (@$!%*?&).'
                )
            );
            return;
        }

        if (password !== confirmPassword) {
            setConfirmError(
                t('account.setPassword.errors.passwordsMismatch', 'Las contraseñas no coinciden.')
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

            queueToastForNextPage({
                type: 'success',
                message: t(
                    'account.setPassword.successToast',
                    'Contraseña establecida correctamente'
                )
            });

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
                    <PasswordField
                        id="sp-password"
                        label={t('account.setPassword.fields.password', 'Contraseña')}
                        value={password}
                        onChange={(v) => {
                            setPassword(v);
                            if (passwordError) setPasswordError(null);
                        }}
                        placeholder={t(
                            'account.setPassword.fields.passwordPlaceholder',
                            'Mínimo 8 caracteres'
                        )}
                        autoComplete="new-password"
                        required
                        disabled={submitting || skipping}
                        showStrength
                        showRuleChecklist
                        error={passwordError ?? undefined}
                        hint={t('account.setPassword.fields.passwordHint', 'Mínimo 8 caracteres.')}
                        i18n={passwordI18n}
                    />

                    {/* Confirm password field */}
                    <PasswordField
                        id="sp-confirm-password"
                        label={t(
                            'account.setPassword.fields.confirmPassword',
                            'Confirmar contraseña'
                        )}
                        value={confirmPassword}
                        onChange={(v) => {
                            setConfirmPassword(v);
                            if (confirmError) setConfirmError(null);
                        }}
                        placeholder={t(
                            'account.setPassword.fields.confirmPasswordPlaceholder',
                            'Repetí tu contraseña'
                        )}
                        autoComplete="new-password"
                        required
                        disabled={submitting || skipping}
                        showStrength={false}
                        error={confirmError ?? undefined}
                        i18n={passwordI18n}
                    />

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

            {/* Skip confirmation modal — uses the shared Dialog primitive (portal,
                backdrop, focus trap, Esc + overlay close). A raw `<dialog>` element
                inherits user-agent width/margin/border that break the overlay layout. */}
            <Dialog
                isOpen={showSkipModal}
                onClose={() => setShowSkipModal(false)}
                size="sm"
                ariaLabelledBy="skip-modal-title"
                closeOnEscape={!skipping}
                closeOnOverlayClick={!skipping}
            >
                <DialogHeader titleId="skip-modal-title">
                    {t('account.setPassword.skipModalTitle', '¿Saltar por ahora?')}
                </DialogHeader>
                <DialogBody>
                    <p
                        id="skip-modal-body"
                        className={styles.modalBody}
                    >
                        {t(
                            'account.setPassword.skipModalBody',
                            'Vas a poder establecerla más tarde desde tu perfil. ¿Continuar?'
                        )}
                    </p>
                </DialogBody>
                <DialogFooter>
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
                </DialogFooter>
            </Dialog>
        </div>
    );
}
