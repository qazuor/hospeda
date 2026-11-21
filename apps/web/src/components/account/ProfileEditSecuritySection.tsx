/**
 * @file ProfileEditSecuritySection.tsx
 * @description "Seguridad" section of the edit-profile form (HOS-2431).
 *
 * Presents the only entry point to the voluntary change-password page, or, for
 * an account that signs in only with Google/Facebook and therefore has NO
 * password, to the add-password page. Pure presentational component.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { CHANGE_PASSWORD_SEGMENT, SET_PASSWORD_SEGMENT } from '@/lib/routes';
import { buildUrl } from '@/lib/urls';
import styles from './ProfileEditForm.module.css';

/** Props for the security section. */
export interface ProfileEditSecuritySectionProps {
    /** Active locale, used to build the destination URLs. */
    readonly locale: SupportedLocale;
    /** Translation function. */
    readonly t: (key: string, fallback?: string) => string;
    /**
     * Whether the account has a credential (email + password) login. Defaults to
     * `true` when unknown, since the change-password copy is the safer reading
     * for an account whose status could not be fetched.
     */
    readonly hasPassword?: boolean;
}

/**
 * Renders a short description and a link to change or add the password. Both
 * links carry a `returnUrl` back to the edit-profile page.
 *
 * @param props - Component props (see {@link ProfileEditSecuritySectionProps})
 */
export function ProfileEditSecuritySection({
    locale,
    t,
    hasPassword = true
}: ProfileEditSecuritySectionProps) {
    const segment = hasPassword ? CHANGE_PASSWORD_SEGMENT : SET_PASSWORD_SEGMENT;
    const returnUrl = encodeURIComponent(buildUrl({ locale, path: 'mi-cuenta/editar' }));
    const href = `${buildUrl({ locale, path: `mi-cuenta/${segment}` })}?returnUrl=${returnUrl}`;

    return (
        <section
            className={styles.section}
            aria-labelledby="security-section-title"
        >
            <h3
                className={styles.sectionTitle}
                id="security-section-title"
            >
                {t('account.pages.editProfile.securitySection')}
            </h3>
            <p>
                {hasPassword
                    ? t('account.editProfile.security.description')
                    : t('account.editProfile.security.noPasswordDescription')}
            </p>
            <a
                className={styles.securityLink}
                href={href}
            >
                {hasPassword
                    ? t('account.editProfile.security.changePasswordLink')
                    : t('account.editProfile.security.addPasswordLink')}
            </a>
        </section>
    );
}
