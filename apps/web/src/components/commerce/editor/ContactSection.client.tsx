/**
 * @file ContactSection.client.tsx
 * @description Contact fields of the commerce owner editor (HOS-258).
 *
 * `website` is intentionally absent per SPEC-253 AC-4 — it exists on
 * `ContactInfoSchema` but is not exposed in this owner surface.
 *
 * Takes a group-level `onContactChange` rather than the generic
 * `onFieldChange`: the API replaces the whole `contactInfo` JSONB block, so the
 * orchestrator has to merge members into one object before diffing.
 */

import type { JSX } from 'react';
import { TextField } from '@/components/ui/TextField';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { CommercePhoneField } from './CommercePhoneField';
import contactStyles from './ContactSection.module.css';
import type { ContactValues } from './commerce-edit-data';
import styles from './editor-fields.module.css';
import { COMMERCE_FIELD_PREFIX } from './field-ids';

export interface ContactSectionProps {
    readonly locale: SupportedLocale;
    readonly contact: ContactValues;
    readonly errors: Readonly<{
        'contactInfo.mobilePhone'?: string;
        'contactInfo.workEmail'?: string;
    }>;
    readonly onContactChange: (patch: Partial<ContactValues>) => void;
}

export function ContactSection({
    locale,
    contact,
    errors,
    onContactChange
}: ContactSectionProps): JSX.Element {
    const { t } = createTranslations(locale);

    return (
        <fieldset
            className={styles.section}
            id="editor-contact"
        >
            <legend className={styles.label}>
                {t('commerce.owner.editor.sections.contactInfo', 'Información de contacto')}
            </legend>
            {/* HOS-371: searchable country-code combobox + local number,
                replacing the bare `type="tel"` with a static "+54..."
                placeholder. Recomposes into the same single `mobilePhone`
                string, so dirty tracking and the payload are unchanged. */}
            <CommercePhoneField
                locale={locale}
                value={contact.mobilePhone}
                onChange={(value) => onContactChange({ mobilePhone: value })}
                error={errors['contactInfo.mobilePhone']}
            />
            {/* Visible <label>, not just an aria-label: an empty input with no
                visible text next to it reads as an anonymous box to a sighted
                user, which the per-section cards made more obvious. A visible
                label also satisfies WCAG 3.3.2 (Labels or Instructions), which
                an aria-label alone does not. */}
            <div className={contactStyles.emailField}>
                <TextField
                    prefix={COMMERCE_FIELD_PREFIX}
                    name="contactInfo.workEmail"
                    label={t('commerce.owner.editor.contactField.workEmail', 'Email')}
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
