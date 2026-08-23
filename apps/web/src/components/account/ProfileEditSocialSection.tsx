/**
 * @file ProfileEditSocialSection.tsx
 * @description Social networks section — 5 URL inputs (Facebook, Instagram,
 * Twitter / X, LinkedIn, YouTube). Pure presentational subcomponent — all
 * state lives in `ProfileEditForm.client.tsx`.
 *
 * Introduced in the SPEC-113 polish round so the profile edit page can
 * surface the social-network URLs collected during signup.
 */

import { FieldError, fieldErrorId } from '@/components/ui/FieldError';
import type { ProfileEditFieldErrors } from './ProfileEditForm.helpers';
import styles from './ProfileEditForm.module.css';

/** Props for the social section. */
export interface ProfileEditSocialSectionProps {
    readonly facebookUrl: string;
    readonly instagramUrl: string;
    readonly twitterUrl: string;
    readonly linkedinUrl: string;
    readonly youtubeUrl: string;
    /**
     * `settings.publicProfileShowSocialNetworks` (HOS-375 §6.7). Whether the
     * links above are published on the owner's public author page.
     */
    readonly showOnPublicProfile: boolean;
    readonly fieldErrors: ProfileEditFieldErrors;
    readonly submitting: boolean;
    readonly t: (key: string, fallback?: string) => string;
    readonly onShowOnPublicProfileChange: (value: boolean) => void;
    readonly onFacebookChange: (value: string) => void;
    readonly onInstagramChange: (value: string) => void;
    readonly onTwitterChange: (value: string) => void;
    readonly onLinkedinChange: (value: string) => void;
    readonly onYoutubeChange: (value: string) => void;
}

interface SocialFieldProps {
    readonly id: string;
    readonly label: string;
    readonly placeholder: string;
    readonly value: string;
    readonly error: string | undefined;
    readonly submitting: boolean;
    readonly onChange: (value: string) => void;
}

function SocialField({
    id,
    label,
    placeholder,
    value,
    error,
    submitting,
    onChange
}: SocialFieldProps) {
    return (
        <div className={styles.field}>
            <label
                className={styles.label}
                htmlFor={id}
            >
                {label}
            </label>
            <input
                id={id}
                type="url"
                className={`${styles.input} ${error ? styles.inputError : ''}`}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                aria-invalid={!!error}
                aria-describedby={error ? fieldErrorId(id) : undefined}
                autoComplete="off"
                disabled={submitting}
            />
            <FieldError
                id={fieldErrorId(id)}
                message={error}
            />
        </div>
    );
}

/**
 * Renders the 5 social network URL inputs.
 *
 * @param props - Component props (see {@link ProfileEditSocialSectionProps})
 */
export function ProfileEditSocialSection({
    facebookUrl,
    instagramUrl,
    twitterUrl,
    linkedinUrl,
    youtubeUrl,
    showOnPublicProfile,
    fieldErrors,
    submitting,
    t,
    onShowOnPublicProfileChange,
    onFacebookChange,
    onInstagramChange,
    onTwitterChange,
    onLinkedinChange,
    onYoutubeChange
}: ProfileEditSocialSectionProps) {
    return (
        <section
            className={styles.section}
            aria-labelledby="social-section-title"
        >
            <h3
                className={styles.sectionTitle}
                id="social-section-title"
            >
                {t('account.pages.editProfile.socialSection')}
            </h3>
            <div className={styles.grid}>
                <SocialField
                    id="facebookUrl"
                    label={t('account.editProfile.fields.facebook')}
                    placeholder="https://facebook.com/usuario"
                    value={facebookUrl}
                    error={fieldErrors.facebookUrl}
                    submitting={submitting}
                    onChange={onFacebookChange}
                />
                <SocialField
                    id="instagramUrl"
                    label={t('account.editProfile.fields.instagram')}
                    placeholder="https://instagram.com/usuario"
                    value={instagramUrl}
                    error={fieldErrors.instagramUrl}
                    submitting={submitting}
                    onChange={onInstagramChange}
                />
                <SocialField
                    id="twitterUrl"
                    label={t('account.editProfile.fields.twitter')}
                    placeholder="https://x.com/usuario"
                    value={twitterUrl}
                    error={fieldErrors.twitterUrl}
                    submitting={submitting}
                    onChange={onTwitterChange}
                />
                <SocialField
                    id="linkedinUrl"
                    label={t('account.editProfile.fields.linkedin')}
                    placeholder="https://linkedin.com/in/usuario"
                    value={linkedinUrl}
                    error={fieldErrors.linkedinUrl}
                    submitting={submitting}
                    onChange={onLinkedinChange}
                />
                <SocialField
                    id="youtubeUrl"
                    label={t('account.editProfile.fields.youtube')}
                    placeholder="https://youtube.com/@usuario"
                    value={youtubeUrl}
                    error={fieldErrors.youtubeUrl}
                    submitting={submitting}
                    onChange={onYoutubeChange}
                />
            </div>

            {/*
              HOS-375 §6.7 (G-5) — publishing these links is opt-in, default off.
              The copy is not decoration: without it the toggle would publish
              data the user never knew was publishable. It states the three
              things they need to decide, in order — that the author page
              exists, that it is public, and that these links appear on it.

              Phrased conditionally ("si publicás") on purpose: the author page
              only exists for someone with at least one published note or event,
              so promising "tu página de autor" to every account would describe
              a page most of them do not have.
            */}
            <div className={styles.consentBlock}>
                <label
                    className={styles.checkboxLabel}
                    htmlFor="publicProfileShowSocialNetworks"
                >
                    <input
                        id="publicProfileShowSocialNetworks"
                        type="checkbox"
                        className={styles.checkbox}
                        checked={showOnPublicProfile}
                        onChange={(e) => onShowOnPublicProfileChange(e.target.checked)}
                        aria-describedby="publicProfileShowSocialNetworks-help"
                        disabled={submitting}
                    />
                    <span>
                        {t(
                            'account.editProfile.social.showOnPublicProfile',
                            'Mostrar mis redes en mi página pública de autor'
                        )}
                    </span>
                </label>
                <p
                    className={styles.consentHelp}
                    id="publicProfileShowSocialNetworks-help"
                >
                    {t(
                        'account.editProfile.social.showOnPublicProfileHelp',
                        'Si publicás notas o eventos, tenés una página de autor visible para cualquiera en internet. Al activar esto, los enlaces de arriba se muestran ahí. Está desactivado salvo que vos lo actives, y podés desactivarlo cuando quieras.'
                    )}
                </p>
            </div>
        </section>
    );
}
