/**
 * @file SignIn.client.tsx
 * @description Sign-in form React island for web2.
 *
 * Standalone component — no dependency on @repo/auth-ui.
 * Calls auth-client.ts directly, styled with CSS Modules + web2 design tokens.
 * Shows a skeleton while hydrating to prevent layout shift.
 */

import { GradientButton } from '@/components/ui/GradientButtonReact';
import { translateApiError } from '@/lib/api-errors';
import { signIn } from '@/lib/auth-client';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useEffect, useState } from 'react';
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
    /** Whether to show OAuth provider buttons. Defaults to true. */
    readonly showOAuth?: boolean;
    /**
     * Signal from the page that the previous OAuth round-trip failed.
     *
     * Populated by `signin.astro` from the `?error=...&provider=...` query
     * string Better Auth + the API wrapper put on the redirect. When set,
     * the island renders a localized banner via the existing `error` state
     * and writes the raw provider description to `console.warn` for local
     * debugging. The query string is then stripped via `history.replaceState`
     * so a page reload does not re-show the banner.
     *
     * @see SPEC-120
     */
    readonly initialOAuthError?: {
        readonly code: string;
        readonly description?: string;
        readonly provider?: string;
    };
}

/**
 * Human-readable label for an OAuth provider id.
 *
 * Provider brand names are the same in every locale, so we don't route them
 * through i18n. Falls back to an empty string when the provider is missing —
 * the i18n strings under `auth-ui.signIn.errors.oauth.*` still read fine
 * because `{{provider}}` interpolates to nothing in that case.
 */
function providerLabel(provider: string | undefined): string {
    if (!provider) return '';
    if (provider === 'google') return 'Google';
    if (provider === 'facebook') return 'Facebook';
    return provider.charAt(0).toUpperCase() + provider.slice(1);
}

/**
 * Sign-in form with email/password and optional OAuth providers.
 *
 * Handles its own loading, error, and hydration-skeleton states.
 * Redirects via `window.location.replace` after success.
 *
 * @example
 * ```astro
 * <SignIn client:load locale={locale} redirectTo="/es/mi-cuenta/" showOAuth={true} />
 * ```
 */
export function SignIn({
    locale,
    redirectTo,
    externalRedirect = false,
    showOAuth = true,
    initialOAuthError
}: SignInProps) {
    const { t } = createTranslations(locale);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [oauthLoading, setOauthLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isClientReady, setIsClientReady] = useState(false);

    useEffect(() => {
        setIsClientReady(true);
    }, []);

    // SPEC-120: hydrate OAuth banner from SSR-supplied initialOAuthError and
    // sanitize the URL so the banner does not survive a reload. Runs once.
    // biome-ignore lint/correctness/useExhaustiveDependencies: SSR-stable values, mount-only effect
    useEffect(() => {
        if (initialOAuthError) {
            const { code, description, provider } = initialOAuthError;
            const providerName = providerLabel(provider);

            // Try the specific code key first; fall back to the generic
            // `unknown` key when the specific one is missing from the
            // catalog. The fallback covers future or provider-specific codes
            // we have not yet enumerated.
            const specificKey = `auth-ui.signIn.errors.oauth.${code}`;
            const candidate = t(specificKey, undefined, { provider: providerName });
            const isMissing = candidate.startsWith('[MISSING:') || candidate === specificKey;
            const message = isMissing
                ? t('auth-ui.signIn.errors.oauth.unknown', undefined, {
                      provider: providerName
                  })
                : candidate;

            setError(message);

            // error_description is provider-supplied free-form text (varies
            // between providers, never i18n-translated). Surface it to the
            // local browser dev console for debugging without contaminating
            // the UI.
            console.warn(`[OAuth] ${code}:`, description ?? '(no description)');
        }

        // Always strip OAuth-related query params and any trailing hash.
        // Facebook appends `#_=_` to all its OAuth redirects (legacy bug);
        // a naive `?...` strip would leave that dangling.
        if (typeof window === 'undefined') return;
        const url = new URL(window.location.href);
        let modified = false;
        for (const key of ['error', 'error_description', 'provider']) {
            if (url.searchParams.has(key)) {
                url.searchParams.delete(key);
                modified = true;
            }
        }
        if (url.hash) {
            url.hash = '';
            modified = true;
        }
        if (modified) {
            window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        }
    }, []);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            const result = await signIn.email({ email, password });

            if (result.error) {
                setError(
                    translateApiError({
                        error: result.error,
                        t,
                        fallback: t('auth.signIn.error', 'Error al iniciar sesión')
                    })
                );
            } else if (externalRedirect) {
                // SPEC-182: redirectTo is a server-allowlisted absolute URL
                // (e.g. the admin panel). The host-strip below would rewrite
                // it onto the web origin and break the cross-app hand-off —
                // use it verbatim.
                window.location.replace(redirectTo);
            } else {
                // Mirror the OAuth host-strip+re-attach below. The
                // server-built `redirectTo` can carry `https://localhost`
                // when Astro Node runs behind a reverse proxy that does
                // not forward the original Host header — and the browser
                // then can't navigate to that URL. Strip the host (if
                // any) and reattach the browser's real origin.
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
                window.location.replace(`${origin}${path}`);
            }
        } catch {
            setError(t('auth.signIn.error', 'Error al iniciar sesión'));
        } finally {
            setIsLoading(false);
        }
    }

    async function handleOauth(provider: 'google' | 'facebook'): Promise<void> {
        setError(null);
        setOauthLoading(provider);

        try {
            // Build the absolute callbackURL on the client and anchor it on
            // the browser's real origin. The `redirectTo` prop is computed
            // server-side in signin.astro; when the web app runs Astro Node
            // behind Traefik, `Astro.url.origin` can resolve to
            // 'https://localhost' because the reverse proxy doesn't always
            // forward the original Host header. Any absolute URL built on
            // top of that gets rejected by Better Auth as
            // INVALID_CALLBACKURL. We strip the host (if any) from
            // redirectTo and reattach the browser's origin so the resulting
            // URL matches whatever host the user opened (staging.* in
            // pre-launch, hospeda.com.ar post-launch, etc.).
            const origin = window.location.origin;
            let callbackURL: string;
            if (externalRedirect) {
                // SPEC-182: server-allowlisted cross-app callbackUrl (e.g. the
                // admin panel). Better Auth validates it against its
                // trustedOrigins (the admin URL is trusted), so it can be used
                // verbatim — stripping it onto the web origin would break the
                // post-OAuth hand-off.
                callbackURL = redirectTo;
            } else {
                const rawTarget = redirectTo || window.location.pathname || '/';
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
                callbackURL = `${origin}${path}`;
            }
            const errorCallbackURL = `${origin}${window.location.pathname || '/'}`;
            await signIn.social({ provider, callbackURL, errorCallbackURL });
        } catch (err) {
            // Surface the actual Better Auth error to console so the
            // operator can distinguish INVALID_CALLBACKURL vs
            // account_not_linked vs network errors. Without this,
            // every OAuth failure looks identical to "user cancelled".
            console.error(`OAuth ${provider} sign-in failed`, err);
            setError(t('auth.signIn.error', 'Error al iniciar sesión'));
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
                </label>
                <input
                    id="signin-email"
                    type="email"
                    className={styles.input}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('auth.signIn.emailPlaceholder', 'tu@email.com')}
                    required
                    autoComplete="email"
                    aria-required="true"
                    disabled={isLoading}
                />
            </div>

            <div className={styles.field}>
                <label
                    htmlFor="signin-password"
                    className={styles.label}
                >
                    {t('auth.signIn.password', 'Contraseña')}
                </label>
                <input
                    id="signin-password"
                    type="password"
                    className={styles.input}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('auth.signIn.passwordPlaceholder', 'Tu contraseña')}
                    required
                    autoComplete="current-password"
                    aria-required="true"
                    disabled={isLoading}
                />
            </div>

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

            {showOAuth && (
                <>
                    <div
                        className={styles.divider}
                        aria-hidden="true"
                    >
                        <span className={styles.dividerLine} />
                        <span>{t('auth.signIn.or', 'o')}</span>
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
                        {t('auth.signIn.withGoogle', 'Continuar con Google')}
                    </button>

                    <button
                        type="button"
                        className={styles.oauthButton}
                        onClick={() => handleOauth('facebook')}
                        disabled={oauthLoading !== null}
                        aria-busy={oauthLoading === 'facebook'}
                    >
                        <FacebookIcon />
                        {t('auth.signIn.withFacebook', 'Continuar con Facebook')}
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
