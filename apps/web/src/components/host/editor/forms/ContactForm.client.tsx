/**
 * @file ContactForm.client.tsx
 * @description Form island for `…/editar/contacto/` (HOS-318 T-024).
 *
 * Contact channels plus the six social URLs — the pre-split editor kept these as
 * two separate sections; the split merges them, since neither is a screenful on
 * its own.
 *
 * The form names the social fields `<network>Url` while the API expects the bare
 * platform name. `SOCIAL_KEY_MAP` renames them on the way out and tells the hook
 * which error key to clear on edit; the errors themselves arrive under the HTTP
 * key, which is also the key the DOM id is built from.
 *
 * HOS-2508 (owner decision 11): the page state binds STRAIGHT to the shared kit
 * sections in `components/account/editor-fields/` — `ListingContactSection`
 * for the channels and `EditorSocialLinksSection` for the networks — with no
 * accommodation-only section in between. The handle ⇄ URL conversion lives in
 * `./social-handle`.
 */

import { EditorSocialLinksSection } from '@/components/account/editor-fields/EditorSocialLinksSection';
import {
    type ContactChannel,
    ListingContactSection
} from '@/components/account/editor-fields/ListingContactSection';
import { EditorSaveBar } from '@/components/account/editor-shell/EditorSaveBar';
import type { AccommodationEditData } from '@/lib/api/types';
import { buildFieldId } from '@/lib/forms/build-field-id';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { AccommodationContactSchema } from '../accommodation-edit-form.schema';
import { ACCOMMODATION_FIELD_ID_SUFFIXES, ACCOMMODATION_FIELD_PREFIX } from '../field-ids';
import { useAccommodationSectionForm } from '../use-accommodation-section-form';
import { nullifyClearedSocials } from './contact-payload';
import styles from './SectionForm.module.css';
import { ACCOMMODATION_SOCIAL_FIELDS, composeSocialUrl, parseSocialHandle } from './social-handle';

/** The fields this page owns. Nothing else can reach the PATCH body. */
const OWN_FIELDS = [
    'phone',
    'whatsapp',
    'landlinePhone',
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
const SOCIAL_KEY_MAP: Readonly<Record<string, string>> = Object.fromEntries(
    ACCOMMODATION_SOCIAL_FIELDS.map(({ field, schemaKey }) => [field, schemaKey])
);

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
    const t = createT(locale);
    const form = useAccommodationSectionForm({
        locale,
        accommodationId,
        initialValues: initialData,
        ownFields: [...OWN_FIELDS],
        schema: AccommodationContactSchema,
        fieldKeyMap: SOCIAL_KEY_MAP,
        // A cleared network must travel as `null`: the column is merged, so
        // omitting (or `''`) would leave the stored link in place (HOS-1262).
        extendPayload: nullifyClearedSocials
    });

    /** One contact channel of the shared section, bound to this form. */
    const contactChannel = (
        name: 'phone' | 'landlinePhone' | 'whatsapp' | 'email' | 'website'
    ): ContactChannel => ({
        name,
        value: form.values[name],
        onChange: (value) => form.setValue(name, value),
        error: form.fieldErrors[name]
    });

    return (
        <form
            className={styles.form}
            onSubmit={form.handleSubmit}
            noValidate
        >
            {/* HOS-2497: the one contact section both editors render. */}
            <ListingContactSection
                locale={locale}
                idPrefix={ACCOMMODATION_FIELD_PREFIX}
                suffixes={ACCOMMODATION_FIELD_ID_SUFFIXES}
                helpId="section:accommodation.contacto"
                phone={contactChannel('phone')}
                landline={contactChannel('landlinePhone')}
                whatsapp={contactChannel('whatsapp')}
                email={contactChannel('email')}
                website={contactChannel('website')}
            />

            <EditorSocialLinksSection
                locale={locale}
                helpId="section:accommodation.contacto"
                links={ACCOMMODATION_SOCIAL_FIELDS.map(
                    ({ field, schemaKey, domain, labelKey, fallbackLabel }) => ({
                        id: buildFieldId({ prefix: ACCOMMODATION_FIELD_PREFIX, name: schemaKey }),
                        label: t(labelKey, fallbackLabel),
                        prefix: domain,
                        value: parseSocialHandle({ url: form.values[field], domain }).handle,
                        onChange: (value: string) =>
                            form.setValue(field, composeSocialUrl({ handle: value, domain }).url),
                        // Errors arrive under the HTTP key, the same key the id uses.
                        error: form.fieldErrors[schemaKey]
                    })
                )}
            />

            <EditorSaveBar
                locale={locale}
                errorMessage={form.formError}
                isDirty={form.isDirty}
                onSave={form.save}
                onDiscard={form.discard}
                idPrefix={ACCOMMODATION_FIELD_PREFIX}
                suffixes={ACCOMMODATION_FIELD_ID_SUFFIXES}
            />
        </form>
    );
}
