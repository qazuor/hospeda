/**
 * @file BusinessLinesField.client.tsx
 * @description Business-line selector shared by the owner create form and the
 * editor's basic-info section (HOS-1787 leaf 5.6, extended in 5.7).
 *
 * ## The catalog decides, the component renders
 *
 * `resolveBusinessLineOptions` returns every catalog option with its
 * `selectable`, `selected`, `removable` and blocking reasons. This component
 * never imports `BUSINESS_LINES` / `BUSINESS_LINE_RULES` and never compares
 * business-line values (G-FAC-03); the next selection is assembled by index
 * over the option list, reading each option's own `selected` flag.
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
 *
 * ## Removal is not deletion (leaf 5.7)
 *
 * Unchecking a line hides the sections it owns; it never deletes their data.
 * An option whose removal would leave an invalid selection is disabled with the
 * catalog's reason, and a valid removal opens
 * {@link BusinessLineRemovalNotice}, which names what would disappear and how
 * much is stored. If a type change makes the current selection invalid, the
 * field shows the reason and offers the type's suggested lines instead of
 * silently dropping any.
 */

import { resolveValidationMessage } from '@repo/i18n/web';
import type { ListingVertical } from '@repo/schemas';
import {
    resolveBusinessLineDefaults,
    resolveBusinessLineOptions,
    validateBusinessLines
} from '@repo/schemas';
import { type JSX, useEffect, useState } from 'react';
import { FieldError, fieldErrorId } from '@/components/ui/FieldError';
import type { TranslationFn } from '@/lib/api-errors';
import { buildFieldId } from '@/lib/forms/build-field-id';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { BusinessLineRemovalNotice } from './BusinessLineRemovalNotice.client';
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
    /**
     * UUID of the listing, used by the removal notice. Omitted on the create
     * form, where there is no listing to read section states for and no removal
     * can hide stored data yet.
     */
    readonly listingId?: string;
}

const FIELD_NAME = 'businessLines';

/**
 * Resolves the message a selection invalid for its type must show.
 *
 * Uses the canonical `zodError.venue.businessLines.<reason>` key through
 * `resolveValidationMessage`, so the copy is the same one the API's 400 carries
 * and exists in all three locales.
 *
 * @param params - Vertical, type, selection and translations.
 * @returns The translated reason, or `undefined` when the selection is valid.
 */
export function resolveBusinessLinesFieldError({
    vertical,
    type,
    selected,
    t
}: {
    readonly vertical: ListingVertical;
    readonly type: string;
    readonly selected: readonly string[];
    readonly t: TranslationFn;
}): string | undefined {
    // No type selected yet is not an invalid selection: the owner has not been
    // asked which rules apply. The create form requires a type before submit.
    if (!type) return undefined;
    const result = validateBusinessLines({ vertical, type, businessLines: selected });
    if (result.ok) return undefined;
    return resolveValidationMessage({
        key: `zodError.venue.businessLines.${result.reason}`,
        t: (key, params) => t(key, undefined, params)
    });
}

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
    errors,
    listingId
}: BusinessLinesFieldProps): JSX.Element | null {
    const { t } = createTranslations(locale);

    const options = resolveBusinessLineOptions({ vertical, type, selected });
    const [pendingRemoval, setPendingRemoval] = useState<{
        readonly removed: readonly string[];
        readonly next: readonly string[];
    } | null>(null);

    // A type change replaces the rules the removal notice was computed under,
    // so the notice is no longer pending. A line re-added after a removal is
    // handled by the toggle itself (it sets the notice to `null`).
    // biome-ignore lint/correctness/useExhaustiveDependencies: `type` IS the dependency; resetting the notice on a type change is the intent.
    useEffect(() => {
        setPendingRemoval(null);
    }, [type]);

    // A single line is not a choice. The catalog decides the count, not a
    // comparison against the vertical name.
    if (options.length <= 1) return null;

    const selectedCount = options.filter((option) => option.selected).length;
    const fieldId = buildFieldId({ prefix: LISTING_FIELD_PREFIX, name: FIELD_NAME });
    const errorId = fieldErrorId(FIELD_NAME);
    const selectionError = resolveBusinessLinesFieldError({ vertical, type, selected, t });
    const error = errors.businessLines ?? selectionError;
    const suggested = resolveBusinessLineDefaults({ vertical, type }).preselect;

    const toggle = (index: number, checked: boolean): void => {
        const removed = options
            .filter((option, optionIndex) => option.selected && optionIndex === index && !checked)
            .map((option) => option.value);
        const next = options
            .filter((option, optionIndex) => (optionIndex === index ? checked : option.selected))
            .map((option) => option.value);

        setPendingRemoval(removed.length > 0 && listingId ? { removed, next } : null);
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
                        const disabled =
                            !option.selectable ||
                            lastSelected ||
                            (option.selected && !option.removable);
                        const hint = option.reason
                            ? t(`venue.owner.businessLines.reason.${option.reason}`)
                            : lastSelected
                              ? t(
                                    'venue.owner.businessLines.keepOne',
                                    'Dejá al menos un rubro seleccionado.'
                                )
                              : option.selected && !option.removable && option.removeReason
                                ? resolveValidationMessage({
                                      key: `zodError.venue.businessLines.${option.removeReason}`,
                                      t: (key, params) => t(key, undefined, params)
                                  })
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
            {selectionError && suggested.length > 0 && !errors.businessLines ? (
                <button
                    type="button"
                    className={styles.suggested}
                    onClick={() => {
                        setPendingRemoval(null);
                        onChange([...suggested]);
                    }}
                >
                    {t(
                        'venue.owner.businessLines.useSuggested',
                        'Usar los rubros sugeridos para este tipo'
                    )}
                </button>
            ) : null}
            {pendingRemoval && listingId ? (
                <BusinessLineRemovalNotice
                    locale={locale}
                    listingId={listingId}
                    removedValues={pendingRemoval.removed}
                    nextSelection={pendingRemoval.next}
                />
            ) : null}
            <FieldError
                id={errorId}
                message={error}
            />
        </div>
    );
}
