/**
 * @file ProfileEditPersonalSection.tsx
 * @description "Información personal" section of the profile edit form.
 *
 * Renders: displayName, firstName, lastName, birthDate, phone, bio.
 * Pure presentational subcomponent — all state lives in
 * `ProfileEditForm.client.tsx`.
 */

import type { ProfileEditFieldErrors } from './ProfileEditForm.helpers';
import styles from './ProfileEditForm.module.css';

/** Props for the personal info section. */
export interface ProfileEditPersonalSectionProps {
    readonly displayName: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly birthDate: string;
    readonly phone: string;
    readonly bio: string;
    readonly fieldErrors: ProfileEditFieldErrors;
    readonly submitting: boolean;
    readonly t: (key: string, fallback?: string) => string;
    readonly onDisplayNameChange: (value: string) => void;
    readonly onFirstNameChange: (value: string) => void;
    readonly onLastNameChange: (value: string) => void;
    readonly onBirthDateChange: (value: string) => void;
    readonly onPhoneChange: (value: string) => void;
    readonly onBioChange: (value: string) => void;
}

/**
 * Personal info section. Includes the SPEC-113 polish addition of an
 * editable birth-date field.
 *
 * @param props - Component props (see {@link ProfileEditPersonalSectionProps})
 */
export function ProfileEditPersonalSection({
    displayName,
    firstName,
    lastName,
    birthDate,
    phone,
    bio,
    fieldErrors,
    submitting,
    t,
    onDisplayNameChange,
    onFirstNameChange,
    onLastNameChange,
    onBirthDateChange,
    onPhoneChange,
    onBioChange
}: ProfileEditPersonalSectionProps) {
    const todayIso = new Date().toISOString().split('T')[0];

    return (
        <section
            className={styles.section}
            aria-labelledby="personal-section-title"
        >
            <h3
                className={styles.sectionTitle}
                id="personal-section-title"
            >
                {t('account.pages.editProfile.personalSection', 'Información personal')}
            </h3>
            <div className={styles.grid}>
                {/* displayName */}
                <div className={`${styles.field} ${styles.fullWidth}`}>
                    <label
                        className={styles.label}
                        htmlFor="displayName"
                    >
                        {t('account.editProfile.fields.displayName', 'Nombre visible')}
                        <span
                            className={styles.required}
                            aria-hidden="true"
                        >
                            *
                        </span>
                    </label>
                    <input
                        id="displayName"
                        type="text"
                        className={`${styles.input} ${fieldErrors.displayName ? styles.inputError : ''}`}
                        value={displayName}
                        onChange={(e) => onDisplayNameChange(e.target.value)}
                        aria-required="true"
                        aria-describedby={fieldErrors.displayName ? 'displayName-error' : undefined}
                        maxLength={100}
                        autoComplete="nickname"
                        disabled={submitting}
                    />
                    {fieldErrors.displayName && (
                        <p
                            id="displayName-error"
                            className={styles.errorMsg}
                            role="alert"
                        >
                            {fieldErrors.displayName}
                        </p>
                    )}
                </div>

                {/* firstName */}
                <div className={styles.field}>
                    <label
                        className={styles.label}
                        htmlFor="firstName"
                    >
                        {t('account.editProfile.fields.firstName', 'Nombre')}
                        <span
                            className={styles.required}
                            aria-hidden="true"
                        >
                            *
                        </span>
                    </label>
                    <input
                        id="firstName"
                        type="text"
                        className={`${styles.input} ${fieldErrors.firstName ? styles.inputError : ''}`}
                        value={firstName}
                        onChange={(e) => onFirstNameChange(e.target.value)}
                        aria-required="true"
                        aria-describedby={fieldErrors.firstName ? 'firstName-error' : undefined}
                        maxLength={100}
                        autoComplete="given-name"
                        disabled={submitting}
                    />
                    {fieldErrors.firstName && (
                        <p
                            id="firstName-error"
                            className={styles.errorMsg}
                            role="alert"
                        >
                            {fieldErrors.firstName}
                        </p>
                    )}
                </div>

                {/* lastName */}
                <div className={styles.field}>
                    <label
                        className={styles.label}
                        htmlFor="lastName"
                    >
                        {t('account.editProfile.fields.lastName', 'Apellido')}
                        <span
                            className={styles.required}
                            aria-hidden="true"
                        >
                            *
                        </span>
                    </label>
                    <input
                        id="lastName"
                        type="text"
                        className={`${styles.input} ${fieldErrors.lastName ? styles.inputError : ''}`}
                        value={lastName}
                        onChange={(e) => onLastNameChange(e.target.value)}
                        aria-required="true"
                        aria-describedby={fieldErrors.lastName ? 'lastName-error' : undefined}
                        maxLength={100}
                        autoComplete="family-name"
                        disabled={submitting}
                    />
                    {fieldErrors.lastName && (
                        <p
                            id="lastName-error"
                            className={styles.errorMsg}
                            role="alert"
                        >
                            {fieldErrors.lastName}
                        </p>
                    )}
                </div>

                {/* birthDate */}
                <div className={styles.field}>
                    <label
                        className={styles.label}
                        htmlFor="birthDate"
                    >
                        {t('account.editProfile.fields.birthDate', 'Fecha de nacimiento')}
                    </label>
                    <input
                        id="birthDate"
                        type="date"
                        className={`${styles.input} ${fieldErrors.birthDate ? styles.inputError : ''}`}
                        value={birthDate}
                        onChange={(e) => onBirthDateChange(e.target.value)}
                        max={todayIso}
                        // The native date picker uses the user's OS / browser
                        // locale to decide the display format. Hinting es-AR
                        // nudges Chromium-based browsers towards dd/mm/yyyy.
                        lang="es-AR"
                        aria-describedby={
                            fieldErrors.birthDate ? 'birthDate-error' : 'birthDate-hint'
                        }
                        disabled={submitting}
                    />
                    {fieldErrors.birthDate ? (
                        <p
                            id="birthDate-error"
                            className={styles.errorMsg}
                            role="alert"
                        >
                            {fieldErrors.birthDate}
                        </p>
                    ) : (
                        <p
                            id="birthDate-hint"
                            className={styles.hint}
                        >
                            {t('account.editProfile.fields.birthDateHint', 'Formato: dd/mm/yyyy.')}
                        </p>
                    )}
                </div>

                {/* phone */}
                <div className={styles.field}>
                    <label
                        className={styles.label}
                        htmlFor="phone"
                    >
                        {t('account.editProfile.fields.phone', 'Teléfono')}
                    </label>
                    <input
                        id="phone"
                        type="tel"
                        className={`${styles.input} ${fieldErrors.phone ? styles.inputError : ''}`}
                        value={phone}
                        onChange={(e) => onPhoneChange(e.target.value)}
                        aria-describedby={fieldErrors.phone ? 'phone-error' : 'phone-hint'}
                        autoComplete="tel"
                        disabled={submitting}
                    />
                    {fieldErrors.phone ? (
                        <p
                            id="phone-error"
                            className={styles.errorMsg}
                            role="alert"
                        >
                            {fieldErrors.phone}
                        </p>
                    ) : (
                        <p
                            id="phone-hint"
                            className={styles.hint}
                        >
                            {t(
                                'account.editProfile.fields.phoneHint',
                                'Formato E.164: +541134567890'
                            )}
                        </p>
                    )}
                </div>

                {/* bio */}
                <div className={`${styles.field} ${styles.fullWidth}`}>
                    <label
                        className={styles.label}
                        htmlFor="bio"
                    >
                        {t('account.editProfile.fields.bio', 'Biografía')}
                    </label>
                    <textarea
                        id="bio"
                        className={`${styles.textarea} ${fieldErrors.bio ? styles.inputError : ''}`}
                        value={bio}
                        onChange={(e) => onBioChange(e.target.value)}
                        aria-describedby={fieldErrors.bio ? 'bio-error' : 'bio-hint'}
                        maxLength={1000}
                        rows={4}
                        disabled={submitting}
                    />
                    {fieldErrors.bio ? (
                        <p
                            id="bio-error"
                            className={styles.errorMsg}
                            role="alert"
                        >
                            {fieldErrors.bio}
                        </p>
                    ) : (
                        <p
                            id="bio-hint"
                            className={styles.hint}
                        >
                            {bio.length}/1000
                        </p>
                    )}
                </div>
            </div>
        </section>
    );
}
