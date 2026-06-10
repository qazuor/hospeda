import { cn } from '@/lib/utils';
import type * as React from 'react';
import { FieldCharCounter } from './FieldCharCounter';
import { FieldHelpIcon } from './FieldHelpIcon';

/**
 * Rendering mode — drives the "asymmetric noise" rule:
 * - `view`: label + value only (no description paragraph)
 * - `edit` / `create`: description goes to a (?) help icon if provided
 */
export type FieldWrapperMode = 'view' | 'edit' | 'create';

/**
 * Props for the FieldWrapper component.
 */
export interface FieldWrapperProps {
    /** Field identifier — used to generate accessible htmlFor / aria-* ids */
    fieldId: string;
    /** Human-readable label shown above the field */
    label?: string;
    /** Whether the field is required (adds red asterisk to label) */
    required?: boolean;
    /** Description text. In view mode: hidden. In edit mode: collapsed into (?) help icon. */
    description?: string;
    /** Error message from form validation */
    errorMessage?: string;
    /** Whether an error is active */
    hasError?: boolean;
    /** Rendering mode (drives asymmetric noise rule) */
    mode?: FieldWrapperMode;
    /** Current character count — enables the inline char counter when `maxLength` is also set */
    charCount?: number;
    /** Maximum length from typeConfig/schema — drives char counter */
    maxLength?: number;
    /** Additional CSS classes for the outer wrapper div */
    className?: string;
    /** The field widget (input, select, etc.) */
    children: React.ReactNode;
}

/**
 * FieldWrapper — canonical anatomy of a single field in the redesigned form.
 *
 * Layout (top to bottom):
 *  1. Label row — `<label>` + optional required asterisk + optional `(?)` help icon (edit only)
 *  2. Field widget — the child element (input, select, textarea, etc.)
 *  3. Footer row — error message (left) + char counter (right), only rendered when present
 *
 * Rules from spec §4.2 / §4.6:
 *  - View: label + value only (no description paragraph)
 *  - Edit: description → (?) tooltip, not a full paragraph
 *  - Error: red border handled by the field itself; label turns destructive here
 *  - Char counter: only when `maxLength` is provided (comes from typeConfig, not hardcoded)
 *  - Grid alignment: the wrapper itself does NOT set col-span — that is set by the caller
 *    (EntityFormSection / EntityViewSection) based on field type via `getFieldColSpanClass`.
 *
 * @example
 * ```tsx
 * // Edit mode with char counter and error
 * <FieldWrapper
 *   fieldId="field-summary"
 *   label="Resumen"
 *   required
 *   description="Descripción breve (10-300)"
 *   mode="edit"
 *   charCount={value.length}
 *   maxLength={300}
 *   hasError
 *   errorMessage="El resumen es requerido"
 * >
 *   <TextareaField ... />
 * </FieldWrapper>
 * ```
 */
export function FieldWrapper({
    fieldId,
    label,
    required,
    description,
    errorMessage,
    hasError = false,
    mode = 'edit',
    charCount,
    maxLength,
    className,
    children
}: FieldWrapperProps) {
    const labelId = label ? `${fieldId}-label` : undefined;
    const errorId = hasError && errorMessage ? `${fieldId}-error` : undefined;

    const showHelpIcon = mode !== 'view' && !!description;
    const showCharCounter = charCount !== undefined && maxLength !== undefined;
    const showFooter = hasError || showCharCounter;

    return (
        <div className={cn('flex flex-col gap-1', className)}>
            {/* Label row */}
            {label && (
                <div className="flex items-center gap-1.5">
                    <label
                        id={labelId}
                        htmlFor={fieldId}
                        className={cn(
                            'font-medium text-sm leading-none',
                            hasError ? 'text-destructive' : 'text-foreground'
                        )}
                    >
                        {label}
                        {required && (
                            <span
                                className="ml-0.5 text-destructive"
                                aria-hidden="true"
                            >
                                *
                            </span>
                        )}
                    </label>

                    {showHelpIcon && <FieldHelpIcon text={description} />}
                </div>
            )}

            {/* Field widget */}
            {children}

            {/* Footer row: error message + char counter */}
            {showFooter && (
                <div className="flex items-start justify-between gap-2">
                    {hasError && errorMessage ? (
                        <p
                            id={errorId}
                            className="text-destructive text-xs"
                            role="alert"
                        >
                            ⚠ {errorMessage}
                        </p>
                    ) : (
                        /* Spacer to push counter to the right when there's no error */
                        <span />
                    )}

                    {showCharCounter && (
                        <FieldCharCounter
                            current={charCount}
                            max={maxLength}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
