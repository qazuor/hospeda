/**
 * @file SetPassword.client.tsx
 * @description React island for the OAuth-only set-password sub-flow (SPEC-113 T-113-05 §3.6).
 *
 * Shown to users who signed up via Google or Facebook and have no credential account.
 * Two CTAs:
 *   - Primary: "Establecer contraseña" → POST /api/v1/protected/profile/set-password
 *   - Secondary: "Saltar por ahora" (ghost button AFTER the primary) → ConfirmDialog → POST /api/v1/protected/profile/skip-set-password
 *
 * On success (either path): redirects to /{locale}/mi-cuenta/.
 *
 * Hydration: caller MUST use `client:load`.
 */

import { StrongPasswordSchema } from '@repo/schemas';
import { useState } from 'react';
import { visibleApiMessage } from '@/lib/api-errors';
import { refreshBetterAuthSession } from '@/lib/auth-client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { queueToastForNextPage } from '@/store/toast-store';
import type { PasswordFieldI18n } from '../ui/PasswordField.client';
import { PasswordField } from '../ui/PasswordField.client';
import styles from './SetPassword.module.css';
import { Alert, Button, ConfirmDialog, PageHeader, Section } from './ui';

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
     * Where to land once this step is done.
     *
     * Resolved and validated server-side by the page (HOS-838): it is the
     * destination the onboarding gate interrupted, or `/{locale}/mi-cuenta/`
     * when there was none. Never build it here — the open-redirect guard lives
     * on the server and an island must not re-implement it.
     */
    readonly returnUrl: string;
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
export function SetPassword({
    locale,
    apiUrl,
    returnUrl,
    oauthProvider = 'unknown'
}: SetPasswordProps) {
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
        showPassword: t('account.setPassword.showPassword'),
        hidePassword: t('account.setPassword.hidePassword'),
        strength: {
            weak: t('account.setPassword.passwordStrength.weak'),
            medium: t('account.setPassword.passwordStrength.medium'),
            strong: t('account.setPassword.passwordStrength.strong')
        },
        rules: {
            length: t('account.setPassword.rules.length'),
            upper: t('account.setPassword.rules.upper'),
            lower: t('account.setPassword.rules.lower'),
            digit: t('account.setPassword.rules.digit'),
            special: t('account.setPassword.rules.special')
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

        // HOS-190 slice 3: validate against the shared StrongPasswordSchema
        // (min 8, max 128, upper/lower/digit/special) instead of the old
        // hand-rolled length + regex pair, which never enforced the 128-char
        // cap the server-side schema does.
        const passwordResult = StrongPasswordSchema.safeParse(password);
        if (!passwordResult.success) {
            const issue = passwordResult.error.issues[0];
            if (issue?.code === 'too_small') {
                setPasswordError(
                    t(
                        'account.setPassword.errors.passwordMin',
                        'La contraseña debe tener al menos 8 caracteres.'
                    )
                );
            } else if (issue?.code === 'too_big') {
                // NOTE (HOS-190 i18n gap): no dedicated i18n key exists yet for
                // this case — the fallback below is shown for every locale
                // until `account.setPassword.errors.passwordMax` is added.
                setPasswordError(t('account.setPassword.errors.passwordMax'));
            } else {
                setPasswordError(
                    t(
                        'account.setPassword.errors.passwordWeak',
                        'La contraseña debe tener mayúsculas, minúsculas, un número y un carácter especial (por ejemplo ! @ # $ - _).'
                    )
                );
            }
            return;
        }

        if (password !== confirmPassword) {
            setConfirmError(t('account.setPassword.errors.passwordsMismatch'));
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
                    visibleApiMessage({ error: errorData?.error, status: response.status }) ??
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

            window.location.href = returnUrl;
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

    function handleSkipCancel(): void {
        if (!skipping) setShowSkipModal(false);
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
                    visibleApiMessage({ error: errorData?.error, status: response.status }) ??
                        t(
                            'account.setPassword.errors.skipFailed',
                            'No se pudo saltar el paso. Intentá nuevamente.'
                        )
                );
                return;
            }

            await refreshBetterAuthSession();

            window.location.href = returnUrl;
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

    const busy = submitting || skipping;

    return (
        <div className={styles.page}>
            <PageHeader
                title={t('account.setPassword.heading', 'Agregá una contraseña')}
                description={getContextMessage()}
                locale={locale}
            />

            <form
                onSubmit={handleSubmit}
                noValidate
            >
                <Section
                    title={t('account.setPassword.sectionTitle')}
                    helpId="section:account.set-password"
                >
                    <div className={styles.fields}>
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
                            disabled={busy}
                            showStrength
                            showRuleChecklist
                            error={passwordError ?? undefined}
                            hint={t(
                                'account.setPassword.fields.passwordHint',
                                'Mínimo 8 caracteres.'
                            )}
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
                            disabled={busy}
                            showStrength={false}
                            error={confirmError ?? undefined}
                            i18n={passwordI18n}
                        />

                        {/* Global error banner */}
                        {globalError ? (
                            <Alert
                                tone="danger"
                                locale={locale}
                            >
                                {globalError}
                            </Alert>
                        ) : null}

                        {/* Actions: the primary first, «Saltar» as a ghost button after it. */}
                        <div className={styles.actions}>
                            <Button
                                type="submit"
                                variant="primary"
                                loading={submitting}
                                disabled={busy}
                            >
                                {submitting
                                    ? t('account.setPassword.submitting', 'Guardando...')
                                    : t('account.setPassword.submit', 'Establecer contraseña')}
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={handleSkipClick}
                                disabled={busy}
                            >
                                {t('account.setPassword.skip', 'Saltar por ahora')}
                            </Button>
                        </div>
                    </div>
                </Section>
            </form>

            <ConfirmDialog
                open={showSkipModal}
                title={t('account.setPassword.skipModalTitle', '¿Saltar por ahora?')}
                description={t(
                    'account.setPassword.skipModalBody',
                    'Vas a poder establecerla más tarde desde tu perfil. ¿Continuar?'
                )}
                confirmLabel={t('account.setPassword.skipModalConfirm', 'Sí, saltar')}
                cancelLabel={t('account.setPassword.skipModalCancel', 'Cancelar')}
                locale={locale}
                tone="neutral"
                onConfirm={handleSkipConfirm}
                onCancel={handleSkipCancel}
            />
        </div>
    );
}
