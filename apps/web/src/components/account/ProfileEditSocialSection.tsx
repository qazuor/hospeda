/**
 * @file ProfileEditSocialSection.tsx
 * @description "Redes sociales" section of the profile edit form: five URL
 * fields and the opt-in to publish them (HOS-375 §6.7). Presentational.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { ProfileTextField } from './ProfileEditFields';
import type { ProfileEditFieldErrors } from './ProfileEditForm.helpers';
import styles from './ProfileEditForm.module.css';
import { Checkbox } from './ui/Checkbox';
import { Section } from './ui/Section';

/** DOM id of the consent copy the opt-in checkbox is described by. */
const CONSENT_HELP_ID = 'publicProfileShowSocialNetworks-help';

/** Props of {@link ProfileEditSocialSection}. */
export interface ProfileEditSocialSectionProps {
    readonly locale: SupportedLocale;
    readonly t: (key: string, fallback?: string) => string;
    readonly facebookUrl: string;
    readonly instagramUrl: string;
    readonly twitterUrl: string;
    readonly linkedinUrl: string;
    readonly youtubeUrl: string;
    /**
     * `settings.publicProfileShowSocialNetworks` (HOS-375 §6.7). Whether the
     * links are published on the owner's public author page.
     */
    readonly showOnPublicProfile: boolean;
    readonly fieldErrors: ProfileEditFieldErrors;
    readonly submitting: boolean;
    readonly onShowOnPublicProfileChange: (value: boolean) => void;
    readonly onFacebookChange: (value: string) => void;
    readonly onInstagramChange: (value: string) => void;
    readonly onTwitterChange: (value: string) => void;
    readonly onLinkedinChange: (value: string) => void;
    readonly onYoutubeChange: (value: string) => void;
}

/**
 * Social networks section.
 *
 * @param props - See {@link ProfileEditSocialSectionProps}.
 */
export function ProfileEditSocialSection({
    locale,
    t,
    facebookUrl,
    instagramUrl,
    twitterUrl,
    linkedinUrl,
    youtubeUrl,
    showOnPublicProfile,
    fieldErrors,
    submitting,
    onShowOnPublicProfileChange,
    onFacebookChange,
    onInstagramChange,
    onTwitterChange,
    onLinkedinChange,
    onYoutubeChange
}: ProfileEditSocialSectionProps) {
    const networks = [
        {
            name: 'facebookUrl',
            label: 'facebook',
            placeholder: 'https://facebook.com/usuario',
            value: facebookUrl,
            onChange: onFacebookChange
        },
        {
            name: 'instagramUrl',
            label: 'instagram',
            placeholder: 'https://instagram.com/usuario',
            value: instagramUrl,
            onChange: onInstagramChange
        },
        {
            name: 'twitterUrl',
            label: 'twitter',
            placeholder: 'https://x.com/usuario',
            value: twitterUrl,
            onChange: onTwitterChange
        },
        {
            name: 'linkedinUrl',
            label: 'linkedin',
            placeholder: 'https://linkedin.com/in/usuario',
            value: linkedinUrl,
            onChange: onLinkedinChange
        },
        {
            name: 'youtubeUrl',
            label: 'youtube',
            placeholder: 'https://youtube.com/@usuario',
            value: youtubeUrl,
            onChange: onYoutubeChange
        }
    ] as const;

    return (
        <Section
            title={t('account.pages.editProfile.socialSection')}
            helpId="section:profile.social"
        >
            <div className={styles.grid}>
                {networks.map((network) => (
                    <ProfileTextField
                        key={network.name}
                        name={network.name}
                        label={t(`account.editProfile.fields.${network.label}`)}
                        locale={locale}
                        type="url"
                        value={network.value}
                        onChange={network.onChange}
                        error={fieldErrors[network.name]}
                        placeholder={network.placeholder}
                        autoComplete="off"
                        disabled={submitting}
                    />
                ))}
            </div>

            {/*
              HOS-375 §6.7 (G-5): publishing these links is opt-in, default off.
              The copy is not decoration: it states the three things a user needs
              in order to decide (the author page exists, it is public, and these
              links appear on it). Phrased conditionally ("si publicás") because
              the author page only exists for someone with a published note or
              event.
            */}
            <div className={styles.consent}>
                <Checkbox
                    id="publicProfileShowSocialNetworks"
                    label={t(
                        'account.editProfile.social.showOnPublicProfile',
                        'Mostrar mis redes en mi página pública de autor'
                    )}
                    checked={showOnPublicProfile}
                    onChange={(event) => onShowOnPublicProfileChange(event.target.checked)}
                    aria-describedby={CONSENT_HELP_ID}
                    disabled={submitting}
                />
                <p
                    className={styles.consentHelp}
                    id={CONSENT_HELP_ID}
                >
                    {t(
                        'account.editProfile.social.showOnPublicProfileHelp',
                        'Si publicás notas o eventos, tenés una página de autor visible para cualquiera en internet. Al activar esto, los enlaces de arriba se muestran ahí. Está desactivado salvo que vos lo actives, y podés desactivarlo cuando quieras.'
                    )}
                </p>
            </div>
        </Section>
    );
}
