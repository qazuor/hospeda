/**
 * FaqCategoryCombobox
 *
 * A controlled input + native <datalist> that lets operators pick from the
 * FAQ_BASELINE_CATEGORIES suggestions or type any free-form category string.
 *
 * Design rationale: there is no existing editable-combobox primitive in
 * @/components/ui (only a non-editable Select). A plain <input list="...">
 * with a <datalist> is the simplest accessible native solution that requires
 * no extra dependencies and works across all modern browsers. The baseline
 * categories seed the datalist; anything typed is valid.
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { FAQ_BASELINE_CATEGORIES } from '@repo/schemas';
import { useId } from 'react';

const DATALIST_ID_PREFIX = 'faq-categories-';

/**
 * Props for FaqCategoryCombobox.
 */
export interface FaqCategoryComboboxProps {
    /** Current category value (may be empty string or null). */
    readonly value: string;
    /** Called on every change with the new raw string. */
    readonly onChange: (value: string) => void;
    /** Label text rendered above the input. */
    readonly label: string;
    /** Optional placeholder for the input element. */
    readonly placeholder?: string;
    /** Whether the input is disabled. */
    readonly disabled?: boolean;
    /** Inline error message to display below the input. */
    readonly errorMessage?: string;
    /** Additional CSS classes for the root element. */
    readonly className?: string;
}

/**
 * Category input wired to a datalist pre-populated with FAQ_BASELINE_CATEGORIES.
 * Accepts any free-text string — the datalist only provides suggestions.
 */
export function FaqCategoryCombobox({
    value,
    onChange,
    label,
    placeholder,
    disabled = false,
    errorMessage,
    className
}: FaqCategoryComboboxProps) {
    const uid = useId();
    const datalistId = `${DATALIST_ID_PREFIX}${uid}`;
    const inputId = `faq-category-input-${uid}`;
    const errorId = errorMessage ? `${inputId}-error` : undefined;

    return (
        <div className={cn('flex flex-col gap-1', className)}>
            <Label htmlFor={inputId}>{label}</Label>

            <Input
                id={inputId}
                list={datalistId}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                aria-describedby={errorId}
                aria-invalid={Boolean(errorMessage)}
                className={cn(errorMessage && 'border-destructive focus-visible:ring-destructive')}
            />

            {/* Native datalist seeds suggestions; browser renders the dropdown */}
            <datalist id={datalistId}>
                {FAQ_BASELINE_CATEGORIES.map((cat) => (
                    <option
                        key={cat}
                        value={cat}
                    />
                ))}
            </datalist>

            {errorMessage && (
                <p
                    id={errorId}
                    role="alert"
                    className="text-destructive text-xs"
                >
                    {errorMessage}
                </p>
            )}
        </div>
    );
}
