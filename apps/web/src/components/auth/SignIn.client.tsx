/**
 * @file SignIn.client.tsx
 * @description Sign-in password form React island for web.
 *
 * Standalone component — no dependency on @repo/auth-ui.
 * Calls auth-client.ts directly, styled with CSS Modules + web design tokens.
 * Server-renders the real form so the sign-in surface exists before hydration.
 *
 * HOS-959: the OAuth block (Google/Facebook buttons, `handleOauth`, the
 * SPEC-120 error banner, and the query-param cleanup effect) moved OUT of
 * this component and into `AuthTabs.client.tsx`, which now owns the single
 * shared copy — signing in with Google IS signing up with Google, so that
 * block sits above the tabs, not inside this form. This component keeps only
 * the password-credential path. The `email` field is now a controlled value
 * owned by `AuthTabs` (so it survives a tab switch) instead of local state.
 */

import { useState } from 'react';
import { GradientButton } from '@/components/ui/GradientButtonReact';
import { PasswordField, type PasswordFieldI18n } from '@/components/ui/PasswordField.client';
import { translateApiError } from '@/lib/api-errors';
import { signIn } from '@/lib/auth-client';
import { EmailFormatSchema } from '@/lib/forms/email-format';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { resolvePostAuthRedirectUrl } from '@/lib/post-auth-redirect';
import styles from './SignIn.module.css';

/** Props for the SignIn component. */
export interface SignInProps {
    /** Active locale — used for translations. */
    readonly locale: SupportedLocale;
    /** URL to redirect to after a successful sign-in. */
    readonly redirectTo: string;
    /**
     * Marks `redirectTo` as a server-validated EXTERNAL URL (SPEC-182): a
     * cross-app `callbackUrl` (e.g. the admin panel) that already passed the
     * server-side allowlist in `signin.astro`. When true, the island uses
     * `redirectTo` verbatim — the host-strip+reattach workaround below would
     * otherwise rewrite the admin origin onto the web origin and silently
     * break the web→admin hand-off. Defaults to false (same-app redirects).
     */
    readonly externalRedirect?: boolean;
    /** Current email value — owned by `AuthTabs` so it survives a tab switch. */
    readonly email: string;
    /** Called with the new value on every keystroke in the email field. */
    readonly onEmailChange: (value: string) => void;
}

/**
 * Sign-in form with email + password.
 *
 * Handles its own password/loading/error state; the `email` value itself is
 * controlled by the parent (`AuthTabs`) so it survives a tab switch to
 * sign-up. Redirects via `window.location.replace` after success.
 *
 * @example
 * ```tsx
 * <SignIn locale={locale} redirectTo="/es/mi-cuenta/" email={email} onEmailChange={setEmail} />
 * ```
 */
export function SignIn({
    locale,
    redirectTo,
    externalRedirect = false,
    email,
    onEmailChange
}: SignInProps) {
    const { t } = createTranslations(locale);

    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * i18n strings for the shared `PasswordField`. Sign-in only uses the
     * show/hide toggle — the strength bar is off, since measuring the
     * strength of a password the account already has helps nobody.
     */
    const passwordI18n: PasswordFieldI18n = {
        showPassword: t('auth.signIn.showPassword', 'Mostrar contraseña'),
        hidePassword: t('auth.signIn.hidePassword', 'Ocultar contraseña'),
        strength: {
            weak: t('auth.signIn.strength.weak', 'Débil'),
            medium: t('auth.signIn.strength.medium', 'Media'),
            strong: t('auth.signIn.strength.strong', 'Fuerte')
        }
    };

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
        e.preventDefault();
        setError(null);

        // HOS-190 slice 3: `required`/`type="email"` are decorative under
        // `noValidate` — enforce presence + format for real before calling
        // Better Auth, instead of letting any string through.
        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
            setError(t('auth.signIn.errors.emailRequired', 'Ingresá tu correo electrónico.'));
            return;
        }
        if (!EmailFormatSchema.safeParse(trimmedEmail).success) {
            setError(t('auth.signIn.errors.emailInvalid', 'Ingresá un correo electrónico válido.'));
            return;
        }

        setIsLoading(true);

        try {
            const result = await signIn.email({ email: trimmedEmail, password });

            if (result.error) {
                setError(
                    translateApiError({
                        error: result.error,
                        t,
                        fallback: t('auth.signIn.error', 'Error al iniciar sesión')
                    })
                );
            } else {
                // SPEC-182: when externalRedirect, redirectTo is a
                // server-allowlisted absolute URL (e.g. the admin panel) and
                // is used verbatim — the host-strip+reattach workaround below
                // would otherwise rewrite it onto the web origin and break
                // the cross-app hand-off. Otherwise, mirror the OAuth
                // host-strip+re-attach in AuthTabs (see
                // resolvePostAuthRedirectUrl for why: a reverse-proxy bug
                // that can hand back `https://localhost`).
                window.location.replace(
                    resolvePostAuthRedirectUrl({
                        target: redirectTo,
                        currentOrigin: window.location.origin,
                        externalRedirect
                    })
                );
            }
        } catch {
            setError(t('auth.signIn.error', 'Error al iniciar sesión'));
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <form
            className={styles.form}
            onSubmit={handleSubmit}
            noValidate
            aria-label={t('auth.signIn.submit', 'Iniciar sesión')}
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
                    htmlFor="signin-email"
                    className={styles.label}
                >
                    {t('auth.signIn.email', 'Correo electrónico')}
                    {/*
                        The input has always carried `required` +
                        `aria-required`, so assistive tech was already told;
                        the VISIBLE marker was the only thing missing. Without
                        it this was the one mandatory field on either tab that
                        did not look mandatory — the password below it renders
                        its own asterisk via `PasswordField`, and every field
                        on the sign-up tab already had one (HOS-821), so it
                        read as if e-mail were optional to sign in.

                        Same span, class and `aria-hidden` as HOS-821 used on
                        the sign-up label: hidden from the a11y tree precisely
                        because `aria-required` already announces it, and
                        saying it twice is worse than not at all.
                    */}
                    <span
                        className={styles.required}
                        aria-hidden="true"
                    >
                        {' *'}
                    </span>
                </label>
                <input
                    id="signin-email"
                    type="email"
                    className={styles.input}
                    value={email}
                    onChange={(e) => onEmailChange(e.target.value)}
                    placeholder={t('auth.signIn.emailPlaceholder', 'tu@email.com')}
                    required
                    autoComplete="email"
                    aria-required="true"
                    disabled={isLoading}
                />
            </div>

            <PasswordField
                id="signin-password"
                name="password"
                label={t('auth.signIn.password', 'Contraseña')}
                value={password}
                onChange={setPassword}
                placeholder={t('auth.signIn.passwordPlaceholder', 'Tu contraseña')}
                autoComplete="current-password"
                required
                disabled={isLoading}
                i18n={passwordI18n}
            />

            <GradientButton
                as="button"
                type="submit"
                variant="accent"
                size="md"
                shape="rounded"
                label={
                    isLoading
                        ? t('auth.signIn.loading', 'Ingresando...')
                        : t('auth.signIn.submit', 'Iniciar sesión')
                }
                disabled={isLoading}
                aria={{ busy: isLoading }}
                className={styles.submitButton}
            />
        </form>
    );
}
