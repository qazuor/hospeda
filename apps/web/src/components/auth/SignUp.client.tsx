/**
 * @file SignUp.client.tsx
 * @description Sign-up form React island for web2.
 *
 * Standalone component — no dependency on @repo/auth-ui.
 * Calls auth-client.ts directly, styled with CSS Modules + web2 design tokens.
 * Validates password length client-side before submitting.
 *
 * The `name` field has been intentionally removed (SPEC-113). Name collection
 * happens in the post-signup profile completion form, where users provide
 * structured firstName + lastName instead of a single free-text name.
 */

import { GradientButton } from '@/components/ui/GradientButtonReact';
import { PasswordField, type PasswordFieldI18n } from '@/components/ui/PasswordField.client';
import { WebEvents } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/posthog-client';
import { signIn, signUp } from '@/lib/auth-client';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { StrongPasswordRegex } from '@repo/schemas';
import { useEffect, useState } from 'react';
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
     * Optional URL to redirect to after a successful OAuth sign-up.
     * OAuth providers (Google, Facebook) verify the email themselves,
     * so the user is already authenticated and should land on the
     * account dashboard, NOT the "check your inbox" page that the
     * email path uses. Defaults to {@link redirectTo} for backwards
     * compatibility, but pages should override this with the dashboard
     * path to give OAuth users the correct landing experience.
     */
    readonly oauthRedirectTo?: string;
    /** Whether to show OAuth provider buttons. Defaults to true. */
    readonly showOAuth?: boolean;
}

/**
 * Sign-up form with email, password and optional OAuth providers.
 *
 * The `name` field is intentionally omitted — name is collected later in the
 * profile completion form (SPEC-113) as structured firstName + lastName.
 *
 * Validates password length (min 8 chars) before calling the API.
 * After a successful registration it redirects via `window.location.replace`.
 *
 * @example
 * ```astro
 * <SignUp client:load locale={locale} redirectTo="/es/mi-cuenta/" showOAuth={true} />
 * ```
 */
export function SignUp({ locale, redirectTo, oauthRedirectTo, showOAuth = true }: SignUpProps) {
    const { t } = createTranslations(locale);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [confirmError, setConfirmError] = useState<string | null>(null);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [oauthLoading, setOauthLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isClientReady, setIsClientReady] = useState(false);

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

    useEffect(() => {
        setIsClientReady(true);
    }, []);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
        e.preventDefault();
        setError(null);
        setPasswordError(null);
        setConfirmError(null);

        // Enforce the full strong-password contract client-side so the
        // user sees rule violations as inline field errors instead of
        // a back-end 400 with a vague generic message.
        if (!StrongPasswordRegex.test(password)) {
            setPasswordError(
                t(
                    'auth.signUp.errors.passwordWeak',
                    'La contraseña debe cumplir todas las reglas (8+ caracteres, mayúscula, minúscula, número y carácter especial).'
                )
            );
            return;
        }

        if (password !== confirmPassword) {
            setConfirmError(
                t('auth.signUp.errors.passwordsDoNotMatch', 'Las contraseñas no coinciden.')
            );
            return;
        }

        setIsLoading(true);

        try {
            // Sign up WITHOUT a `name` field — Better Auth's required `name`
            // is satisfied with an empty string here; the profile completion
            // form (SPEC-113) collects firstName + lastName and updates the
            // user's display_name afterwards.
            const result = await signUp.email({ email, password, name: '' });

            if (result.error) {
                setError(
                    result.error.message ?? t('auth.signUp.error', 'Error al crear la cuenta')
                );
            } else {
                // Mirror the OAuth host-strip+re-attach below. The
                // server-built `redirectTo` can carry `https://localhost`
                // when Astro Node runs behind a reverse proxy that does
                // not forward the original Host header (observed
                // 2026-05-14 during SPEC-103 T-012 smoke: POST /sign-up
                // returned 200 but the subsequent navigation went to
                // https://localhost/es/auth/verify-email-sent and
                // failed). Strip the host (if any) and reattach the
                // browser's real origin so the navigation always lands
                // on whatever host the user opened.
                const origin = window.location.origin;
                let path = redirectTo || '/';
                if (path.startsWith('http')) {
                    try {
                        const parsed = new URL(path);
                        path = `${parsed.pathname}${parsed.search}${parsed.hash}` || '/';
                    } catch {
                        path = '/';
                    }
                }
                if (!path.startsWith('/')) {
                    path = `/${path}`;
                }
                trackEvent(WebEvents.SignupCompleted, { provider: 'email', locale });
                window.location.replace(`${origin}${path}`);
            }
        } catch {
            setError(t('auth.signUp.error', 'Error al crear la cuenta'));
        } finally {
            setIsLoading(false);
        }
    }

    async function handleOauth(provider: 'google' | 'facebook'): Promise<void> {
        setError(null);
        setOauthLoading(provider);

        try {
            // Build the absolute callbackURL on the client so the host
            // matches the browser's real origin. The server-built
            // redirectTo can carry 'https://localhost' when Astro Node
            // runs behind a reverse proxy that doesn't forward the
            // original Host header — and Better Auth rejects any
            // callbackURL whose origin isn't in trustedOrigins. Strip
            // the host (if any) and reattach window.location.origin.
            //
            // For OAuth, prefer `oauthRedirectTo` over `redirectTo`:
            // OAuth providers verify the email themselves, so the
            // user is already authenticated and should land on the
            // account dashboard, NOT the "check your inbox" page that
            // the email signup path uses (`verify-email-sent`).
            const origin = window.location.origin;
            const rawTarget = oauthRedirectTo ?? redirectTo ?? window.location.pathname ?? '/';
            let path = rawTarget;
            if (path.startsWith('http')) {
                try {
                    const parsed = new URL(path);
                    path = `${parsed.pathname}${parsed.search}${parsed.hash}` || '/';
                } catch {
                    path = '/';
                }
            }
            if (!path.startsWith('/')) {
                path = `/${path}`;
            }
            const callbackURL = `${origin}${path}`;
            const errorCallbackURL = `${origin}${window.location.pathname || '/'}`;
            await signIn.social({ provider, callbackURL, errorCallbackURL });
        } catch (err) {
            // Surface the actual Better Auth error to console so the
            // operator can distinguish INVALID_CALLBACKURL vs
            // account_not_linked vs network errors. Without this,
            // every OAuth failure looks identical to "user cancelled".
            console.error(`OAuth ${provider} sign-up failed`, err);
            setError(t('auth.signUp.error', 'Error al crear la cuenta'));
            setOauthLoading(null);
        }
    }

    if (!isClientReady) {
        return (
            <div
                className={styles.skeleton}
                aria-busy="true"
                aria-label={t('auth-ui.loading', 'Loading form')}
            >
                <div className={cn(styles.skeletonLine, styles.skeletonTitle)} />
                <div className={styles.skeletonField} />
                <div className={styles.skeletonField} />
                <div className={styles.skeletonButton} />
            </div>
        );
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
                </label>
                <input
                    id="signup-email"
                    type="email"
                    className={styles.input}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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

            {showOAuth && (
                <>
                    <div
                        className={styles.divider}
                        aria-hidden="true"
                    >
                        <span className={styles.dividerLine} />
                        <span>{t('auth.signUp.or', 'o')}</span>
                        <span className={styles.dividerLine} />
                    </div>

                    <button
                        type="button"
                        className={styles.oauthButton}
                        onClick={() => handleOauth('google')}
                        disabled={oauthLoading !== null}
                        aria-busy={oauthLoading === 'google'}
                    >
                        <GoogleIcon />
                        {t('auth.signUp.withGoogle', 'Continuar con Google')}
                    </button>

                    <button
                        type="button"
                        className={styles.oauthButton}
                        onClick={() => handleOauth('facebook')}
                        disabled={oauthLoading !== null}
                        aria-busy={oauthLoading === 'facebook'}
                    >
                        <FacebookIcon />
                        {t('auth.signUp.withFacebook', 'Continuar con Facebook')}
                    </button>
                </>
            )}
        </form>
    );
}

function GoogleIcon() {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            aria-hidden="true"
            focusable="false"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                fill="#4285F4"
            />
            <path
                d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
                fill="#34A853"
            />
            <path
                d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                fill="#FBBC05"
            />
            <path
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                fill="#EA4335"
            />
        </svg>
    );
}

function FacebookIcon() {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
            xmlns="http://www.w3.org/2000/svg"
            fill="#1877F2"
        >
            <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.024 4.388 11.018 10.125 11.927v-8.437H7.078v-3.49h3.047V9.413c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.266h3.328l-.532 3.49h-2.796v8.437C19.612 23.091 24 18.097 24 12.073z" />
        </svg>
    );
}
