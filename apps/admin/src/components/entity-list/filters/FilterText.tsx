/**
 * @file FilterText component
 *
 * A debounced free-text input filter that writes its value to the URL param.
 * Empty or whitespace-only input removes the param entirely.
 * The controlled input stays in sync when the URL param changes externally
 * (e.g. chip clear, reset-all).
 */

import { Input } from '@/components/ui/input';
import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import type { TranslationKey } from '@repo/i18n';
import { useEffect, useRef, useState } from 'react';
import type { TextFilterConfig } from './filter-types';

/** Default debounce delay (ms) used when `config.debounceMs` is not specified. */
const DEFAULT_DEBOUNCE_MS = 400;

/**
 * Props for the FilterText component.
 */
export interface FilterTextProps {
    /** Configuration for this text filter control (label, placeholder, debounce, etc.) */
    readonly config: TextFilterConfig;
    /** Current filter value from the URL param, or undefined when no filter is active */
    readonly value: string | undefined;
    /**
     * Called with the trimmed string when the user stops typing, or undefined to
     * clear the filter when the input is empty / whitespace-only.
     */
    readonly onChange: (value: string | undefined) => void;
}

/**
 * FilterText
 *
 * Renders a compact debounced text input for free-text filter controls.
 * The input border changes from dashed (inactive) to solid primary (active)
 * to give visual feedback about which filters are currently applied.
 *
 * Debounce semantics:
 * - Each keystroke resets a timer; `onChange` fires only after the user pauses.
 * - Trimmed empty strings call `onChange(undefined)` to remove the URL param.
 *
 * External sync:
 * - When `value` changes externally (e.g. chip removal or filter reset),
 *   the local input state updates to match the new URL param value.
 *
 * @example
 * ```tsx
 * <FilterText
 *   config={{ paramKey: 'search', labelKey: 'filters.search', type: 'text', debounceMs: 300 }}
 *   value={filters.search}
 *   onChange={(val) => setFilter('search', val)}
 * />
 * ```
 */
export function FilterText({ config, value, onChange }: FilterTextProps) {
    const { t } = useTranslations();

    // Local state drives the input so the user sees immediate typing feedback
    const [localValue, setLocalValue] = useState(value ?? '');

    // Sync local state when the external value changes (chip clear, reset-all, etc.)
    useEffect(() => {
        setLocalValue(value ?? '');
    }, [value]);

    const debounceMs = config.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isActive = value !== undefined && value !== '';

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        setLocalValue(raw);

        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => {
            const trimmed = raw.trim();
            onChange(trimmed === '' ? undefined : trimmed);
        }, debounceMs);
    };

    // Clean up pending timer on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current !== null) {
                clearTimeout(timerRef.current);
            }
        };
    }, []);

    const labelText = t(config.labelKey as TranslationKey);
    const placeholderText = config.placeholderKey
        ? t(config.placeholderKey as TranslationKey)
        : labelText;

    return (
        <div className="relative flex items-center">
            <Input
                type="text"
                value={localValue}
                onChange={handleChange}
                placeholder={placeholderText}
                maxLength={config.maxLength}
                aria-label={isActive ? `${labelText}: ${value}` : labelText}
                className={cn(
                    'h-8 min-w-[10rem] max-w-[18rem] text-sm focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:ring-offset-0',
                    isActive ? 'border-primary border-solid' : 'border-dashed'
                )}
            />
        </div>
    );
}
