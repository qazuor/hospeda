/**
 * @file ProfileCompletionContactFields.tsx
 * @description Pure presentational subcomponent for the ProfileCompletion island.
 *
 * Renders the contact fields: phone (country code + number), locale
 * preference, and theme preference (HOS-313 — optional, not applied live;
 * only takes effect once the parent island's submit succeeds). Newsletter
 * opt-in and terms acceptance live in {@link ./ProfileCompletionConsentFields}.
 *
 * All state lives in `ProfileCompletion.client.tsx`. This component is a pure
 * controlled presentation layer built from kit fields (HOS-2501). Not a
 * `.client.tsx`: it mounts inside the already-hydrated parent island.
 */

import type { FieldErrors } from '@/lib/forms/field-errors';
import type { SupportedLocale } from '@/lib/i18n';
import type { SupportedTheme } from './ProfileCompletion.helpers';
import styles from './ProfileCompletion.module.css';
import { PcSelectField } from './ProfileCompletionFields';
import { Field, PhoneField } from './ui';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Props for the contact-fields subcomponent. */
export interface ProfileCompletionContactFieldsProps {
    /** Active locale, for the kit fields' fixed copy. */
    readonly locale: SupportedLocale;
    /** Complete E.164 phone value. */
    readonly phone: string;
    /** Currently selected locale preference. */
    readonly selectedLocale: SupportedLocale;
    /** Currently selected theme preference. */
    readonly selectedTheme: SupportedTheme;
    /** Field-level errors from the parent. */
    readonly errors: FieldErrors;
    /** Whether the form is currently submitting (disables all inputs). */
    readonly submitting: boolean;
    /** Translation function from the parent island. */
    readonly t: (key: string, fallback: string) => string;
    /** Handler for the complete phone value. */
    readonly onPhoneChange: (value: string) => void;
    /** Handler for locale selection change. */
    readonly onLocaleChange: (value: SupportedLocale) => void;
    /**
     * Handler for theme selection change. Only updates local form state — the
     * theme is NOT applied live (HOS-313): changing it here must not re-render
     * the page mid-fill. The parent applies it after a successful submit.
     */
    readonly onThemeChange: (value: SupportedTheme) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Contact fields subcomponent.
 *
 * @param props - Component props (see {@link ProfileCompletionContactFieldsProps})
 */
export function ProfileCompletionContactFields({
    locale,
    phone,
    selectedLocale,
    selectedTheme,
    errors,
    submitting,
    t,
    onPhoneChange,
    onLocaleChange,
    onThemeChange
}: ProfileCompletionContactFieldsProps) {
    return (
        <div className={styles.grid}>
            {/* ── Phone ──────────────────────────────────────────────── */}
            <Field
                label={t('account.profileCompletion.fields.phone', 'Teléfono')}
                locale={locale}
                idParts={{ prefix: 'pc', name: 'phone' }}
                error={errors.phone}
                hint={t(
                    'account.profileCompletion.fields.phoneHint',
                    'Opcional. Incluí el código de país.'
                )}
                className={styles.full}
            >
                <PhoneField
                    locale={locale}
                    countryId="pc-phoneCode"
                    value={phone}
                    onValueChange={onPhoneChange}
                    placeholder={t(
                        'account.profileCompletion.fields.phonePlaceholder',
                        '9 11 1234-5678'
                    )}
                    autoComplete="tel-national"
                    disabled={submitting}
                />
            </Field>

            {/* ── Preferred locale ──────────────────────────────────── */}
            <PcSelectField
                name="locale"
                label={t('account.profileCompletion.fields.locale', 'Idioma preferido')}
                locale={locale}
                value={selectedLocale}
                onChange={(value) => onLocaleChange(value as SupportedLocale)}
                disabled={submitting}
                options={[
                    {
                        value: 'es',
                        label: t('account.profileCompletion.fields.localeEs', 'Español')
                    },
                    {
                        value: 'en',
                        label: t('account.profileCompletion.fields.localeEn', 'English')
                    },
                    {
                        value: 'pt',
                        label: t('account.profileCompletion.fields.localePt', 'Português')
                    }
                ]}
            />

            {/* ── Preferred theme ───────────────────────────────────── */}
            <PcSelectField
                name="theme"
                label={t('account.profileCompletion.fields.theme', 'Tema preferido')}
                locale={locale}
                value={selectedTheme}
                onChange={(value) => onThemeChange(value as SupportedTheme)}
                disabled={submitting}
                hint={t(
                    'account.profileCompletion.fields.themeHint',
                    'Opcional. Se aplica al guardar el perfil.'
                )}
                options={[
                    {
                        value: 'system',
                        label: t('account.profileCompletion.fields.themeSystem', 'Sistema')
                    },
                    {
                        value: 'light',
                        label: t('account.profileCompletion.fields.themeLight', 'Claro')
                    },
                    {
                        value: 'dark',
                        label: t('account.profileCompletion.fields.themeDark', 'Oscuro')
                    }
                ]}
            />
        </div>
    );
}
