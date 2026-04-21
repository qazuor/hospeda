/**
 * @file PropertyFormContact.client.tsx
 * @description Section 7 — Contact info fields for the PropertyForm wizard.
 *
 * ContactInfoSchema fields:
 *   - mobilePhone (required — international format regex)
 *   - personalEmail (optional)
 *   - workEmail (optional)
 *   - homePhone (optional)
 *   - workPhone (optional)
 *   - website (optional)
 *   - preferredEmail (optional — PreferredContactEnum: HOME | WORK | MOBILE)
 *   - preferredPhone (optional — same enum)
 *
 * For MVP: mobilePhone (required) + personalEmail + preferredPhone are exposed.
 * Other optional fields deferred to a later iteration.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { PreferredContactEnum } from '@repo/schemas';
import styles from './PropertyForm.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props for PropertyFormContact. */
export type PropertyFormContactProps = {
    /** Current mobilePhone from form state (required field). */
    readonly mobilePhone: string | undefined;
    /** Current personalEmail from form state (optional). */
    readonly personalEmail: string | undefined;
    /** Current preferredPhone from form state (optional). */
    readonly preferredPhone: string | undefined;
    /** Called when mobilePhone changes. */
    readonly onMobilePhoneChange: (value: string) => void;
    /** Called when personalEmail changes. */
    readonly onPersonalEmailChange: (value: string) => void;
    /** Called when preferredPhone changes. */
    readonly onPreferredPhoneChange: (value: string) => void;
    /** Called on blur — triggers autosave. */
    readonly onBlur: () => void;
    /** Validation error for contactInfo.mobilePhone. */
    readonly mobilePhoneError?: string;
    /** Validation error for contactInfo.personalEmail. */
    readonly personalEmailError?: string;
    /** Active locale for i18n strings. */
    readonly locale: SupportedLocale;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Section 7 — Contact info for the PropertyForm wizard.
 *
 * Exposes the required mobilePhone field plus optional personalEmail and
 * preferredPhone. Uses i18n keys under `host.form.sections.contacto.fields.*`.
 *
 * @example
 * ```tsx
 * <PropertyFormContact
 *   mobilePhone={form.values.contactInfo?.mobilePhone}
 *   personalEmail={form.values.contactInfo?.personalEmail}
 *   preferredPhone={form.values.contactInfo?.preferredPhone}
 *   onMobilePhoneChange={(v) => form.setValue('contactInfo.mobilePhone', v)}
 *   onPersonalEmailChange={(v) => form.setValue('contactInfo.personalEmail', v)}
 *   onPreferredPhoneChange={(v) => form.setValue('contactInfo.preferredPhone', v)}
 *   onBlur={handleBlur}
 *   locale={locale}
 * />
 * ```
 */
export function PropertyFormContact({
    mobilePhone,
    personalEmail,
    preferredPhone,
    onMobilePhoneChange,
    onPersonalEmailChange,
    onPreferredPhoneChange,
    onBlur,
    mobilePhoneError,
    personalEmailError,
    locale
}: PropertyFormContactProps) {
    const { t } = createTranslations(locale);

    return (
        <div className={styles.fieldGroup}>
            {/* Mobile phone — required */}
            <div className={styles.field}>
                <label
                    className={`${styles.label} ${styles.labelRequired}`}
                    htmlFor="field-mobile-phone"
                >
                    {t('host.form.sections.contacto.fields.mobilePhone', 'Teléfono móvil')}
                </label>
                <input
                    id="field-mobile-phone"
                    type="tel"
                    className={`${styles.input} ${mobilePhoneError ? styles.inputError : ''}`}
                    value={mobilePhone ?? ''}
                    onChange={(e) => onMobilePhoneChange(e.target.value)}
                    onBlur={onBlur}
                    aria-required="true"
                    aria-describedby={mobilePhoneError ? 'error-mobile-phone' : undefined}
                    placeholder={t(
                        'host.form.sections.contacto.fields.mobilePhonePlaceholder',
                        'Ej: +5493442123456'
                    )}
                    autoComplete="tel"
                />
                {mobilePhoneError && (
                    <p
                        id="error-mobile-phone"
                        className={styles.fieldError}
                        role="alert"
                    >
                        {mobilePhoneError}
                    </p>
                )}
            </div>

            {/* Personal email — optional */}
            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor="field-personal-email"
                >
                    {t('host.form.sections.contacto.fields.email', 'Email de contacto')}
                </label>
                <input
                    id="field-personal-email"
                    type="email"
                    className={`${styles.input} ${personalEmailError ? styles.inputError : ''}`}
                    value={personalEmail ?? ''}
                    onChange={(e) => onPersonalEmailChange(e.target.value)}
                    onBlur={onBlur}
                    aria-describedby={personalEmailError ? 'error-personal-email' : undefined}
                    placeholder={t(
                        'host.form.sections.contacto.fields.emailPlaceholder',
                        'tu@email.com'
                    )}
                    autoComplete="email"
                />
                {personalEmailError && (
                    <p
                        id="error-personal-email"
                        className={styles.fieldError}
                        role="alert"
                    >
                        {personalEmailError}
                    </p>
                )}
            </div>

            {/* Preferred phone contact method — optional */}
            <div
                className={styles.field}
                style={{ maxWidth: '240px' }}
            >
                <label
                    className={styles.label}
                    htmlFor="field-preferred-phone"
                >
                    {t(
                        'host.form.sections.contacto.fields.preferredPhone',
                        'Preferencia de contacto telefónico'
                    )}
                </label>
                <select
                    id="field-preferred-phone"
                    className={styles.select}
                    value={preferredPhone ?? ''}
                    onChange={(e) => onPreferredPhoneChange(e.target.value)}
                    onBlur={onBlur}
                >
                    <option value="">
                        {t(
                            'host.form.sections.contacto.fields.preferredPhonePlaceholder',
                            'Sin preferencia'
                        )}
                    </option>
                    {Object.values(PreferredContactEnum).map((val) => (
                        <option
                            key={val}
                            value={val}
                        >
                            {val}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
