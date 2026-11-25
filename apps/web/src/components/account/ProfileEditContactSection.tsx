/**
 * @file ProfileEditContactSection.tsx
 * @description "Contacto y ubicación" section of the profile edit form: phone,
 * website and postal address. Presentational.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { PROFILE_FIELD_PREFIX, ProfileTextField } from './ProfileEditFields';
import type { ProfileEditFieldErrors } from './ProfileEditForm.helpers';
import styles from './ProfileEditForm.module.css';
import { Field } from './ui/Field';
import { PhoneField } from './ui/PhoneField';
import { Section } from './ui/Section';

/** Props of {@link ProfileEditContactSection}. */
export interface ProfileEditContactSectionProps {
    readonly locale: SupportedLocale;
    readonly t: (key: string, fallback?: string) => string;
    readonly phone: string;
    readonly website: string;
    readonly country: string;
    readonly province: string;
    readonly city: string;
    readonly addressLine1: string;
    readonly postalCode: string;
    readonly fieldErrors: ProfileEditFieldErrors;
    readonly submitting: boolean;
    readonly onPhoneChange: (value: string) => void;
    readonly onWebsiteChange: (value: string) => void;
    readonly onCountryChange: (value: string) => void;
    readonly onProvinceChange: (value: string) => void;
    readonly onCityChange: (value: string) => void;
    readonly onAddressLine1Change: (value: string) => void;
    readonly onPostalCodeChange: (value: string) => void;
}

/**
 * Contact section.
 *
 * @param props - See {@link ProfileEditContactSectionProps}.
 */
export function ProfileEditContactSection({
    locale,
    t,
    phone,
    website,
    country,
    province,
    city,
    addressLine1,
    postalCode,
    fieldErrors,
    submitting,
    onPhoneChange,
    onWebsiteChange,
    onCountryChange,
    onProvinceChange,
    onCityChange,
    onAddressLine1Change,
    onPostalCodeChange
}: ProfileEditContactSectionProps) {
    return (
        <Section
            title={t('account.pages.editProfile.contactSection')}
            helpId="section:profile.contact"
        >
            <div className={styles.grid}>
                <Field
                    idParts={{ prefix: PROFILE_FIELD_PREFIX, name: 'phone' }}
                    label={t('account.editProfile.fields.phone', 'Teléfono')}
                    locale={locale}
                    error={fieldErrors.phone}
                >
                    <PhoneField
                        locale={locale}
                        name="phone"
                        compact
                        value={phone}
                        onValueChange={onPhoneChange}
                        disabled={submitting}
                    />
                </Field>
                <ProfileTextField
                    name="website"
                    label={t('account.editProfile.fields.website')}
                    locale={locale}
                    type="url"
                    value={website}
                    onChange={onWebsiteChange}
                    error={fieldErrors.website}
                    placeholder="https://mipagina.com"
                    autoComplete="url"
                    disabled={submitting}
                />
                <ProfileTextField
                    name="country"
                    label={t('account.editProfile.fields.country')}
                    locale={locale}
                    value={country}
                    onChange={onCountryChange}
                    error={fieldErrors.country}
                    maxLength={100}
                    autoComplete="country-name"
                    disabled={submitting}
                />
                <ProfileTextField
                    name="province"
                    label={t('account.editProfile.fields.province')}
                    locale={locale}
                    value={province}
                    onChange={onProvinceChange}
                    error={fieldErrors.province}
                    maxLength={100}
                    autoComplete="address-level1"
                    disabled={submitting}
                />
                <ProfileTextField
                    name="city"
                    label={t('account.editProfile.fields.city')}
                    locale={locale}
                    value={city}
                    onChange={onCityChange}
                    error={fieldErrors.city}
                    maxLength={100}
                    autoComplete="address-level2"
                    disabled={submitting}
                />
                <ProfileTextField
                    name="postalCode"
                    label={t('account.editProfile.fields.postalCode')}
                    locale={locale}
                    value={postalCode}
                    onChange={onPostalCodeChange}
                    error={fieldErrors.postalCode}
                    maxLength={20}
                    autoComplete="postal-code"
                    disabled={submitting}
                />
                <ProfileTextField
                    name="addressLine1"
                    label={t('account.editProfile.fields.addressLine1')}
                    locale={locale}
                    value={addressLine1}
                    onChange={onAddressLine1Change}
                    error={fieldErrors.addressLine1}
                    maxLength={200}
                    autoComplete="address-line1"
                    disabled={submitting}
                    full
                />
            </div>
        </Section>
    );
}
