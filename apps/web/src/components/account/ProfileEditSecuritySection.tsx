/**
 * @file ProfileEditSecuritySection.tsx
 * @description "Seguridad" section of the edit-profile form (HOS-2431).
 *
 * Presents the only entry point to the voluntary change-password page
 * (`/{locale}/mi-cuenta/cambiar-contrasena/`). Pure presentational component.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import styles from './ProfileEditForm.module.css';

/** Props for the security section. */
export interface ProfileEditSecuritySectionProps {
    /** Active locale, used to build the change-password URL. */
    readonly locale: SupportedLocale;
    /** Translation function. */
    readonly t: (key: string, fallback?: string) => string;
}

/**
 * Renders a short description and a link to the change-password page.
 *
 * @param props - Component props (see {@link ProfileEditSecuritySectionProps})
 */
export function ProfileEditSecuritySection({ locale, t }: ProfileEditSecuritySectionProps) {
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
            <p>{t('account.editProfile.security.description')}</p>
            <a
                className={styles.securityLink}
                href={buildUrl({ locale, path: 'mi-cuenta/cambiar-contrasena' })}
            >
                {t('account.editProfile.security.changePasswordLink')}
            </a>
        </section>
    );
}
