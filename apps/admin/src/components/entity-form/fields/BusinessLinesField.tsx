/**
 * @file BusinessLinesField.tsx
 * Business-line checkbox group for the admin's consolidated venue form
 * (HOS-1873).
 *
 * The catalog decides: `resolveBusinessLineOptions` returns every option with
 * its `selectable`, `selected`, `removable` and blocking reason, and
 * `validateBusinessLines` answers whether the selection is valid. This
 * component never imports `BUSINESS_LINES` / `BUSINESS_LINE_RULES` and never
 * compares business-line values (G-FAC-03); the next selection is assembled by
 * index over the option list, reading each option's own `selected` flag.
 *
 * Visibility rules:
 * - A vertical with a single catalog line renders nothing.
 * - `NOT_ALLOWED_FOR_TYPE` options are hidden while unselected; when the
 *   listing already carries one, it is shown checked with its reason so the
 *   operator can uncheck it (AC:7:3).
 * - `MAX_EXCEEDED` / `EXCLUDED_PAIR` stay visible, disabled, with their reason.
 * - The last selected line cannot be unchecked: the field always carries at
 *   least one business line.
 */

import type { TranslationKey } from '@repo/i18n';
import { resolveValidationMessage } from '@repo/i18n';
import {
    type BusinessLineValidationReason,
    resolveBusinessLineDefaults,
    resolveBusinessLineOptions,
    validateBusinessLines
} from '@repo/schemas';
import * as React from 'react';
import type {
    BusinessLinesFieldConfig,
    FieldConfig
} from '@/components/entity-form/types/field-config.types';
import { Button, Checkbox, Label } from '@/components/ui-wrapped';
import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';

/**
 * Props for {@link BusinessLinesField}.
 *
 * Mirrors the standard `fieldProps` contract plus the listing type, read from
 * the sibling `type` field by `EntityFormSection`.
 */
export interface BusinessLinesFieldProps {
    /** Field configuration; `typeConfig` carries the vertical + type field id. */
    readonly config: FieldConfig;
    /** Current selection. */
    readonly value?: readonly string[];
    /** Receives the next selection, already in catalog order. */
    readonly onChange?: (value: string[]) => void;
    /** Blur handler (unused; kept for contract parity). */
    readonly onBlur?: () => void;
    /** Whether the field has an error. */
    readonly hasError?: boolean;
    /** Error message supplied by the form (e.g. mapped from the API 400). */
    readonly errorMessage?: string;
    /** Whether the field is disabled. */
    readonly disabled?: boolean;
    /** Whether the field is required. */
    readonly required?: boolean;
    /** Additional CSS classes. */
    readonly className?: string;
    /** Listing type currently selected in the form. */
    readonly listingType: string;
}

/**
 * Resolves the error a selection invalid for its type must show.
 *
 * Uses the canonical `zodError.venue.businessLines.<reason>` key through
 * `resolveValidationMessage`, so the copy matches the API's 400.
 *
 * @param input - Vertical, type, selection and translation function.
 * @param input.vertical - Listing vertical.
 * @param input.type - Selected listing type.
 * @param input.selected - Current selection.
 * @param input.t - Translation function.
 * @returns The translated reason, or `undefined` when the selection is valid.
 */
function resolveSelectionError({
    vertical,
    type,
    selected,
    t
}: {
    readonly vertical: BusinessLinesFieldConfig['vertical'];
    readonly type: string;
    readonly selected: readonly string[];
    readonly t: (key: TranslationKey, params?: Record<string, unknown>) => string;
}): string | undefined {
    // No type selected yet is not an invalid selection: the rules are unknown.
    if (!type) return undefined;
    const result = validateBusinessLines({ vertical, type, businessLines: selected });
    if (result.ok) return undefined;
    return resolveValidationMessage({
        key: `zodError.venue.businessLines.${result.reason}`,
        t: (key, params) => t(key as TranslationKey, params)
    });
}

/**
 * Business-line checkbox group for the consolidated venue form.
 *
 * @param props - Field configuration, current selection, type and handlers.
 * @returns The checkbox group, or `null` when the vertical has one line.
 */
export function BusinessLinesField({
    config,
    value,
    onChange,
    hasError = false,
    errorMessage,
    disabled = false,
    required = false,
    className,
    listingType
}: BusinessLinesFieldProps): React.JSX.Element | null {
    const { t } = useTranslations();
    const fieldConfig = config.typeConfig as BusinessLinesFieldConfig | undefined;
    const vertical = fieldConfig?.vertical ?? 'venue';
    const selected = value ?? [];

    const options = resolveBusinessLineOptions({ vertical, type: listingType, selected });
    const hasChoice = options.length > 1;

    // The create form starts empty. When the operator picks a type, fill the
    // selection with that type's suggested lines — once per type, and only
    // while the field is empty.
    const appliedDefaultType = React.useRef<string | null>(null);
    React.useEffect(() => {
        if (!hasChoice) return;
        if (!listingType) {
            appliedDefaultType.current = null;
            return;
        }
        if (appliedDefaultType.current === listingType) return;
        appliedDefaultType.current = listingType;
        if (selected.length > 0) return;
        const preselect = resolveBusinessLineDefaults({ vertical, type: listingType }).preselect;
        if (preselect.length > 0) onChange?.([...preselect]);
        // `selected` is read through its length: only emptiness matters here.
    }, [hasChoice, listingType, onChange, selected.length, vertical]);

    if (!hasChoice) return null;

    const selectedCount = options.filter((option) => option.selected).length;
    const selectionError = resolveSelectionError({ vertical, type: listingType, selected, t });
    const error = errorMessage ?? selectionError;
    const suggested = listingType
        ? resolveBusinessLineDefaults({ vertical, type: listingType }).preselect
        : [];

    const toggle = (index: number, checked: boolean): void => {
        const next = options
            .filter((option, optionIndex) => (optionIndex === index ? checked : option.selected))
            .map((option) => option.value);
        onChange?.([...next]);
    };

    const reasonHint = (reason: BusinessLineValidationReason): string => {
        if (reason === 'NOT_ALLOWED_FOR_TYPE') {
            return resolveValidationMessage({
                key: `zodError.venue.businessLines.${reason}`,
                t: (key, params) => t(key as TranslationKey, params)
            });
        }
        return t(`venue.owner.businessLines.reason.${reason}` as TranslationKey);
    };

    const fieldId = `field-${config.id}`;
    const errorId = `${fieldId}-error`;

    return (
        <div className={cn('space-y-2', className)}>
            <fieldset
                id={fieldId}
                className="space-y-3"
                aria-invalid={Boolean(error) || hasError}
                aria-describedby={error ? errorId : undefined}
            >
                <legend
                    className={cn(
                        'font-medium text-sm',
                        required && 'after:ml-0.5 after:text-destructive after:content-["*"]'
                    )}
                >
                    {config.label ?? t('venue.owner.businessLines.legend')}
                </legend>
                <div className="flex flex-wrap gap-4">
                    {options.map((option, index) => {
                        if (option.reason === 'NOT_ALLOWED_FOR_TYPE' && !option.selected) {
                            return null;
                        }

                        const lastSelected = option.selected && selectedCount === 1;
                        const selectedNotAllowed =
                            option.selected && option.reason === 'NOT_ALLOWED_FOR_TYPE';
                        const blockedByReason = !option.selectable && !selectedNotAllowed;
                        const optionDisabled =
                            disabled ||
                            lastSelected ||
                            blockedByReason ||
                            (option.selected && !option.removable && !selectedNotAllowed);
                        const hint = option.reason
                            ? reasonHint(option.reason)
                            : lastSelected
                              ? t('venue.owner.businessLines.keepOne')
                              : option.selected && !option.removable && option.removeReason
                                ? resolveValidationMessage({
                                      key: `zodError.venue.businessLines.${option.removeReason}`,
                                      t: (key, params) => t(key as TranslationKey, params)
                                  })
                                : null;
                        const checkId = `${fieldId}-${option.value}`;

                        return (
                            <div
                                key={option.value}
                                className="flex items-start gap-2"
                            >
                                <Checkbox
                                    id={checkId}
                                    data-testid={`business-line-${option.value}`}
                                    checked={option.selected}
                                    disabled={optionDisabled}
                                    onCheckedChange={(checked) => toggle(index, checked === true)}
                                    className="mt-0.5"
                                />
                                <div className="space-y-0.5">
                                    <Label
                                        htmlFor={checkId}
                                        className="cursor-pointer font-normal text-sm"
                                    >
                                        {t(
                                            `venue.owner.businessLines.${option.value}.label` as TranslationKey
                                        )}
                                    </Label>
                                    {hint ? (
                                        <p className="text-muted-foreground text-xs">{hint}</p>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </fieldset>
            {selectionError && suggested.length > 0 ? (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onChange?.([...suggested])}
                >
                    {t('venue.owner.businessLines.useSuggested')}
                </Button>
            ) : null}
            {error ? (
                <p
                    id={errorId}
                    className="text-destructive text-sm"
                >
                    {error}
                </p>
            ) : null}
        </div>
    );
}
