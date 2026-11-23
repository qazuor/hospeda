/**
 * @file ProfileEditSecuritySection.tsx
 * @description "Seguridad" section of the profile edit form (HOS-2431).
 *
 * The only entry point to the voluntary change-password page, or, for an
 * account that signs in only with Google/Facebook and therefore has NO
 * password, to the add-password page. Presentational.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { CHANGE_PASSWORD_SEGMENT, SET_PASSWORD_SEGMENT } from '@/lib/routes';
import { buildUrl } from '@/lib/urls';
import styles from './ProfileEditForm.module.css';
import { Section } from './ui/Section';
import { TextLink } from './ui/TextLink';

/** Props of {@link ProfileEditSecuritySection}. */
export interface ProfileEditSecuritySectionProps {
    /** Active locale, used to build the destination URLs. */
    readonly locale: SupportedLocale;
    /** Translation function. */
    readonly t: (key: string, fallback?: string) => string;
    /**
     * Whether the account has a credential (email + password) login. Defaults to
     * `true` when unknown: the change-password copy is the safer reading for an
     * account whose status could not be fetched.
     */
    readonly hasPassword?: boolean;
}

/**
 * A short description and a link to change or add the password. Both links
 * carry a `returnUrl` back to the edit-profile page.
 *
 * @param props - See {@link ProfileEditSecuritySectionProps}.
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
        <Section
            title={t('account.pages.editProfile.securitySection')}
            helpId="section:profile.security"
        >
            <div className={styles.securityBody}>
                <p className={styles.securityText}>
                    {hasPassword
                        ? t('account.editProfile.security.description')
                        : t('account.editProfile.security.noPasswordDescription')}
                </p>
                <TextLink href={href}>
                    {hasPassword
                        ? t('account.editProfile.security.changePasswordLink')
                        : t('account.editProfile.security.addPasswordLink')}
                </TextLink>
            </div>
        </Section>
    );
}
