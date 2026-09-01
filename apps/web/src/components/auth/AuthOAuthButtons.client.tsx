/**
 * @file AuthOAuthButtons.client.tsx
 * @description Presentational Google/Facebook OAuth button row, shared by
 * both the sign-in and sign-up flows (HOS-959).
 *
 * Signing in with Google IS signing up with Google — there is no meaningful
 * distinction between the two intents once a provider is chosen — so this
 * block renders ONCE, above and outside the sign-in/sign-up tabs owned by
 * `AuthTabs.client.tsx`, instead of being duplicated inside each form. This
 * component owns only presentation (the divider, the two buttons, the
 * brand icons); `AuthTabs` owns the click handler, the loading state, and
 * the error banner, since it also owns which tab is active and therefore
 * which post-OAuth destination applies.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './AuthOAuthButtons.module.css';

/** An OAuth provider this block offers. */
export type AuthOAuthProvider = 'google' | 'facebook';

/** Props for the AuthOAuthButtons component. */
export interface AuthOAuthButtonsProps {
    /** Active locale — used for translations. */
    readonly locale: SupportedLocale;
    /**
     * Which provider button is currently mid-flight (disables both buttons
     * and marks the active one `aria-busy`), or `null` when idle.
     */
    readonly loadingProvider: AuthOAuthProvider | null;
    /** Called with the chosen provider when a button is activated. */
    readonly onSelectProvider: (provider: AuthOAuthProvider) => void;
}

/**
 * Renders the "or" divider plus the Google and Facebook continue-with
 * buttons. Purely presentational — see the file-level doc for why the
 * actual OAuth call lives in the parent instead.
 *
 * @example
 * ```tsx
 * <AuthOAuthButtons locale={locale} loadingProvider={oauthLoading} onSelectProvider={handleOauth} />
 * ```
 */
export function AuthOAuthButtons({
    locale,
    loadingProvider,
    onSelectProvider
}: AuthOAuthButtonsProps) {
    const { t } = createTranslations(locale);

    return (
        <div className={styles.oauthBlock}>
            <div
                className={styles.divider}
                aria-hidden="true"
            >
                <span className={styles.dividerLine} />
                <span>{t('auth.oauth.or', 'o')}</span>
                <span className={styles.dividerLine} />
            </div>

            <button
                type="button"
                className={styles.oauthButton}
                onClick={() => onSelectProvider('google')}
                disabled={loadingProvider !== null}
                aria-busy={loadingProvider === 'google'}
            >
                <GoogleIcon />
                {t('auth.oauth.withGoogle', 'Continuar con Google')}
            </button>

            <button
                type="button"
                className={styles.oauthButton}
                onClick={() => onSelectProvider('facebook')}
                disabled={loadingProvider !== null}
                aria-busy={loadingProvider === 'facebook'}
            >
                <FacebookIcon />
                {t('auth.oauth.withFacebook', 'Continuar con Facebook')}
            </button>
        </div>
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
