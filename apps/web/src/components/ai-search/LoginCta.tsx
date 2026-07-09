/**
 * @file LoginCta.tsx
 * @description Login/register call-to-action shown in place of the chat UI
 * for anonymous visitors (SPEC-265 W14). Extracted from
 * SearchChatPanel.client.tsx (HOS-111 follow-up) to keep that file under the
 * repo's 500-line limit — this block has no closure over parent chat state.
 *
 * @module LoginCta
 */

import { buildLoginRedirect } from '@/lib/auth-redirect';
import type { createTranslations, SupportedLocale } from '@/lib/i18n';
import styles from './SearchChatPanel.module.css';

/**
 * Props for {@link LoginCta}.
 *
 * @property locale - Active locale for translations and the redirect URLs.
 * @property currentUrl - Full URL of the current page, used to build the
 *   post-login redirect href. Pass `Astro.url.href` from the host page.
 * @property t - Bound translation function (from `createTranslations`).
 */
export interface LoginCtaProps {
    readonly locale: SupportedLocale;
    readonly currentUrl: string;
    readonly t: ReturnType<typeof createTranslations>['t'];
}

/**
 * LoginCta — replaces the full chat UI with a login/register prompt for
 * anonymous visitors (SPEC-265 W14).
 *
 * @example
 * ```tsx
 * <LoginCta locale={locale} currentUrl={currentUrl} t={t} />
 * ```
 */
export function LoginCta({ locale, currentUrl, t }: LoginCtaProps) {
    const loginHref = buildLoginRedirect({ locale, currentUrl });
    const registerHref = `/${locale}/auth/signup/`;

    return (
        <section
            aria-label={t('aiSearch.chat.panelLabel', 'Panel de búsqueda conversacional con IA')}
            className={styles.panel}
        >
            <div className={styles.loginCtaBlock}>
                <h3 className={styles.loginCtaTitle}>
                    {t('aiSearch.loginPromptTitle', 'Iniciá sesión para buscar con IA')}
                </h3>
                <p className={styles.loginCtaMessage}>
                    {t(
                        'aiSearch.loginPromptMessage',
                        'La búsqueda inteligente está disponible para usuarios registrados.'
                    )}
                </p>
                <div className={styles.loginCtaActions}>
                    <a
                        href={loginHref}
                        className={styles.loginCtaSignIn}
                    >
                        {t('aiSearch.loginPromptCta', 'Iniciar sesión')}
                    </a>
                    <a
                        href={registerHref}
                        className={styles.loginCtaRegister}
                    >
                        {t('aiSearch.loginPromptRegisterCta', 'Crear cuenta')}
                    </a>
                </div>
            </div>
        </section>
    );
}
