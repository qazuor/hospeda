/**
 * @file ContactForm.client.tsx
 * @description Form island for `…/editar/contacto/` (HOS-318 T-024).
 *
 * Contact channels plus the six social URLs — the pre-split editor kept these as
 * two separate sections; the split merges them, since neither is a screenful on
 * its own.
 *
 * The form names the social fields `<network>Url` while the API expects the bare
 * platform name. That translation happens in exactly two places, both wired
 * here: `SOCIAL_KEY_MAP` renames them on the way out, and the same map tells the
 * hook which error key to clear on edit. `SocialNetworksSection` reads its
 * errors under the form-local names, so they are mapped back for it.
 */

import type { AccommodationEditData } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { ActionBar } from '../ActionBar.client';
import { AccommodationContactSchema } from '../accommodation-edit-form.schema';
import { ContactInfoSection } from '../ContactInfoSection.client';
import { SocialNetworksSection } from '../SocialNetworksSection.client';
import { useAccommodationSectionForm } from '../use-accommodation-section-form';
import styles from './SectionForm.module.css';

/** The fields this page owns. Nothing else can reach the PATCH body. */
const OWN_FIELDS = [
    'phone',
    'whatsapp',
    'email',
    'website',
    'facebookUrl',
    'instagramUrl',
    'twitterUrl',
    'linkedinUrl',
    'tiktokUrl',
    'youtubeUrl'
] as const;

/** Form-local field name → the HTTP key the API validates and stores. */
const SOCIAL_KEY_MAP = {
    facebookUrl: 'facebook',
    instagramUrl: 'instagram',
    twitterUrl: 'twitter',
    linkedinUrl: 'linkedin',
    tiktokUrl: 'tiktok',
    youtubeUrl: 'youtube'
} as const;

interface ContactFormProps {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
    readonly initialData: AccommodationEditData;
}

/**
 * Contact and social networks form for one accommodation.
 *
 * @param props - Locale, id, and the loaded entity.
 */
export function ContactForm({ locale, accommodationId, initialData }: ContactFormProps) {
    const form = useAccommodationSectionForm({
        locale,
        accommodationId,
        initialValues: initialData,
        ownFields: [...OWN_FIELDS],
        schema: AccommodationContactSchema,
        fieldKeyMap: SOCIAL_KEY_MAP
    });

    // The schema reports social errors under the HTTP key; the section renders
    // them under the form-local name. Without this the error slots stay empty
    // and an invalid URL is rejected with no visible reason.
    const socialErrors = {
        facebookUrl: form.fieldErrors.facebook,
        instagramUrl: form.fieldErrors.instagram,
        twitterUrl: form.fieldErrors.twitter,
        linkedinUrl: form.fieldErrors.linkedin,
        tiktokUrl: form.fieldErrors.tiktok,
        youtubeUrl: form.fieldErrors.youtube
    };

    return (
        <form
            className={styles.form}
            onSubmit={form.handleSubmit}
            noValidate
        >
            <div className={styles.card}>
                <ContactInfoSection
                    locale={locale}
                    data={form.values}
                    errors={form.fieldErrors}
                    onFieldChange={(field, value) => form.setValue(field, value)}
                />
            </div>

            <div className={styles.card}>
                <SocialNetworksSection
                    locale={locale}
                    data={form.values}
                    errors={socialErrors}
                    onFieldChange={(field, value) => form.setValue(field, value)}
                />
            </div>

            {form.formError && (
                <div
                    className={styles.error}
                    role="alert"
                >
                    {form.formError}
                </div>
            )}

            <ActionBar
                locale={locale}
                isSaving={form.isSaving}
                onCancel={form.handleCancel}
            />
        </form>
    );
}
