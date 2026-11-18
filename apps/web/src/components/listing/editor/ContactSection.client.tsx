/**
 * @file ContactSection.client.tsx
 * @description Contact fields of the listing owner editor (HOS-258).
 *
 * `website` is intentionally absent per SPEC-253 AC-4 — it exists on
 * `ContactInfoSchema` but is not exposed in this owner surface.
 *
 * Takes a group-level `onContactChange` rather than the generic
 * `onFieldChange`: the members belong to one `contactInfo` JSONB block, so the
 * orchestrator has to merge them into a single object before diffing and
 * sending it whole. Since HOS-1190 the DB layer MERGES that block (PostgreSQL
 * `||`) instead of replacing it, which is why an emptied field leaves this
 * section as `''` and reaches the API as an explicit `null` — under merge, an
 * omitted key would mean "keep the stored value" and the clear would be lost.
 */

import type { JSX } from 'react';
import { TextField } from '@/components/ui/TextField';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import contactStyles from './ContactSection.module.css';
import styles from './editor-fields.module.css';
import { LISTING_FIELD_PREFIX } from './field-ids';
import { ListingPhoneField } from './ListingPhoneField';
import type { ContactValues } from './listing-edit-data';
import { WhatsappControls } from './WhatsappControls';

/**
 * The venue-only WhatsApp controls (HOS-2256). Absent for the other vertical,
 * so the section renders exactly what it rendered before.
 */
export interface ContactWhatsappControls {
    /** Stored number, `''` when none. */
    readonly number: string;
    /** `''` while undecided, else `PUBLIC` or `LOGGED_IN_ONLY`. */
    readonly visibility: string;
    readonly onNumberChange: (value: string) => void;
    readonly onVisibilityChange: (value: string) => void;
}

export interface ContactSectionProps {
    readonly locale: SupportedLocale;
    readonly contact: ContactValues;
    readonly errors: Readonly<{
        'contactInfo.mobilePhone'?: string;
        'contactInfo.workPhone'?: string;
        'contactInfo.workEmail'?: string;
        'contactInfo.whatsapp'?: string;
    }>;
    readonly onContactChange: (patch: Partial<ContactValues>) => void;
    /** Venue WhatsApp number and visibility choice (HOS-2256). Omit to hide them. */
    readonly whatsapp?: ContactWhatsappControls | undefined;
}

export function ContactSection({
    locale,
    contact,
    errors,
    onContactChange,
    whatsapp
}: ContactSectionProps): JSX.Element {
    const { t } = createTranslations(locale);

    return (
        <fieldset
            className={styles.section}
            id="editor-contact"
        >
            <legend className={styles.label}>
                {t('listing.owner.editor.sections.contactInfo', 'Información de contacto')}
            </legend>
            {/* HOS-2042: these channels are published on the public listing. */}
            <p className={styles.hint}>
                {t(
                    'listing.owner.editor.contactField.publicHint',
                    'Estos datos de contacto se muestran públicamente en tu ficha.'
                )}
            </p>
            {/* HOS-371: searchable country-code combobox + local number,
                replacing the bare `type="tel"` with a static "+54..."
                placeholder. Recomposes into the same single `mobilePhone`
                string, so dirty tracking and the payload are unchanged. */}
            <ListingPhoneField
                locale={locale}
                value={contact.mobilePhone}
                onChange={(value) => onContactChange({ mobilePhone: value })}
                error={errors['contactInfo.mobilePhone']}
            />
            {/* HOS-2042: optional landline. Same pair and the same validation as
                the main phone above; stored in `contactInfo.workPhone`, never
                derived from or migrated into `mobilePhone`. */}
            <ListingPhoneField
                phoneKey="workPhone"
                locale={locale}
                value={contact.workPhone}
                onChange={(value) => onContactChange({ workPhone: value })}
                error={errors['contactInfo.workPhone']}
            />
            {whatsapp && (
                <WhatsappControls
                    locale={locale}
                    controls={whatsapp}
                    error={errors['contactInfo.whatsapp']}
                />
            )}
            {/* Visible <label>, not just an aria-label: an empty input with no
                visible text next to it reads as an anonymous box to a sighted
                user, which the per-section cards made more obvious. A visible
                label also satisfies WCAG 3.3.2 (Labels or Instructions), which
                an aria-label alone does not. */}
            <div className={contactStyles.emailField}>
                <TextField
                    prefix={LISTING_FIELD_PREFIX}
                    name="contactInfo.workEmail"
                    label={t('listing.owner.editor.contactField.workEmail', 'Email')}
                    labelClassName={contactStyles.fieldLabel}
                    className={styles.input}
                    error={errors['contactInfo.workEmail']}
                    type="email"
                    value={contact.workEmail}
                    placeholder="contacto@ejemplo.com"
                    onChange={(event) => onContactChange({ workEmail: event.target.value })}
                />
            </div>
        </fieldset>
    );
}
