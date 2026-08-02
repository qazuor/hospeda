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
import { FieldError, fieldErrorId } from '@/components/ui/FieldError';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { ContactValues } from './commerce-edit-data';
import styles from './editor-fields.module.css';

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
            <input
                className={styles.input}
                type="tel"
                aria-label={t('commerce.owner.editor.contactField.mobilePhone', 'Teléfono')}
                value={contact.mobilePhone}
                placeholder="+54..."
                aria-invalid={errors['contactInfo.mobilePhone'] ? 'true' : 'false'}
                aria-describedby={
                    errors['contactInfo.mobilePhone']
                        ? fieldErrorId('contactInfo.mobilePhone')
                        : undefined
                }
                onChange={(event) => onContactChange({ mobilePhone: event.target.value })}
            />
            <FieldError
                id={fieldErrorId('contactInfo.mobilePhone')}
                message={errors['contactInfo.mobilePhone']}
            />
            <input
                className={styles.input}
                type="email"
                aria-label={t('commerce.owner.editor.contactField.workEmail', 'Email')}
                value={contact.workEmail}
                aria-invalid={errors['contactInfo.workEmail'] ? 'true' : 'false'}
                aria-describedby={
                    errors['contactInfo.workEmail']
                        ? fieldErrorId('contactInfo.workEmail')
                        : undefined
                }
                onChange={(event) => onContactChange({ workEmail: event.target.value })}
            />
            <FieldError
                id={fieldErrorId('contactInfo.workEmail')}
                message={errors['contactInfo.workEmail']}
            />
        </fieldset>
    );
}
