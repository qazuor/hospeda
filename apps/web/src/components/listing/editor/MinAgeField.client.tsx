/**
 * @file MinAgeField.client.tsx
 * @description Minimum-age input for the owner create form (DEC-FAC-050).
 *
 * The create form shows this field only when the selected listing type brings a
 * `policies.minAge` field default (BOLICHE → 18); the value stays editable and
 * clearable and is sent in the create payload as `policies.minAge` (HOS-2060). Extracted from `ListingCreateForm` so the
 * form island does not keep growing (HOS-1787 leaf 5.6 review).
 */

import type { JSX } from 'react';
import { FieldError, fieldErrorId } from '@/components/ui/FieldError';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './MinAgeField.module.css';

/** Props for {@link MinAgeField}. */
export interface MinAgeFieldProps {
    /** Active locale; drives the translated label. */
    readonly locale: SupportedLocale;
    /** Current value, or `null` when the owner cleared the field. */
    readonly value: number | null;
    /** Receives the parsed number, or `null` for an empty/invalid input. */
    readonly onChange: (value: number | null) => void;
    /** Validation message for `policies.minAge`, when present. */
    readonly error?: string;
}

/**
 * Minimum-age number input.
 *
 * @param props - Locale, current value, change handler and field error.
 * @returns The labelled input with its inline error.
 */
export function MinAgeField({ locale, value, onChange, error }: MinAgeFieldProps): JSX.Element {
    const { t } = createTranslations(locale);

    return (
        <div className={styles.field}>
            <label
                className={styles.label}
                htmlFor="cc-minAge"
            >
                {t('venue.detail.nightInfo.minAgeLabel', 'Edad mínima')}
            </label>
            <input
                id="cc-minAge"
                type="number"
                min={13}
                max={30}
                className={styles.input}
                value={value ?? ''}
                onChange={(event) => {
                    const next = Number.parseInt(event.target.value, 10);
                    onChange(Number.isNaN(next) ? null : next);
                }}
                aria-invalid={error ? 'true' : 'false'}
                aria-describedby={error ? fieldErrorId('policies-minAge') : undefined}
            />
            <FieldError
                id={fieldErrorId('policies-minAge')}
                message={error}
            />
        </div>
    );
}
