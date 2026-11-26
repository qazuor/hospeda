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
import { useState } from 'react';
import { z } from 'zod';
import { GradientButton } from '@/components/ui/GradientButtonReact';
import { PasswordField, type PasswordFieldI18n } from '@/components/ui/PasswordField.client';
import { trackEvent } from '@/lib/analytics/umami-client';
import { translateApiError } from '@/lib/api-errors';
import { signUp } from '@/lib/auth-client';
import { authEmailSchema, signupPasswordSchema } from '@/lib/forms/auth-form-schemas';
import { useZodForm } from '@/lib/forms/use-zod-form';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { resolvePostAuthRedirectUrl } from '@/lib/post-auth-redirect';
import { buildUrl } from '@/lib/urls';
import { saveVerificationDelivery } from '@/lib/verification-delivery';
import { AuthEmailField } from './AuthEmailField';
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
    /**
     * Absolute URL the verification link should land on once the email is
     * confirmed. Handed to Better Auth as `callbackURL`, which is what carries
     * the caller's destination across the inbox hop (HOS-838).
     */
    readonly verificationCallbackUrl: string;
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
export function SignUp({
    locale,
    redirectTo,
    verificationCallbackUrl,
    email,
    onEmailChange
}: SignUpProps) {
    const { t } = createTranslations(locale);

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const {
        fieldErrors,
        formError: error,
        setFormError: setError,
        validate,
        clearError
    } = useZodForm({
        schema: z
            .object({
                email: authEmailSchema({
                    required: t('auth.signUp.errors.emailRequired'),
                    invalid: t('auth.signUp.errors.emailInvalid')
                }),
                password: signupPasswordSchema({
                    weak: t('auth.signUp.errors.passwordWeak'),
                    tooLong: t('auth.signUp.errors.passwordMax')
                }),
                'confirm-password': z.string()
            })
            .refine(
                (values) =>
                    values['confirm-password'] && values.password === values['confirm-password'],
                {
                    path: ['confirm-password'],
                    message: t('auth.signUp.errors.passwordsDoNotMatch')
                }
            ),
        fieldIdPrefix: 'signup',
        validationToast: false
    });

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
            special: t(
                'auth.signUp.rules.special',
                'Un carácter especial (por ejemplo ! @ # $ - _)'
            )
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
        const parsed = validate({ email, password, 'confirm-password': confirmPassword });
        if (!parsed.success) return;

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
            // `callbackURL` is what Better Auth stamps into the verification
            // link, so it is the only channel by which the destination reaches
            // a person who opens the email on a different device (HOS-838).
            const result = await signUp.email({
                email: parsed.data.email,
                password,
                name: '',
                callbackURL: verificationCallbackUrl
            });

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
                saveVerificationDelivery({
                    email: parsed.data.email,
                    callbackURL: verificationCallbackUrl
                });
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

            <AuthEmailField
                prefix="signup"
                label={t('auth.signUp.email')}
                value={email}
                onChange={(value) => {
                    onEmailChange(value);
                    clearError('email');
                }}
                placeholder={t('auth.signUp.emailPlaceholder')}
                disabled={isLoading}
                error={fieldErrors.email}
            />

            <PasswordField
                id="signup-password"
                label={t('auth.signUp.password', 'Contraseña')}
                value={password}
                onChange={(value) => {
                    setPassword(value);
                    clearError('password');
                    clearError('confirm-password');
                }}
                placeholder={t('auth.signUp.passwordPlaceholder', 'Tu contraseña')}
                autoComplete="new-password"
                required
                disabled={isLoading}
                showStrength
                showRuleChecklist
                hint={t('auth.signUp.passwordHint')}
                error={fieldErrors.password}
                i18n={passwordI18n}
            />

            <PasswordField
                id="signup-confirm-password"
                label={t('auth.signUp.confirmPassword', 'Confirmar contraseña')}
                value={confirmPassword}
                onChange={(value) => {
                    setConfirmPassword(value);
                    clearError('confirm-password');
                }}
                placeholder={t('auth.signUp.confirmPasswordPlaceholder', 'Repetí tu contraseña')}
                autoComplete="new-password"
                required
                disabled={isLoading}
                error={fieldErrors['confirm-password']}
                i18n={confirmI18n}
            />

            <p className={styles.legal}>
                {t('auth.signUp.legalIntro')}{' '}
                <a href={buildUrl({ locale, path: 'legal/terminos' })}>
                    {t('auth.signUp.legalTerms')}
                </a>{' '}
                {t('auth.signUp.legalAnd')}{' '}
                <a href={buildUrl({ locale, path: 'legal/privacidad' })}>
                    {t('auth.signUp.legalPrivacy')}
                </a>
                .
            </p>
            <GradientButton
                as="button"
                type="submit"
                variant="accent"
                flat
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
