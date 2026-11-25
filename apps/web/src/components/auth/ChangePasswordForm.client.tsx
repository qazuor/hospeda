/**
 * @file ChangePasswordForm.client.tsx
 * @description Change-password form React island (SPEC-239 T-055).
 *
 * Shown to venue/experience owners who were provisioned with a server-generated
 * password and must choose a personal one before using the platform.
 * Also accessible as a voluntary password change from the account section.
 *
 * Fields: currentPassword, newPassword, confirmNewPassword.
 * Validates that newPassword === confirmNewPassword client-side.
 * Submits to POST /api/v1/protected/auth/change-password with credentials.
 * On success shows a result state (a success alert and a «Continuar» link to
 * the resolved destination) and redirects there after 1.5 s.
 *
 * Extras: password-strength meter (weak / medium / strong heuristic),
 * show/hide toggle on all three inputs.
 *
 * Hydration: caller MUST use `client:load`.
 */

import { ChangePasswordInputSchema } from '@repo/schemas';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Alert, Button, LinkButton, PageHeader, Section } from '@/components/account/ui';
import { PasswordField, type PasswordFieldI18n } from '@/components/ui/PasswordField.client';
import { visibleApiMessage } from '@/lib/api-errors';
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
    /**
     * Whether the change is forced by the must-change-password gate (HOS-2431).
     * `true` (default) keeps the "before continuing" copy; `false` is a
     * voluntary visit and must not tell the user they are blocked.
     */
    readonly forced?: boolean;
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
 * 400 current-password-incorrect: shows account.changePassword.currentIncorrect message.
 *
 * @param props - Component props (see {@link ChangePasswordFormProps})
 */
export function ChangePasswordForm({
    locale,
    accountEmail,
    returnUrl,
    forced = true
}: ChangePasswordFormProps) {
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
        showPassword: t('account.changePassword.showPassword'),
        hidePassword: t('account.changePassword.hidePassword'),
        strength: {
            weak: t('account.changePassword.strength.weak'),
            medium: t('account.changePassword.strength.medium'),
            strong: t('account.changePassword.strength.strong')
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
                currentPassword: t('account.changePassword.currentRequired')
            }));
            return;
        }

        // Client-side mismatch check before hitting the API.
        if (fields.newPassword !== fields.confirmNewPassword) {
            setErrors((prev) => ({
                ...prev,
                confirmNewPassword: t(
                    'account.changePassword.mismatch',
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
                            'account.changePassword.currentIncorrect',
                            'La contraseña actual es incorrecta.'
                        )
                    }));
                    return;
                }
                throw new Error(
                    visibleApiMessage({ error: body.error, status: res.status }) ??
                        t(
                            'account.changePassword.error',
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
                          'account.changePassword.error',
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
            <div className={styles.page}>
                <PageHeader
                    title={t('account.changePassword.successTitle')}
                    locale={locale}
                />
                <Section
                    title={t('account.changePassword.successSection')}
                    helpId="section:account.change-password"
                >
                    <div className={styles.fields}>
                        <Alert
                            tone="success"
                            locale={locale}
                        >
                            {t(
                                'account.changePassword.success',
                                'Contraseña actualizada correctamente. Redirigiendo...'
                            )}
                        </Alert>
                        <div className={styles.actions}>
                            <LinkButton href={returnUrl}>
                                {t('account.changePassword.continue')}
                            </LinkButton>
                        </div>
                    </div>
                </Section>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            {/* The forced and the voluntary visit read differently (HOS-2431, AC-5): the
                forced one explains why the user cannot go on, the voluntary one offers a way back. */}
            <PageHeader
                title={t('account.changePassword.title', 'Cambiar contraseña')}
                description={forced ? undefined : t('account.changePassword.subtitleVoluntary')}
                actions={
                    forced ? undefined : (
                        <LinkButton
                            href={returnUrl}
                            variant="secondary"
                        >
                            {t('account.changePassword.back')}
                        </LinkButton>
                    )
                }
                locale={locale}
            />

            {forced ? (
                <Alert
                    tone="warning"
                    locale={locale}
                >
                    {t(
                        'account.changePassword.subtitle',
                        'Por seguridad, necesitás actualizar tu contraseña antes de continuar.'
                    )}
                </Alert>
            ) : null}

            <form
                onSubmit={(e) => void handleSubmit(e)}
                noValidate
            >
                <Section
                    title={t('account.changePassword.sectionTitle')}
                    description={
                        /*
                         * HOS-752: names the account. Not decoration — this is the only
                         * thing on screen that distinguishes "activating the account
                         * from the email I just opened" from "changing the password of
                         * the session already signed in on this browser".
                         */
                        <span data-testid="change-password-account-notice">
                            {t('account.changePassword.accountNotice')}{' '}
                            <strong>{accountEmail}</strong>
                        </span>
                    }
                    helpId="section:account.change-password"
                >
                    <div className={styles.fields}>
                        {/* Current password */}
                        <PasswordField
                            id="cpf-currentPassword"
                            name="currentPassword"
                            label={t(
                                'account.changePassword.fields.currentPassword',
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
                            label={t(
                                'account.changePassword.fields.newPassword',
                                'Nueva contraseña'
                            )}
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
                                'account.changePassword.fields.confirmNewPassword',
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
                        {globalError ? (
                            <Alert
                                tone="danger"
                                locale={locale}
                            >
                                {globalError}
                            </Alert>
                        ) : null}

                        <div className={styles.actions}>
                            <Button
                                type="submit"
                                loading={isSubmitting}
                                disabled={isSubmitting}
                            >
                                {isSubmitting
                                    ? t('account.changePassword.submitting', 'Guardando...')
                                    : t('account.changePassword.submit', 'Cambiar contraseña')}
                            </Button>
                        </div>
                    </div>
                </Section>
            </form>
        </div>
    );
}
