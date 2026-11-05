/**
 * @file BusinessLinesField.client.tsx
 * @description Business-line selector shared by the owner create form and the
 * editor's basic-info section (HOS-1787 leaf 5.6).
 *
 * ## The catalog decides, the component renders
 *
 * `resolveBusinessLineOptions` returns every catalog option with its
 * `selectable`, `selected` and blocking `reason`. This component never imports
 * `BUSINESS_LINES` / `BUSINESS_LINE_RULES` and never compares business-line
 * values (G-FAC-03); the next selection is assembled by index over the option
 * list, reading each option's own `selected` flag.
 *
 * ## Visibility rules
 *
 * - Rendered only when the vertical has MORE THAN ONE catalog line. A vertical
 *   with a single line (accommodation, experience) gets no selector (AC:5:9).
 * - `NOT_ALLOWED_FOR_TYPE` options are hidden (AC:5:1: a HELADERIA has no
 *   `nightlife` checkbox). `MAX_EXCEEDED` / `EXCLUDED_PAIR` stay visible,
 *   disabled, with their reason as help text.
 * - The last selected option cannot be unchecked: the field always carries at
 *   least one business line (DEC-FAC-034).
 */

import type { ListingVertical } from '@repo/schemas';
import { resolveBusinessLineOptions } from '@repo/schemas';
import type { JSX } from 'react';
import { FieldError, fieldErrorId } from '@/components/ui/FieldError';
import { buildFieldId } from '@/lib/forms/build-field-id';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './BusinessLinesField.module.css';
import { LISTING_FIELD_PREFIX } from './field-ids';

/** Props for {@link BusinessLinesField}. */
export interface BusinessLinesFieldProps {
    /** Active locale. */
    readonly locale: SupportedLocale;
    /** Listing vertical that owns the catalog. */
    readonly vertical: ListingVertical;
    /** Selected listing type; decides which lines the type admits. */
    readonly type: string;
    /** Currently selected business-line values. */
    readonly selected: readonly string[];
    /** Receives the next selection, already in catalog order. */
    readonly onChange: (next: readonly string[]) => void;
    /** Field errors; only `businessLines` is read. */
    readonly errors: Readonly<{ businessLines?: string }>;
}

const FIELD_NAME = 'businessLines';

/**
 * Business-line checkbox group.
 *
 * @param props - Vertical, type, current selection, change handler and field errors.
 * @returns The group, or `null` when the vertical has a single business line.
 */
export function BusinessLinesField({
    locale,
    vertical,
    type,
    selected,
    onChange,
    errors
}: BusinessLinesFieldProps): JSX.Element | null {
    const { t } = createTranslations(locale);

    const options = resolveBusinessLineOptions({ vertical, type, selected });

    // A single line is not a choice. The catalog decides the count, not a
    // comparison against the vertical name.
    if (options.length <= 1) return null;

    const selectedCount = options.filter((option) => option.selected).length;
    const fieldId = buildFieldId({ prefix: LISTING_FIELD_PREFIX, name: FIELD_NAME });
    const errorId = fieldErrorId(FIELD_NAME);
    const error = errors.businessLines;

    const toggle = (index: number, checked: boolean): void => {
        const next = options
            .filter((option, optionIndex) => (optionIndex === index ? checked : option.selected))
            .map((option) => option.value);

        onChange(next);
    };

    return (
        <div className={styles.field}>
            <fieldset
                id={fieldId}
                className={styles.fieldset}
                aria-invalid={error ? 'true' : 'false'}
                aria-describedby={error ? errorId : undefined}
            >
                <legend className={styles.legend}>
                    {t('venue.owner.businessLines.legend', 'Rubros')}
                </legend>
                <div className={styles.options}>
                    {options.map((option, index) => {
                        if (option.reason === 'NOT_ALLOWED_FOR_TYPE') return null;

                        const lastSelected = option.selected && selectedCount === 1;
                        const disabled = !option.selectable || lastSelected;
                        const hint = option.reason
                            ? t(`venue.owner.businessLines.reason.${option.reason}`)
                            : lastSelected
                              ? t(
                                    'venue.owner.businessLines.keepOne',
                                    'Dejá al menos un rubro seleccionado.'
                                )
                              : null;

                        return (
                            <label
                                key={option.value}
                                className={styles.option}
                            >
                                <input
                                    type="checkbox"
                                    data-testid={`business-line-${option.value}`}
                                    checked={option.selected}
                                    disabled={disabled}
                                    onChange={(event) => toggle(index, event.target.checked)}
                                />
                                <span className={styles.optionText}>
                                    <span className={styles.optionLabel}>
                                        {t(
                                            `venue.owner.businessLines.${option.value}.label`,
                                            option.value
                                        )}
                                    </span>
                                    {hint ? <span className={styles.hint}>{hint}</span> : null}
                                </span>
                            </label>
                        );
                    })}
                </div>
            </fieldset>
            <FieldError
                id={errorId}
                message={error}
            />
        </div>
    );
}
