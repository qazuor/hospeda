/**
 * @file ProfileCompletionContactFields.tsx
 * @description Pure presentational subcomponent for the ProfileCompletion island.
 *
 * Renders: phone (country code + number), locale dropdown, newsletter
 * opt-in, and terms acceptance checkboxes.
 *
 * All state lives in `ProfileCompletion.client.tsx`. This component is
 * a pure controlled presentation layer.
 *
 * Not a `.client.tsx` — mounts inside the already-hydrated parent island.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { COUNTRY_CODES, type ProfileCompletionFieldErrors } from './ProfileCompletion.helpers';
import styles from './ProfileCompletion.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Props for the contact-fields subcomponent. */
export interface ProfileCompletionContactFieldsProps {
    /** Active locale — used for the terms link URL. */
    readonly locale: SupportedLocale;
    /** Selected phone country code (e.g. '+54'). */
    readonly phoneCode: string;
    /** Phone number (without country code). */
    readonly phoneNumber: string;
    /** Currently selected locale preference. */
    readonly selectedLocale: SupportedLocale;
    /** Whether newsletter opt-in is checked. */
    readonly newsletter: boolean;
    /** Whether terms checkbox is checked. */
    readonly acceptedTerms: boolean;
    /** Field-level errors from the parent. */
    readonly errors: ProfileCompletionFieldErrors;
    /** Whether the form is currently submitting (disables all inputs). */
    readonly submitting: boolean;
    /** Translation function from the parent island. */
    readonly t: (key: string, fallback: string) => string;
    /** Handler for phone country code change. */
    readonly onPhoneCodeChange: (value: string) => void;
    /** Handler for phone number change. */
    readonly onPhoneNumberChange: (value: string) => void;
    /** Handler for locale selection change. */
    readonly onLocaleChange: (value: SupportedLocale) => void;
    /** Handler for newsletter checkbox change. */
    readonly onNewsletterChange: (checked: boolean) => void;
    /** Handler for terms checkbox change. */
    readonly onAcceptedTermsChange: (checked: boolean) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Contact and preference fields subcomponent.
 *
 * Renders phone, locale, newsletter, and terms fields as controlled inputs.
 * Error messages are rendered as passed-in strings (the parent maps i18n keys
 * to translated messages before passing them down via `errors`).
 *
 * @param props - Component props (see {@link ProfileCompletionContactFieldsProps})
 */
export function ProfileCompletionContactFields({
    locale,
    phoneCode,
    phoneNumber,
    selectedLocale,
    newsletter,
    acceptedTerms,
    errors,
    submitting,
    t,
    onPhoneCodeChange,
    onPhoneNumberChange,
    onLocaleChange,
    onNewsletterChange,
    onAcceptedTermsChange
}: ProfileCompletionContactFieldsProps) {
    return (
        <>
            {/* ── Phone ──────────────────────────────────────────────── */}
            <div className={styles.field}>
                <label
                    htmlFor="pc-phone"
                    className={styles.label}
                >
                    {t('account.profileCompletion.fields.phone', 'Teléfono')}
                </label>
                <div className={styles.phoneRow}>
                    <select
                        id="pc-phoneCode"
                        className={`${styles.select} ${styles.phoneCode}`}
                        value={phoneCode}
                        onChange={(e) => onPhoneCodeChange(e.target.value)}
                        disabled={submitting}
                        aria-label={t(
                            'account.profileCompletion.fields.phoneCodeLabel',
                            'Código de país'
                        )}
                    >
                        {COUNTRY_CODES.map((cc) => (
                            <option
                                key={cc.code}
                                value={cc.code}
                            >
                                {cc.label}
                            </option>
                        ))}
                    </select>
                    <input
                        id="pc-phone"
                        type="tel"
                        className={
                            errors.phone
                                ? `${styles.input} ${styles.inputError} ${styles.phoneNumber}`
                                : `${styles.input} ${styles.phoneNumber}`
                        }
                        value={phoneNumber}
                        onChange={(e) => onPhoneNumberChange(e.target.value)}
                        placeholder={t(
                            'account.profileCompletion.fields.phonePlaceholder',
                            '9 11 1234-5678'
                        )}
                        aria-describedby={errors.phone ? 'pc-phone-error' : 'pc-phone-hint'}
                        autoComplete="tel-national"
                        disabled={submitting}
                    />
                </div>
                {errors.phone ? (
                    <p
                        id="pc-phone-error"
                        className={styles.errorMsg}
                        role="alert"
                    >
                        {errors.phone}
                    </p>
                ) : (
                    <p
                        id="pc-phone-hint"
                        className={styles.hint}
                    >
                        {t(
                            'account.profileCompletion.fields.phoneHint',
                            'Opcional. Incluí el código de país.'
                        )}
                    </p>
                )}
            </div>

            {/* ── Preferred locale ──────────────────────────────────── */}
            <div className={styles.field}>
                <label
                    htmlFor="pc-locale"
                    className={styles.label}
                >
                    {t('account.profileCompletion.fields.locale', 'Idioma preferido')}
                </label>
                <select
                    id="pc-locale"
                    className={styles.select}
                    value={selectedLocale}
                    onChange={(e) => onLocaleChange(e.target.value as SupportedLocale)}
                    disabled={submitting}
                >
                    <option value="es">
                        {t('account.profileCompletion.fields.localeEs', 'Español')}
                    </option>
                    <option value="en">
                        {t('account.profileCompletion.fields.localeEn', 'English')}
                    </option>
                    <option value="pt">
                        {t('account.profileCompletion.fields.localePt', 'Português')}
                    </option>
                </select>
            </div>

            {/* ── Newsletter opt-in ─────────────────────────────────── */}
            <label className={styles.checkboxRow}>
                <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={newsletter}
                    onChange={(e) => onNewsletterChange(e.target.checked)}
                    disabled={submitting}
                />
                <span className={styles.checkboxLabel}>
                    {t(
                        'account.profileCompletion.fields.newsletter',
                        'Quiero recibir novedades y promociones por email'
                    )}
                </span>
            </label>

            {/* ── Terms acceptance ──────────────────────────────────── */}
            <div className={styles.field}>
                <label className={styles.checkboxRow}>
                    <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={acceptedTerms}
                        onChange={(e) => onAcceptedTermsChange(e.target.checked)}
                        aria-required="true"
                        aria-describedby={errors.terms ? 'pc-terms-error' : undefined}
                        disabled={submitting}
                    />
                    <span className={styles.checkboxLabel}>
                        {t('account.profileCompletion.fields.terms', 'Acepto los')}{' '}
                        <a
                            href={`/${locale}/legal/terminos/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.checkboxLink}
                        >
                            {t(
                                'account.profileCompletion.fields.termsLink',
                                'términos y condiciones'
                            )}
                        </a>
                    </span>
                </label>
                {errors.terms && (
                    <p
                        id="pc-terms-error"
                        className={styles.errorMsg}
                        role="alert"
                    >
                        {errors.terms}
                    </p>
                )}
            </div>
        </>
    );
}
