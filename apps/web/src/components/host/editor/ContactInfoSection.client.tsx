/**
 * @file ContactInfoSection.client.tsx
 * @description Form section for accommodation contact info: phone, email,
 * website. Uses native HTML form elements.
 */

import type { AccommodationEditData } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './ContactInfoSection.module.css';

/** Props for ContactInfoSection. */
export interface ContactInfoSectionProps {
    readonly locale: SupportedLocale;
    readonly data: AccommodationEditData;
    readonly errors: Readonly<{
        phone?: string;
        email?: string;
        website?: string;
    }>;
    readonly onFieldChange: (field: keyof AccommodationEditData, value: string) => void;
}

/**
 * Contact information form section.
 * Renders phone, email, and website inputs.
 */
export function ContactInfoSection({
    locale,
    data,
    errors,
    onFieldChange
}: ContactInfoSectionProps) {
    const { t } = createTranslations(locale);

    return (
        <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>
                {t('host.properties.editor.section.contact', 'Contacto')}
            </legend>

            <div className={styles.field}>
                <label
                    htmlFor="acc-phone"
                    className={styles.fieldLabel}
                >
                    {t('host.properties.editor.field.phone', 'Teléfono')}
                </label>
                <input
                    id="acc-phone"
                    type="tel"
                    className={styles.fieldInput}
                    value={data.phone}
                    onChange={(e) => onFieldChange('phone', e.target.value)}
                    placeholder="+54 9 343 123 4567"
                    aria-invalid={Boolean(errors.phone)}
                    aria-describedby={errors.phone ? 'acc-phone-error' : undefined}
                />
                {errors.phone && (
                    <span
                        id="acc-phone-error"
                        className={styles.fieldError}
                        role="alert"
                    >
                        {errors.phone}
                    </span>
                )}
            </div>

            <div className={styles.field}>
                <label
                    htmlFor="acc-email"
                    className={styles.fieldLabel}
                >
                    {t('host.properties.editor.field.email', 'Email')}
                </label>
                <input
                    id="acc-email"
                    type="email"
                    className={styles.fieldInput}
                    value={data.email}
                    onChange={(e) => onFieldChange('email', e.target.value)}
                    placeholder="contacto@ejemplo.com"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? 'acc-email-error' : undefined}
                />
                {errors.email && (
                    <span
                        id="acc-email-error"
                        className={styles.fieldError}
                        role="alert"
                    >
                        {errors.email}
                    </span>
                )}
            </div>

            <div className={styles.field}>
                <label
                    htmlFor="acc-website"
                    className={styles.fieldLabel}
                >
                    {t('host.properties.editor.field.website', 'Sitio web')}
                </label>
                <input
                    id="acc-website"
                    type="url"
                    className={styles.fieldInput}
                    value={data.website}
                    onChange={(e) => onFieldChange('website', e.target.value)}
                    placeholder="https://www.ejemplo.com"
                    aria-invalid={Boolean(errors.website)}
                    aria-describedby={errors.website ? 'acc-website-error' : undefined}
                />
                {errors.website && (
                    <span
                        id="acc-website-error"
                        className={styles.fieldError}
                        role="alert"
                    >
                        {errors.website}
                    </span>
                )}
            </div>
        </fieldset>
    );
}
