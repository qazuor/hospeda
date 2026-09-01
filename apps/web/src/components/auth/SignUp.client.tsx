/**
 * @file SignUp.client.tsx
 * @description Sign-up password form React island for web.
 *
 * Standalone component — no dependency on @repo/auth-ui.
 * Calls auth-client.ts directly, styled with CSS Modules + web design tokens.
 * Server-renders the real form so the sign-up surface exists before hydration.
 *
 * The `name` field has been intentionally removed (SPEC-113). Name collection
 * happens in the post-signup profile completion form, where users provide
 * structured firstName + lastName instead of a single free-text name.
 *
 * HOS-959: the OAuth block (Google/Facebook buttons, `handleOauth`, and the
 * icons) moved OUT of this component and into `AuthTabs.client.tsx`, which
 * now owns the single shared copy — signing up with Google IS signing in
 * with Google, so that block sits above the tabs, not inside this form. This
 * component keeps only the password-credential registration path. The
 * `email` field is now a controlled value owned by `AuthTabs` (so it
 * survives a tab switch) instead of local state.
 */

import { AnalyticsEvents } from '@repo/analytics';
import { StrongPasswordSchema } from '@repo/schemas';
import { useState } from 'react';
import { GradientButton } from '@/components/ui/GradientButtonReact';
import { PasswordField, type PasswordFieldI18n } from '@/components/ui/PasswordField.client';
import { trackEvent } from '@/lib/analytics/posthog-client';
import { translateApiError } from '@/lib/api-errors';
import { signUp } from '@/lib/auth-client';
import { EmailFormatSchema } from '@/lib/forms/email-format';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { resolvePostAuthRedirectUrl } from '@/lib/post-auth-redirect';
import styles from './SignUp.module.css';

/** Props for the SignUp component. */
export interface SignUpProps {
    /** Active locale — used for translations. */
    readonly locale: SupportedLocale;
    /**
     * URL to redirect to after a successful EMAIL sign-up. Email
     * sign-up requires verification, so this typically points at
     * `/auth/verify-email-sent/`.
     */
    readonly redirectTo: string;
    /** Current email value — owned by `AuthTabs` so it survives a tab switch. */
    readonly email: string;
    /** Called with the new value on every keystroke in the email field. */
    readonly onEmailChange: (value: string) => void;
}

/**
 * Sign-up form with email + password.
 *
 * The `name` field is intentionally omitted — name is collected later in the
 * profile completion form (SPEC-113) as structured firstName + lastName.
 *
 * Validates password length (min 8 chars) before calling the API.
 * After a successful registration it redirects via `window.location.replace`.
 * The `email` value itself is controlled by the parent (`AuthTabs`) so it
 * survives a tab switch to sign-in.
 *
 * @example
 * ```tsx
 * <SignUp locale={locale} redirectTo="/es/auth/verify-email-sent/" email={email} onEmailChange={setEmail} />
 * ```
 */
export function SignUp({ locale, redirectTo, email, onEmailChange }: SignUpProps) {
    const { t } = createTranslations(locale);

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [confirmError, setConfirmError] = useState<string | null>(null);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * i18n strings for the PasswordField component. Built from the same
     * `t()` helper so the keys stay consistent with the rest of the form.
     */
    const passwordI18n: PasswordFieldI18n = {
        showPassword: t('auth.signUp.showPassword', 'Mostrar contraseña'),
        hidePassword: t('auth.signUp.hidePassword', 'Ocultar contraseña'),
        strength: {
            weak: t('auth.signUp.strength.weak', 'Débil'),
            medium: t('auth.signUp.strength.medium', 'Media'),
            strong: t('auth.signUp.strength.strong', 'Fuerte')
        },
        rules: {
            length: t('auth.signUp.rules.length', 'Al menos 8 caracteres'),
            upper: t('auth.signUp.rules.upper', 'Una letra mayúscula (A-Z)'),
            lower: t('auth.signUp.rules.lower', 'Una letra minúscula (a-z)'),
            digit: t('auth.signUp.rules.digit', 'Un número (0-9)'),
            special: t('auth.signUp.rules.special', 'Un carácter especial (@$!%*?&)')
        }
    };

    /** Confirm field reuses the visibility toggle but skips the rules block. */
    const confirmI18n: PasswordFieldI18n = {
        showPassword: passwordI18n.showPassword,
        hidePassword: passwordI18n.hidePassword,
        strength: passwordI18n.strength
    };

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
        e.preventDefault();
        setError(null);
        setPasswordError(null);
        setConfirmError(null);

        // HOS-190 slice 3: `required`/`type="email"` are decorative under
        // `noValidate` — enforce presence + format for real before submitting.
        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
            setError(t('auth.signUp.errors.emailRequired', 'Ingresá tu correo electrónico.'));
            return;
        }
        if (!EmailFormatSchema.safeParse(trimmedEmail).success) {
            setError(t('auth.signUp.errors.emailInvalid', 'Ingresá un correo electrónico válido.'));
            return;
        }

        // Unified with SetPassword/ResetPassword (HOS-190 slice 3): validate
        // against the shared StrongPasswordSchema (min 8, max 128, upper/
        // lower/digit/special) instead of the regex directly, so bounds and
        // messaging stay consistent across every password-setting form. This
        // does NOT change the complexity policy itself (still upper/lower/
        // digit/special) — only adds the missing 128-char cap.
        const passwordResult = StrongPasswordSchema.safeParse(password);
        if (!passwordResult.success) {
            const issue = passwordResult.error.issues[0];
            if (issue?.code === 'too_big') {
                // NOTE (HOS-190 i18n gap): no dedicated i18n key exists yet
                // for this case — the fallback below is shown for every
                // locale until `auth.signUp.errors.passwordMax` is added.
                setPasswordError(
                    t(
                        'auth.signUp.errors.passwordMax',
                        'La contraseña no puede superar los 128 caracteres.'
                    )
                );
            } else {
                setPasswordError(
                    t(
                        'auth.signUp.errors.passwordWeak',
                        'La contraseña debe cumplir todas las reglas (8+ caracteres, mayúscula, minúscula, número y carácter especial).'
                    )
                );
            }
            return;
        }

        if (password !== confirmPassword) {
            setConfirmError(
                t('auth.signUp.errors.passwordsDoNotMatch', 'Las contraseñas no coinciden.')
            );
            return;
        }

        setIsLoading(true);
        trackEvent(AnalyticsEvents.signUpStarted, {
            auth_method: 'email',
            locale,
            source_page: 'sign_up'
        });

        try {
            // Sign up WITHOUT a `name` field — Better Auth's required `name`
            // is satisfied with an empty string here; the profile completion
            // form (SPEC-113) collects firstName + lastName and updates the
            // user's display_name afterwards.
            const result = await signUp.email({ email: trimmedEmail, password, name: '' });

            if (result.error) {
                setError(
                    translateApiError({
                        error: result.error,
                        t,
                        fallback: t('auth.signUp.error', 'Error al crear la cuenta')
                    })
                );
            } else {
                // Mirror the OAuth host-strip+re-attach in AuthTabs (see
                // resolvePostAuthRedirectUrl for why: a reverse-proxy bug
                // that can hand back `https://localhost`, observed
                // 2026-05-14 during SPEC-103 T-012 smoke — POST /sign-up
                // returned 200 but the subsequent navigation went to
                // https://localhost/es/auth/verify-email-sent and failed).
                // NOTE: signup_completed is captured SERVER-SIDE in the Better
                // Auth `databaseHooks.user.create.after` hook (apps/api) so it
                // covers email AND OAuth signups uniformly and fires exactly once
                // per new user. Do NOT re-emit it here or it double-counts.
                window.location.replace(
                    resolvePostAuthRedirectUrl({
                        target: redirectTo,
                        currentOrigin: window.location.origin
                    })
                );
            }
        } catch {
            setError(t('auth.signUp.error', 'Error al crear la cuenta'));
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <form
            className={styles.form}
            onSubmit={handleSubmit}
            noValidate
            aria-label={t('auth.signUp.submit', 'Crear cuenta')}
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
                    htmlFor="signup-email"
                    className={styles.label}
                >
                    {t('auth.signUp.email', 'Correo electrónico')}
                    {/*
                        HOS-821: the email input has always carried
                        `required` + `aria-required`, so assistive tech was
                        already told. The VISIBLE marker was the only thing
                        missing, which left the one mandatory field on the
                        sign-up form that did not look mandatory next to two
                        that did. Same span, same class and same
                        `aria-hidden` as `PasswordField` renders for the two
                        password labels below — hidden from the a11y tree
                        precisely because `aria-required` already says it, and
                        announcing it twice is worse than not at all.
                    */}
                    <span
                        className={styles.required}
                        aria-hidden="true"
                    >
                        {' *'}
                    </span>
                </label>
                <input
                    id="signup-email"
                    type="email"
                    className={styles.input}
                    value={email}
                    onChange={(e) => onEmailChange(e.target.value)}
                    placeholder={t('auth.signUp.emailPlaceholder', 'tu@email.com')}
                    required
                    autoComplete="email"
                    aria-required="true"
                    disabled={isLoading}
                />
            </div>

            <PasswordField
                id="signup-password"
                label={t('auth.signUp.password', 'Contraseña')}
                value={password}
                onChange={(value) => {
                    setPassword(value);
                    if (passwordError) setPasswordError(null);
                    if (confirmError) setConfirmError(null);
                }}
                placeholder={t('auth.signUp.passwordPlaceholder', 'Tu contraseña')}
                autoComplete="new-password"
                required
                disabled={isLoading}
                showStrength
                showRuleChecklist
                error={passwordError ?? undefined}
                i18n={passwordI18n}
            />

            <PasswordField
                id="signup-confirm-password"
                label={t('auth.signUp.confirmPassword', 'Confirmar contraseña')}
                value={confirmPassword}
                onChange={(value) => {
                    setConfirmPassword(value);
                    if (confirmError) setConfirmError(null);
                }}
                placeholder={t('auth.signUp.confirmPasswordPlaceholder', 'Repetí tu contraseña')}
                autoComplete="new-password"
                required
                disabled={isLoading}
                error={confirmError ?? undefined}
                i18n={confirmI18n}
            />

            <GradientButton
                as="button"
                type="submit"
                variant="accent"
                size="md"
                shape="rounded"
                label={
                    isLoading
                        ? t('auth.signUp.loading', 'Creando cuenta...')
                        : t('auth.signUp.submit', 'Crear cuenta')
                }
                disabled={isLoading}
                aria={{ busy: isLoading }}
                className={styles.submitButton}
            />
        </form>
    );
}
