/**
 * @file SocialNetworksSection.client.tsx
 * @description Form section for accommodation social network URLs:
 * Facebook, Instagram, Twitter, LinkedIn, TikTok, YouTube.
 * Uses native HTML form elements.
 */

import type { AccommodationEditData } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './SocialNetworksSection.module.css';

/** Props for SocialNetworksSection. */
export interface SocialNetworksSectionProps {
    readonly locale: SupportedLocale;
    readonly data: AccommodationEditData;
    readonly errors: Readonly<{
        facebookUrl?: string;
        instagramUrl?: string;
        twitterUrl?: string;
        linkedinUrl?: string;
        tiktokUrl?: string;
        youtubeUrl?: string;
    }>;
    readonly onFieldChange: (field: keyof AccommodationEditData, value: string) => void;
}

/**
 * Social networks form section.
 * Renders URL inputs for each supported social platform.
 */
export function SocialNetworksSection({
    locale,
    data,
    errors,
    onFieldChange
}: SocialNetworksSectionProps) {
    const { t } = createTranslations(locale);

    return (
        <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>
                {t('host.properties.editor.section.socialNetworks', 'Redes sociales')}
            </legend>

            <div className={styles.field}>
                <label
                    htmlFor="acc-facebook"
                    className={styles.fieldLabel}
                >
                    {t('host.properties.editor.field.facebook', 'Facebook')}
                </label>
                <input
                    id="acc-facebook"
                    type="url"
                    className={styles.fieldInput}
                    value={data.facebookUrl}
                    onChange={(e) => onFieldChange('facebookUrl', e.target.value)}
                    placeholder="https://facebook.com/tu-pagina"
                    aria-invalid={Boolean(errors.facebookUrl)}
                    aria-describedby={errors.facebookUrl ? 'acc-facebook-error' : undefined}
                />
                {errors.facebookUrl && (
                    <span
                        id="acc-facebook-error"
                        className={styles.fieldError}
                        role="alert"
                    >
                        {errors.facebookUrl}
                    </span>
                )}
            </div>

            <div className={styles.field}>
                <label
                    htmlFor="acc-instagram"
                    className={styles.fieldLabel}
                >
                    {t('host.properties.editor.field.instagram', 'Instagram')}
                </label>
                <input
                    id="acc-instagram"
                    type="url"
                    className={styles.fieldInput}
                    value={data.instagramUrl}
                    onChange={(e) => onFieldChange('instagramUrl', e.target.value)}
                    placeholder="https://instagram.com/tu-perfil"
                    aria-invalid={Boolean(errors.instagramUrl)}
                    aria-describedby={errors.instagramUrl ? 'acc-instagram-error' : undefined}
                />
                {errors.instagramUrl && (
                    <span
                        id="acc-instagram-error"
                        className={styles.fieldError}
                        role="alert"
                    >
                        {errors.instagramUrl}
                    </span>
                )}
            </div>

            <div className={styles.field}>
                <label
                    htmlFor="acc-twitter"
                    className={styles.fieldLabel}
                >
                    {t('host.properties.editor.field.twitter', 'Twitter / X')}
                </label>
                <input
                    id="acc-twitter"
                    type="url"
                    className={styles.fieldInput}
                    value={data.twitterUrl}
                    onChange={(e) => onFieldChange('twitterUrl', e.target.value)}
                    placeholder="https://x.com/tu-usuario"
                    aria-invalid={Boolean(errors.twitterUrl)}
                    aria-describedby={errors.twitterUrl ? 'acc-twitter-error' : undefined}
                />
                {errors.twitterUrl && (
                    <span
                        id="acc-twitter-error"
                        className={styles.fieldError}
                        role="alert"
                    >
                        {errors.twitterUrl}
                    </span>
                )}
            </div>

            <div className={styles.field}>
                <label
                    htmlFor="acc-linkedin"
                    className={styles.fieldLabel}
                >
                    {t('host.properties.editor.field.linkedin', 'LinkedIn')}
                </label>
                <input
                    id="acc-linkedin"
                    type="url"
                    className={styles.fieldInput}
                    value={data.linkedinUrl}
                    onChange={(e) => onFieldChange('linkedinUrl', e.target.value)}
                    placeholder="https://linkedin.com/in/tu-perfil"
                    aria-invalid={Boolean(errors.linkedinUrl)}
                    aria-describedby={errors.linkedinUrl ? 'acc-linkedin-error' : undefined}
                />
                {errors.linkedinUrl && (
                    <span
                        id="acc-linkedin-error"
                        className={styles.fieldError}
                        role="alert"
                    >
                        {errors.linkedinUrl}
                    </span>
                )}
            </div>

            <div className={styles.field}>
                <label
                    htmlFor="acc-tiktok"
                    className={styles.fieldLabel}
                >
                    {t('host.properties.editor.field.tiktok', 'TikTok')}
                </label>
                <input
                    id="acc-tiktok"
                    type="url"
                    className={styles.fieldInput}
                    value={data.tiktokUrl}
                    onChange={(e) => onFieldChange('tiktokUrl', e.target.value)}
                    placeholder="https://tiktok.com/@tu-usuario"
                    aria-invalid={Boolean(errors.tiktokUrl)}
                    aria-describedby={errors.tiktokUrl ? 'acc-tiktok-error' : undefined}
                />
                {errors.tiktokUrl && (
                    <span
                        id="acc-tiktok-error"
                        className={styles.fieldError}
                        role="alert"
                    >
                        {errors.tiktokUrl}
                    </span>
                )}
            </div>

            <div className={styles.field}>
                <label
                    htmlFor="acc-youtube"
                    className={styles.fieldLabel}
                >
                    {t('host.properties.editor.field.youtube', 'YouTube')}
                </label>
                <input
                    id="acc-youtube"
                    type="url"
                    className={styles.fieldInput}
                    value={data.youtubeUrl}
                    onChange={(e) => onFieldChange('youtubeUrl', e.target.value)}
                    placeholder="https://youtube.com/@tu-canal"
                    aria-invalid={Boolean(errors.youtubeUrl)}
                    aria-describedby={errors.youtubeUrl ? 'acc-youtube-error' : undefined}
                />
                {errors.youtubeUrl && (
                    <span
                        id="acc-youtube-error"
                        className={styles.fieldError}
                        role="alert"
                    >
                        {errors.youtubeUrl}
                    </span>
                )}
            </div>
        </fieldset>
    );
}
