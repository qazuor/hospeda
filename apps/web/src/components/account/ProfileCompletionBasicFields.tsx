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

import { CalendarIcon } from '@repo/icons';
import { useEffect, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { enUS as enLocale, es as esLocale, ptBR as ptLocale } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import type { SupportedLocale } from '@/lib/i18n';
import { type ProfileCompletionFieldErrors, ddmmyyyyToDate } from './ProfileCompletion.helpers';
import styles from './ProfileCompletion.module.css';
import { ProfileCompletionAvatarPicker } from './ProfileCompletionAvatarPicker';

const DAY_PICKER_LOCALES = { es: esLocale, en: enLocale, pt: ptLocale } as const;

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
    /** Current birth date string (dd/mm/yyyy or empty). Parent converts to
     * ISO before sending to the API. */
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
    locale,
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

            {/* ── Birth date ──────────────────────────────────────────────
             * Text input with auto-mask paired with a DayPicker popover.
             * The text input guarantees dd/mm/yyyy display for every user
             * (the native `type="date"` picker otherwise honors the
             * browser/OS locale and shows mm/dd/yyyy on US systems). The
             * calendar button preserves the picker affordance. */}
            <BirthDateField
                value={birthDate}
                onChange={onBirthDateChange}
                disabled={submitting}
                locale={locale}
                error={errors.birthDate}
                t={t}
            />
        </>
    );
}

/**
 * Birth-date field: masked text input + calendar popover.
 *
 * Keeps the display format predictable (dd/mm/yyyy) regardless of
 * browser/OS locale while still offering a calendar to click through.
 */
function BirthDateField({
    value,
    onChange,
    disabled,
    locale,
    error,
    t
}: {
    readonly value: string;
    readonly onChange: (value: string) => void;
    readonly disabled: boolean;
    readonly locale: SupportedLocale;
    readonly error?: string;
    readonly t: (key: string, fallback: string) => string;
}) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Close the popover on outside click + Escape.
    useEffect(() => {
        if (!pickerOpen) return;
        function onDown(event: MouseEvent) {
            if (!wrapperRef.current?.contains(event.target as Node)) {
                setPickerOpen(false);
            }
        }
        function onKey(event: KeyboardEvent) {
            if (event.key === 'Escape') setPickerOpen(false);
        }
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [pickerOpen]);

    const selected = ddmmyyyyToDate(value);

    return (
        <div className={styles.field}>
            <label
                htmlFor="pc-birthDate"
                className={styles.label}
            >
                {t('account.profileCompletion.fields.birthDate', 'Fecha de nacimiento')}
            </label>
            <div
                ref={wrapperRef}
                className={styles.birthDateWrapper}
            >
                <input
                    id="pc-birthDate"
                    type="text"
                    inputMode="numeric"
                    className={error ? `${styles.input} ${styles.inputError}` : styles.input}
                    value={value}
                    onChange={(e) => onChange(maskBirthDate(e.target.value))}
                    placeholder="dd/mm/yyyy"
                    maxLength={10}
                    autoComplete="bday"
                    disabled={disabled}
                    aria-invalid={error ? 'true' : undefined}
                    aria-describedby={
                        error ? 'pc-birthDate-error pc-birthDate-hint' : 'pc-birthDate-hint'
                    }
                />
                <button
                    type="button"
                    className={styles.birthDatePickerButton}
                    onClick={() => setPickerOpen((open) => !open)}
                    disabled={disabled}
                    aria-label={t(
                        'account.profileCompletion.fields.birthDateOpenPicker',
                        'Abrir calendario'
                    )}
                    aria-expanded={pickerOpen}
                >
                    <CalendarIcon
                        size={18}
                        weight="regular"
                        aria-hidden="true"
                    />
                </button>
                {pickerOpen && (
                    <div
                        // biome-ignore lint/a11y/useSemanticElements: popover panel, not a modal
                        role="dialog"
                        aria-label={t(
                            'account.profileCompletion.fields.birthDate',
                            'Fecha de nacimiento'
                        )}
                        className={styles.birthDatePopover}
                    >
                        <DayPicker
                            mode="single"
                            captionLayout="dropdown"
                            startMonth={new Date(1900, 0)}
                            endMonth={new Date()}
                            locale={DAY_PICKER_LOCALES[locale]}
                            selected={selected ?? undefined}
                            defaultMonth={selected ?? new Date(2000, 0)}
                            disabled={{ after: new Date() }}
                            onSelect={(date) => {
                                if (date) onChange(dateToDdmmyyyy(date));
                                setPickerOpen(false);
                            }}
                        />
                    </div>
                )}
            </div>
            {error && (
                <p
                    id="pc-birthDate-error"
                    className={styles.errorMsg}
                    role="alert"
                >
                    {error}
                </p>
            )}
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
    );
}

/**
 * Formats a partial date string into the dd/mm/yyyy mask as the user types.
 * Strips non-digits, caps at 8 digits, and inserts slashes after day/month.
 */
function maskBirthDate(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Formats a Date into dd/mm/yyyy (local time, zero-padded). */
function dateToDdmmyyyy(date: Date): string {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = String(date.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
}
