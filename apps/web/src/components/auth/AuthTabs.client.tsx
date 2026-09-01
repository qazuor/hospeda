/**
 * @file AuthTabs.client.tsx
 * @description Single React island backing BOTH `/auth/signin/` and
 * `/auth/signup/` (HOS-959). Owns the tab state, the shared `email` value,
 * and the OAuth block — the three things that used to live in two separate,
 * near-duplicate islands (`SignIn.client.tsx` / `SignUp.client.tsx`) bridged
 * only by a footer link nobody saw. `signin.astro` and `signup.astro` both
 * keep existing and both render this island, differing only in
 * `initialTab` and the per-tab redirect targets.
 *
 * Layout, top to bottom: an `<h1>` naming the active screen, the shared
 * OAuth block (Google/Facebook — signing in with Google IS signing up with
 * Google, so it has no tab), the ARIA tablist, then the active tab's
 * password form. Only the active tab's form is MOUNTED (conditional render,
 * not CSS hiding) — two simultaneously-mounted `autoComplete="email"` inputs
 * make browser autofill ambiguous.
 *
 * The typed `email` survives a tab switch because this component, not
 * `SignIn`/`SignUp`, owns that piece of state — the two child forms keep
 * everything else (password, per-form errors, loading) as their own local
 * state.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { signIn as authClientSignIn } from '@/lib/auth-client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildOAuthErrorCallbackUrl, resolvePostAuthRedirectUrl } from '@/lib/post-auth-redirect';
import { AuthOAuthButtons, type AuthOAuthProvider } from './AuthOAuthButtons.client';
import styles from './AuthTabs.module.css';
import { SignIn } from './SignIn.client';
import { SignUp } from './SignUp.client';

/** Which form is currently active/mounted. */
export type AuthTab = 'signin' | 'signup';

/** Sign-in-specific configuration passed down from `signin.astro`. */
export interface AuthTabsSignInConfig {
    /** URL to redirect to after a successful sign-in. */
    readonly redirectTo: string;
    /**
     * Marks `redirectTo` as a server-validated EXTERNAL URL (SPEC-182): a
     * cross-app `callbackUrl` (e.g. the admin panel) that already passed the
     * server-side allowlist. See `SignInProps.externalRedirect` for the full
     * rationale — this flows straight through to the credential-submit path
     * AND is used by this component's own OAuth handler when the sign-in
     * tab is active.
     */
    readonly externalRedirect?: boolean;
}

/** Sign-up-specific configuration passed down from `signup.astro`. */
export interface AuthTabsSignUpConfig {
    /**
     * URL to redirect to after a successful EMAIL sign-up. Email
     * registration has no session until the user opens the verification
     * email, so this always points at `/auth/verify-email-sent/` — the
     * caller's original destination does NOT survive this path (HOS-838,
     * a separate known gap).
     */
    readonly redirectTo: string;
    /**
     * URL to redirect to after a successful OAUTH sign-up. OAuth providers
     * verify the email themselves, so the user is already authenticated —
     * this can be (and, since HOS-959, IS) the caller's real destination,
     * including a validated cross-app `callbackUrl`.
     */
    readonly oauthRedirectTo: string;
    /**
     * Marks `oauthRedirectTo` as a server-validated EXTERNAL URL (mirrors
     * `AuthTabsSignInConfig.externalRedirect`, but for the sign-up tab's
     * OAuth destination specifically).
     */
    readonly oauthExternalRedirect?: boolean;
}

/**
 * Signal from the page that the previous OAuth round-trip failed.
 *
 * Populated by either `signin.astro` or `signup.astro` from the
 * `?error=...&provider=...` query string Better Auth + the API wrapper put
 * on the redirect. Both pages parse it identically (HOS-959 — an OAuth
 * failure that lands back on `/auth/signup` must surface a banner too, since
 * the OAuth block is now shared).
 *
 * @see SPEC-120
 */
export interface AuthTabsOAuthErrorInfo {
    readonly code: string;
    readonly description?: string;
    readonly provider?: string;
}

/** Props for the AuthTabs component. */
export interface AuthTabsProps {
    /** Active locale — used for translations. */
    readonly locale: SupportedLocale;
    /** Which tab is active on first paint — `signin.astro` passes `'signin'`, `signup.astro` passes `'signup'`. */
    readonly initialTab: AuthTab;
    /** Pathname (no query string) of the sign-in page, for the tab-switch `history.replaceState`. */
    readonly signInPath: string;
    /** Pathname (no query string) of the sign-up page, for the tab-switch `history.replaceState`. */
    readonly signUpPath: string;
    /** Sign-in-specific redirect configuration. */
    readonly signInConfig: AuthTabsSignInConfig;
    /** Sign-up-specific redirect configuration. */
    readonly signUpConfig: AuthTabsSignUpConfig;
    /** OAuth failure banner content, when the previous round-trip failed. */
    readonly initialOAuthError?: AuthTabsOAuthErrorInfo;
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
 * Unified sign-in / sign-up island with two visible tabs.
 *
 * @example
 * ```astro
 * <AuthTabs
 *   client:load
 *   locale={locale}
 *   initialTab="signin"
 *   signInPath={buildUrl({ locale, path: 'auth/signin' })}
 *   signUpPath={buildUrl({ locale, path: 'auth/signup' })}
 *   signInConfig={{ redirectTo, externalRedirect }}
 *   signUpConfig={{ redirectTo: verifyEmailSentUrl, oauthRedirectTo }}
 *   initialOAuthError={initialOAuthError}
 * />
 * ```
 */
export function AuthTabs({
    locale,
    initialTab,
    signInPath,
    signUpPath,
    signInConfig,
    signUpConfig,
    initialOAuthError
}: AuthTabsProps) {
    const { t } = createTranslations(locale);

    const [activeTab, setActiveTab] = useState<AuthTab>(initialTab);
    const [email, setEmail] = useState('');
    const [oauthLoading, setOauthLoading] = useState<AuthOAuthProvider | null>(null);
    const [oauthError, setOauthError] = useState<string | null>(null);

    const signInTabRef = useRef<HTMLButtonElement | null>(null);
    const signUpTabRef = useRef<HTMLButtonElement | null>(null);

    // SPEC-120: hydrate the OAuth banner from the SSR-supplied
    // initialOAuthError and sanitize the URL so it does not survive a
    // reload. Runs once, regardless of which tab is initially active — the
    // failure could have come back to either URL.
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

            setOauthError(message);

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

    /**
     * Switches the active tab and mirrors it into the URL via
     * `history.replaceState`, preserving the entire query string (so a
     * carried `returnUrl`/`callbackUrl` stays intact) — built from
     * `signInPath`/`signUpPath` props, never by string-editing
     * `window.location.pathname`. A reload or a shared link then reopens the
     * right tab. Wrapped in try/catch: `replaceState` can throw, and a
     * failed URL cosmetic must never break the tab switch itself.
     */
    const switchTab = useCallback(
        (tab: AuthTab) => {
            setActiveTab(tab);
            try {
                const url = new URL(window.location.href);
                url.pathname = tab === 'signin' ? signInPath : signUpPath;
                window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
            } catch {
                // Cosmetic URL sync only — never let this break tab switching.
            }
        },
        [signInPath, signUpPath]
    );

    /** ARIA tab pattern keyboard navigation (automatic activation, 2 tabs). */
    function handleTabKeyDown(e: React.KeyboardEvent<HTMLButtonElement>): void {
        if (
            e.key !== 'ArrowLeft' &&
            e.key !== 'ArrowRight' &&
            e.key !== 'Home' &&
            e.key !== 'End'
        ) {
            return;
        }
        e.preventDefault();
        const next: AuthTab =
            e.key === 'Home'
                ? 'signin'
                : e.key === 'End'
                  ? 'signup'
                  : activeTab === 'signin'
                    ? 'signup'
                    : 'signin';
        switchTab(next);
        (next === 'signin' ? signInTabRef : signUpTabRef).current?.focus();
    }

    /**
     * Single shared OAuth click handler. Resolves the post-OAuth target from
     * whichever tab is active — `signInConfig` when on sign-in, or
     * `signUpConfig.oauthRedirectTo` when on sign-up — since OAuth verifies
     * the email itself either way and the two flows converge on "log this
     * browser in and land on `target`".
     */
    async function handleOauth(provider: AuthOAuthProvider): Promise<void> {
        setOauthError(null);
        setOauthLoading(provider);

        try {
            const origin = window.location.origin;
            const { target, externalRedirect } =
                activeTab === 'signin'
                    ? {
                          target: signInConfig.redirectTo,
                          externalRedirect: Boolean(signInConfig.externalRedirect)
                      }
                    : {
                          target: signUpConfig.oauthRedirectTo,
                          externalRedirect: Boolean(signUpConfig.oauthExternalRedirect)
                      };

            // Build the absolute callbackURL on the client and anchor it on
            // the browser's real origin — see resolvePostAuthRedirectUrl for
            // why (reverse-proxy `https://localhost` bug).
            const rawTarget = externalRedirect ? target : target || window.location.pathname || '/';
            const callbackURL = resolvePostAuthRedirectUrl({
                target: rawTarget,
                currentOrigin: origin,
                externalRedirect
            });
            const errorCallbackURL = buildOAuthErrorCallbackUrl({
                currentOrigin: origin,
                currentPathname: window.location.pathname
            });
            await authClientSignIn.social({ provider, callbackURL, errorCallbackURL });
        } catch (err) {
            // Surface the actual Better Auth error to console so the
            // operator can distinguish INVALID_CALLBACKURL vs
            // account_not_linked vs network errors. Without this, every
            // OAuth failure looks identical to "user cancelled".
            console.error(`OAuth ${provider} sign-in failed`, err);
            setOauthError(t('auth.signIn.error', 'Error al iniciar sesión'));
            setOauthLoading(null);
        }
    }

    const headingText =
        activeTab === 'signin'
            ? t('auth-ui.pages.signin.title', 'Ingresar')
            : t('auth-ui.pages.signup.title', 'Registrarse');

    return (
        <div className={styles.authTabs}>
            <h1 className={styles.heading}>{headingText}</h1>

            {oauthError && (
                <div
                    role="alert"
                    className={styles.error}
                >
                    {oauthError}
                </div>
            )}

            <AuthOAuthButtons
                locale={locale}
                loadingProvider={oauthLoading}
                onSelectProvider={handleOauth}
            />

            <div
                role="tablist"
                aria-label={t('auth.tabs.label', 'Ingresar o registrarse')}
                className={styles.tablist}
            >
                <button
                    ref={signInTabRef}
                    type="button"
                    role="tab"
                    id="auth-tab-signin"
                    aria-selected={activeTab === 'signin'}
                    aria-controls="auth-tabpanel"
                    tabIndex={activeTab === 'signin' ? 0 : -1}
                    className={styles.tab}
                    onClick={() => switchTab('signin')}
                    onKeyDown={handleTabKeyDown}
                >
                    {t('auth.tabs.signIn', 'Ingresar')}
                </button>
                <button
                    ref={signUpTabRef}
                    type="button"
                    role="tab"
                    id="auth-tab-signup"
                    aria-selected={activeTab === 'signup'}
                    aria-controls="auth-tabpanel"
                    tabIndex={activeTab === 'signup' ? 0 : -1}
                    className={styles.tab}
                    onClick={() => switchTab('signup')}
                    onKeyDown={handleTabKeyDown}
                >
                    {t('auth.tabs.signUp', 'Registrarse')}
                </button>
            </div>

            <div
                role="tabpanel"
                id="auth-tabpanel"
                aria-labelledby={activeTab === 'signin' ? 'auth-tab-signin' : 'auth-tab-signup'}
                className={styles.tabpanel}
            >
                {activeTab === 'signin' ? (
                    <SignIn
                        locale={locale}
                        redirectTo={signInConfig.redirectTo}
                        externalRedirect={signInConfig.externalRedirect}
                        email={email}
                        onEmailChange={setEmail}
                    />
                ) : (
                    <SignUp
                        locale={locale}
                        redirectTo={signUpConfig.redirectTo}
                        email={email}
                        onEmailChange={setEmail}
                    />
                )}
            </div>
        </div>
    );
}
