/**
 * @file ChangePasswordForm.client.tsx
 * @description Change-password form React island (SPEC-239 T-055).
 *
 * Shown to commerce owners who were provisioned with a server-generated
 * password and must choose a personal one before using the platform.
 * Also accessible as a voluntary password change from the account section.
 *
 * Fields: currentPassword, newPassword, confirmNewPassword.
 * Validates that newPassword === confirmNewPassword client-side.
 * Submits to POST /api/v1/protected/auth/change-password with credentials.
 * On success shows a brief confirmation banner, then redirects to
 * /{locale}/mi-cuenta/ after 1.5 s.
 *
 * Extras: password-strength meter (weak / medium / strong heuristic),
 * show/hide toggle on all three inputs.
 *
 * Hydration: caller MUST use `client:load`.
 */

import { ChangePasswordInputSchema } from '@repo/schemas';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { PasswordField, type PasswordFieldI18n } from '@/components/ui/PasswordField.client';
import { refreshBetterAuthSession } from '@/lib/auth-client';
import { zodIssuesToFieldErrors } from '@/lib/forms/field-errors';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './ChangePasswordForm.module.css';

// API base URL — must be absolute because the web app and API live on different
// origins in both dev and prod.
const API_BASE = (import.meta.env.PUBLIC_API_URL ?? '').replace(/\/$/, '');

// ─── Types ────────────────────────────────────────────────────────────────────

/** Props for the ChangePasswordForm island. */
export interface ChangePasswordFormProps {
    /** Active locale for i18n and redirect URL. */
    readonly locale: SupportedLocale;
    /**
     * Email of the account whose password this form changes — HOS-752.
     *
     * The submit carries NO account identifier: it posts with
     * `credentials: 'include'` and the API resolves the account from the
     * session cookie. So the account being changed is whoever is signed in on
     * this browser, which is not necessarily who the person believes they are
     * acting as. Rendering it is what makes that visible.
     */
    readonly accountEmail: string;
    /**
     * Where to land once this step is done.
     *
     * Resolved and validated server-side by the page (HOS-838): it is the
     * destination the onboarding gate interrupted, or `/{locale}/mi-cuenta/`
     * when there was none. Never build it here — the open-redirect guard lives
     * on the server and an island must not re-implement it.
     */
    readonly returnUrl: string;
}

interface FormFields {
    readonly currentPassword: string;
    readonly newPassword: string;
    readonly confirmNewPassword: string;
}

type FieldErrors = Partial<Record<keyof FormFields, string>>;

/** Password strength level (based on local heuristic — no npm deps). */

// ─── Component ───────────────────────────────────────────────────────────────

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_FIELDS: FormFields = {
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
};

/**
 * ChangePasswordForm — forced or voluntary password-change island.
 *
 * Validation: client-side mismatch check + ChangePasswordInputSchema (Zod).
 * Submission: POST /api/v1/protected/auth/change-password (credentials: 'include').
 * Success: shows success banner, then redirects to /{locale}/mi-cuenta/ after 1.5 s.
 * 400 current-password-incorrect: shows commerce.changePassword.currentIncorrect message.
 *
 * @param props - Component props (see {@link ChangePasswordFormProps})
 */
export function ChangePasswordForm({ locale, accountEmail, returnUrl }: ChangePasswordFormProps) {
    const { t } = createTranslations(locale);

    const [fields, setFields] = useState<FormFields>(INITIAL_FIELDS);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [globalError, setGlobalError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // Holds the pending post-success redirect timer so it can be cancelled if
    // the component unmounts before it fires. Without this, an orphaned timer
    // runs `window.location.href` after teardown (crashes jsdom in tests, and
    // leaks a redirect if the user navigates away in the 1.5 s window).
    const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (redirectTimerRef.current !== null) {
                clearTimeout(redirectTimerRef.current);
            }
        };
    }, []);

    /** Translated strings every `PasswordField` on this form shares. */
    const passwordI18n: PasswordFieldI18n = {
        showPassword: t('commerce.changePassword.showPassword'),
        hidePassword: t('commerce.changePassword.hidePassword'),
        strength: {
            weak: t('commerce.changePassword.strength.weak'),
            medium: t('commerce.changePassword.strength.medium'),
            strong: t('commerce.changePassword.strength.strong')
        }
    };

    function handleFieldChange(name: keyof FormFields, value: string): void {
        setFields((prev) => ({ ...prev, [name]: value }));
        if (errors[name as keyof FieldErrors]) {
            setErrors((prev) => ({ ...prev, [name]: undefined }));
        }
        setGlobalError(null);
    }

    async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
        e.preventDefault();
        setGlobalError(null);
        setErrors({});

        // Required-field guard: the schema's `currentPassword` message is a raw
        // English literal ("Current password is required"), so surface a proper
        // localized message before the schema parse instead (HOS-190 BETA-190).
        if (!fields.currentPassword) {
            setErrors((prev) => ({
                ...prev,
                currentPassword: t('commerce.changePassword.currentRequired')
            }));
            return;
        }

        // Client-side mismatch check before hitting the API.
        if (fields.newPassword !== fields.confirmNewPassword) {
            setErrors((prev) => ({
                ...prev,
                confirmNewPassword: t(
                    'commerce.changePassword.mismatch',
                    'Las contraseñas no coinciden.'
                )
            }));
            return;
        }

        // Validate via schema (enforces strong-password rules on newPassword,
        // requires currentPassword to be non-empty).
        const parsed = ChangePasswordInputSchema.safeParse({
            currentPassword: fields.currentPassword,
            newPassword: fields.newPassword
        });

        if (!parsed.success) {
            // Resolve each Zod `zodError.*` key through `t` (via the shared
            // mapper) so `errors.newPassword` shows human Spanish instead of the
            // raw `zodError.common.password.*` key (HOS-190 BETA-190).
            setErrors(zodIssuesToFieldErrors(parsed.error.issues, t));
            return;
        }

        setIsSubmitting(true);

        try {
            const res = await fetch(`${API_BASE}/api/v1/protected/auth/change-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(parsed.data)
            });

            if (!res.ok) {
                // 400 with PASSWORD_INCORRECT code → current password is wrong.
                const body = (await res.json().catch(() => ({}))) as {
                    error?: { code?: string; message?: string };
                };
                const code = body.error?.code ?? '';
                if (res.status === 400 && code === 'PASSWORD_INCORRECT') {
                    setErrors((prev) => ({
                        ...prev,
                        currentPassword: t(
                            'commerce.changePassword.currentIncorrect',
                            'La contraseña actual es incorrecta.'
                        )
                    }));
                    return;
                }
                throw new Error(
                    body.error?.message ??
                        t(
                            'commerce.changePassword.error',
                            'Ocurrió un error al actualizar la contraseña. Por favor, intentá de nuevo.'
                        )
                );
            }

            // Refresh the Better Auth cookie cache BEFORE redirecting so the
            // middleware's must-change-password gate reads the now-cleared
            // `mustChangePassword` value instead of the stale cached `true`.
            // Without this, the redirect to /mi-cuenta/ bounces the user straight
            // back to this gate until the 5-minute cookie-cache TTL expires (or
            // they re-login). The endpoint already cleared the DB column.
            await refreshBetterAuthSession();

            // Show success banner first, then redirect to account page after 1.5 s.
            setIsSuccess(true);
            redirectTimerRef.current = setTimeout(() => {
                window.location.href = returnUrl;
            }, 1500);
        } catch (err: unknown) {
            const msg =
                err instanceof Error
                    ? err.message
                    : t(
                          'commerce.changePassword.error',
                          'Ocurrió un error al actualizar la contraseña. Por favor, intentá de nuevo.'
                      );
            setGlobalError(msg);
        } finally {
            setIsSubmitting(false);
        }
    }

    // ── Success state ─────────────────────────────────────────────────────────

    if (isSuccess) {
        return (
            <div
                className={`${styles.feedbackBanner} ${styles.feedbackBannerSuccess}`}
                role="alert"
                aria-live="assertive"
            >
                {t(
                    'commerce.changePassword.success',
                    'Contraseña actualizada correctamente. Redirigiendo...'
                )}
            </div>
        );
    }

    return (
        <div className={styles.wrapper}>
            <div className={styles.header}>
                <h1 className={styles.heading}>
                    {t('commerce.changePassword.title', 'Cambiar contraseña')}
                </h1>
                <p className={styles.subtitle}>
                    {t(
                        'commerce.changePassword.subtitle',
                        'Por seguridad, necesitás actualizar tu contraseña antes de continuar.'
                    )}
                </p>
                {/*
                 * HOS-752: names the account. Not decoration — this is the only
                 * thing on screen that distinguishes "activating the account
                 * from the email I just opened" from "changing the password of
                 * the session already signed in on this browser".
                 */}
                <p
                    className={styles.accountNotice}
                    data-testid="change-password-account-notice"
                >
                    {t('commerce.changePassword.accountNotice')}{' '}
                    <span className={styles.accountNoticeEmail}>{accountEmail}</span>
                </p>
            </div>

            <div className={styles.card}>
                <form
                    className={styles.form}
                    onSubmit={(e) => void handleSubmit(e)}
                    noValidate
                >
                    {/* Current password */}
                    <PasswordField
                        id="cpf-currentPassword"
                        name="currentPassword"
                        label={t(
                            'commerce.changePassword.fields.currentPassword',
                            'Contraseña actual'
                        )}
                        value={fields.currentPassword}
                        onChange={(value) => handleFieldChange('currentPassword', value)}
                        autoComplete="current-password"
                        required
                        disabled={isSubmitting}
                        error={errors.currentPassword}
                        i18n={passwordI18n}
                    />

                    {/* New password */}
                    <PasswordField
                        id="cpf-newPassword"
                        name="newPassword"
                        label={t('commerce.changePassword.fields.newPassword', 'Nueva contraseña')}
                        value={fields.newPassword}
                        onChange={(value) => handleFieldChange('newPassword', value)}
                        autoComplete="new-password"
                        required
                        disabled={isSubmitting}
                        error={errors.newPassword}
                        showStrength
                        i18n={passwordI18n}
                    />

                    {/* Confirm new password */}
                    <PasswordField
                        id="cpf-confirmNewPassword"
                        name="confirmNewPassword"
                        label={t(
                            'commerce.changePassword.fields.confirmNewPassword',
                            'Confirmá la nueva contraseña'
                        )}
                        value={fields.confirmNewPassword}
                        onChange={(value) => handleFieldChange('confirmNewPassword', value)}
                        autoComplete="new-password"
                        required
                        disabled={isSubmitting}
                        error={errors.confirmNewPassword}
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

                    <div className={styles.actionRow}>
                        <button
                            type="submit"
                            className={styles.submitBtn}
                            disabled={isSubmitting}
                            aria-busy={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <span
                                        className={styles.spinner}
                                        aria-hidden="true"
                                    />
                                    {t('commerce.changePassword.submitting', 'Guardando...')}
                                </>
                            ) : (
                                t('commerce.changePassword.submit', 'Cambiar contraseña')
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
