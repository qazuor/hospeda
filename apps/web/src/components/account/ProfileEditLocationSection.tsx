/**
 * @file ProfileEditLocationSection.tsx
 * @description Postal address section for the profile edit form — country,
 * province, city, addressLine1, postalCode. Pure presentational
 * subcomponent — all state lives in `ProfileEditForm.client.tsx`.
 *
 * Introduced in the SPEC-113 polish round.
 */

import type { ProfileEditFieldErrors } from './ProfileEditForm.helpers';
import styles from './ProfileEditForm.module.css';

/** Props for the location section. */
export interface ProfileEditLocationSectionProps {
    readonly country: string;
    readonly province: string;
    readonly city: string;
    readonly addressLine1: string;
    readonly postalCode: string;
    readonly fieldErrors: ProfileEditFieldErrors;
    readonly submitting: boolean;
    readonly t: (key: string, fallback?: string) => string;
    readonly onCountryChange: (value: string) => void;
    readonly onProvinceChange: (value: string) => void;
    readonly onCityChange: (value: string) => void;
    readonly onAddressLine1Change: (value: string) => void;
    readonly onPostalCodeChange: (value: string) => void;
}

interface AddressFieldProps {
    readonly id: string;
    readonly label: string;
    readonly value: string;
    readonly maxLength: number;
    readonly autoComplete: string;
    readonly submitting: boolean;
    readonly error: string | undefined;
    readonly fullWidth?: boolean;
    readonly onChange: (value: string) => void;
}

function AddressField({
    id,
    label,
    value,
    maxLength,
    autoComplete,
    submitting,
    error,
    fullWidth,
    onChange
}: AddressFieldProps) {
    const cls = `${styles.field} ${fullWidth ? styles.fullWidth : ''}`.trim();
    return (
        <div className={cls}>
            <label
                className={styles.label}
                htmlFor={id}
            >
                {label}
            </label>
            <input
                id={id}
                type="text"
                className={`${styles.input} ${error ? styles.inputError : ''}`}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                maxLength={maxLength}
                autoComplete={autoComplete}
                aria-describedby={error ? `${id}-error` : undefined}
                disabled={submitting}
            />
            {error && (
                <p
                    id={`${id}-error`}
                    className={styles.errorMsg}
                    role="alert"
                >
                    {error}
                </p>
            )}
        </div>
    );
}

/**
 * Renders the postal address inputs.
 *
 * @param props - Component props (see {@link ProfileEditLocationSectionProps})
 */
export function ProfileEditLocationSection({
    country,
    province,
    city,
    addressLine1,
    postalCode,
    fieldErrors,
    submitting,
    t,
    onCountryChange,
    onProvinceChange,
    onCityChange,
    onAddressLine1Change,
    onPostalCodeChange
}: ProfileEditLocationSectionProps) {
    return (
        <section
            className={styles.section}
            aria-labelledby="location-section-title"
        >
            <h3
                className={styles.sectionTitle}
                id="location-section-title"
            >
                {t('account.pages.editProfile.locationSection', 'Ubicación')}
            </h3>
            <div className={styles.grid}>
                <AddressField
                    id="country"
                    label={t('account.editProfile.fields.country', 'País')}
                    value={country}
                    maxLength={100}
                    autoComplete="country-name"
                    submitting={submitting}
                    error={fieldErrors.country}
                    onChange={onCountryChange}
                />
                <AddressField
                    id="province"
                    label={t('account.editProfile.fields.province', 'Provincia / Región')}
                    value={province}
                    maxLength={100}
                    autoComplete="address-level1"
                    submitting={submitting}
                    error={fieldErrors.province}
                    onChange={onProvinceChange}
                />
                <AddressField
                    id="city"
                    label={t('account.editProfile.fields.city', 'Ciudad')}
                    value={city}
                    maxLength={100}
                    autoComplete="address-level2"
                    submitting={submitting}
                    error={fieldErrors.city}
                    onChange={onCityChange}
                />
                <AddressField
                    id="postalCode"
                    label={t('account.editProfile.fields.postalCode', 'Código postal')}
                    value={postalCode}
                    maxLength={20}
                    autoComplete="postal-code"
                    submitting={submitting}
                    error={fieldErrors.postalCode}
                    onChange={onPostalCodeChange}
                />
                <AddressField
                    id="addressLine1"
                    label={t('account.editProfile.fields.addressLine1', 'Dirección')}
                    value={addressLine1}
                    maxLength={200}
                    autoComplete="address-line1"
                    submitting={submitting}
                    error={fieldErrors.addressLine1}
                    fullWidth
                    onChange={onAddressLine1Change}
                />
            </div>
        </section>
    );
}
