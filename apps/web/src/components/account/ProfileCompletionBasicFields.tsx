/**
 * @file ProfileCompletionBasicFields.tsx
 * @description Pure presentational subcomponent for the ProfileCompletion island.
 *
 * Renders: avatar preview, firstName, lastName, displayName (auto-derived +
 * editable), and birthDate fields. All state is owned by the parent island
 * `ProfileCompletion.client.tsx`; this component receives only props.
 *
 * Not a `.client.tsx` — it mounts inside the already-hydrated parent island
 * and does not need its own Astro client directive.
 */

import type { SupportedLocale } from '@/lib/i18n';
import type { ProfileCompletionFieldErrors } from './ProfileCompletion.helpers';
import styles from './ProfileCompletion.module.css';
import { ProfileCompletionAvatarPicker } from './ProfileCompletionAvatarPicker';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Props for the basic-fields subcomponent. */
export interface ProfileCompletionBasicFieldsProps {
    /** Active locale (passed to build date max via ISO string). */
    readonly locale: SupportedLocale;
    /** API base URL — forwarded to the avatar picker. */
    readonly apiUrl: string;
    /** Current first name value. */
    readonly firstName: string;
    /** Current last name value. */
    readonly lastName: string;
    /**
     * Value shown in the displayName input. When the user has not overridden
     * it, the parent passes the auto-derived value here.
     */
    readonly displayNameValue: string;
    /** Current birth date string (YYYY-MM-DD or empty). */
    readonly birthDate: string;
    /** Current avatar URL (empty if none). */
    readonly imageUrl: string;
    /** Initial OAuth avatar URL — used only for comparison in parent. */
    readonly initialAvatarUrl: string | undefined;
    /** Field-level validation errors from the parent. */
    readonly errors: ProfileCompletionFieldErrors;
    /** Whether the form is currently submitting (disables all inputs). */
    readonly submitting: boolean;
    /** Translation function from the parent island. */
    readonly t: (key: string, fallback: string) => string;
    /** Handler for firstName changes (parent manages display-name sync). */
    readonly onFirstNameChange: (value: string) => void;
    /** Handler for lastName changes (parent manages display-name sync). */
    readonly onLastNameChange: (value: string) => void;
    /** Handler for displayName changes. */
    readonly onDisplayNameChange: (value: string) => void;
    /** Handler for birthDate changes. */
    readonly onBirthDateChange: (value: string) => void;
    /** Handler for avatar URL changes. */
    readonly onImageUrlChange: (value: string) => void;
    /** Auto-derived display name (used as placeholder fallback). */
    readonly derivedDisplayName: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Basic profile fields subcomponent.
 *
 * Displays avatar preview, name fields, auto-derived display name, and
 * birth date. Pure controlled component — all state lives in the parent.
 *
 * @param props - Component props (see {@link ProfileCompletionBasicFieldsProps})
 */
export function ProfileCompletionBasicFields({
    apiUrl,
    firstName,
    lastName,
    displayNameValue,
    birthDate,
    imageUrl,
    errors,
    submitting,
    t,
    onFirstNameChange,
    onLastNameChange,
    onDisplayNameChange,
    onBirthDateChange,
    onImageUrlChange,
    derivedDisplayName
}: ProfileCompletionBasicFieldsProps) {
    return (
        <>
            {/* ── Avatar preview ─────────────────────────────────────── */}
            <div className={styles.avatarSection}>
                <div className={styles.avatarPreview}>
                    {imageUrl ? (
                        <img
                            src={imageUrl}
                            alt={t('account.profileCompletion.avatar.alt', 'Avatar')}
                            className={styles.avatarImg}
                        />
                    ) : (
                        <span
                            className={styles.avatarInitials}
                            aria-hidden="true"
                        >
                            {(firstName[0] ?? '?').toUpperCase()}
                        </span>
                    )}
                </div>
                <div>
                    <p className={styles.avatarHint}>
                        {t('account.profileCompletion.avatar.hint', 'Tu foto de perfil')}
                    </p>
                    <ProfileCompletionAvatarPicker
                        apiUrl={apiUrl}
                        disabled={submitting}
                        t={t}
                        onUploaded={onImageUrlChange}
                    />
                </div>
            </div>

            {/* ── First name + Last name (side by side) ────────────────── */}
            <div className={styles.fieldRow}>
                <div className={styles.field}>
                    <label
                        htmlFor="pc-firstName"
                        className={styles.label}
                    >
                        {t('account.profileCompletion.fields.firstName', 'Nombre')}
                        <span
                            className={styles.required}
                            aria-hidden="true"
                        >
                            {' *'}
                        </span>
                    </label>
                    <input
                        id="pc-firstName"
                        type="text"
                        className={
                            errors.firstName ? `${styles.input} ${styles.inputError}` : styles.input
                        }
                        value={firstName}
                        onChange={(e) => onFirstNameChange(e.target.value)}
                        placeholder={t(
                            'account.profileCompletion.fields.firstNamePlaceholder',
                            'Tu nombre'
                        )}
                        aria-required="true"
                        aria-describedby={errors.firstName ? 'pc-firstName-error' : undefined}
                        autoComplete="given-name"
                        disabled={submitting}
                    />
                    {errors.firstName && (
                        <p
                            id="pc-firstName-error"
                            className={styles.errorMsg}
                            role="alert"
                        >
                            {errors.firstName}
                        </p>
                    )}
                </div>

                <div className={styles.field}>
                    <label
                        htmlFor="pc-lastName"
                        className={styles.label}
                    >
                        {t('account.profileCompletion.fields.lastName', 'Apellido')}
                        <span
                            className={styles.required}
                            aria-hidden="true"
                        >
                            {' *'}
                        </span>
                    </label>
                    <input
                        id="pc-lastName"
                        type="text"
                        className={
                            errors.lastName ? `${styles.input} ${styles.inputError}` : styles.input
                        }
                        value={lastName}
                        onChange={(e) => onLastNameChange(e.target.value)}
                        placeholder={t(
                            'account.profileCompletion.fields.lastNamePlaceholder',
                            'Tu apellido'
                        )}
                        aria-required="true"
                        aria-describedby={errors.lastName ? 'pc-lastName-error' : undefined}
                        autoComplete="family-name"
                        disabled={submitting}
                    />
                    {errors.lastName && (
                        <p
                            id="pc-lastName-error"
                            className={styles.errorMsg}
                            role="alert"
                        >
                            {errors.lastName}
                        </p>
                    )}
                </div>
            </div>

            {/* ── Display name (auto-derived, editable) ────────────────── */}
            <div className={styles.field}>
                <label
                    htmlFor="pc-displayName"
                    className={styles.label}
                >
                    {t(
                        'account.profileCompletion.fields.displayName',
                        '¿Cómo querés que te llamemos?'
                    )}
                </label>
                <input
                    id="pc-displayName"
                    type="text"
                    className={styles.input}
                    value={displayNameValue}
                    onChange={(e) => onDisplayNameChange(e.target.value)}
                    placeholder={derivedDisplayName || 'Nombre Apellido'}
                    autoComplete="nickname"
                    disabled={submitting}
                />
                <p className={styles.hint}>
                    {t(
                        'account.profileCompletion.fields.displayNameHelper',
                        'Auto-derivado de tu nombre y apellido, podés editarlo.'
                    )}
                </p>
            </div>

            {/* ── Birth date ────────────────────────────────────────────── */}
            <div className={styles.field}>
                <label
                    htmlFor="pc-birthDate"
                    className={styles.label}
                >
                    {t('account.profileCompletion.fields.birthDate', 'Fecha de nacimiento')}
                </label>
                <input
                    id="pc-birthDate"
                    type="date"
                    className={styles.input}
                    value={birthDate}
                    onChange={(e) => onBirthDateChange(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    disabled={submitting}
                    // The native date picker uses the user's OS / browser
                    // locale to decide the display format. Hinting es-AR
                    // nudges Chromium-based browsers towards dd/mm/yyyy.
                    lang="es-AR"
                    aria-describedby="pc-birthDate-hint"
                />
                <p
                    id="pc-birthDate-hint"
                    className={styles.hint}
                >
                    {t(
                        'account.profileCompletion.fields.birthDateHint',
                        'Opcional. Formato: dd/mm/yyyy.'
                    )}
                </p>
            </div>
        </>
    );
}
