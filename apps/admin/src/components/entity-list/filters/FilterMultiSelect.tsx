/**
 * @file FilterMultiSelect component
 *
 * Any-of multi-select filter for entity list filter bars (HOS-919). Options are
 * loaded at runtime (a catalog, not an enum) and the active value is a
 * comma-separated string, the shape the API's list filters accept.
 *
 * Options load once per mount with a plain effect rather than a query, so the
 * control works inside any filter bar without requiring a query provider.
 */

import type { TranslationKey } from '@repo/i18n';
import { useEffect, useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import type { MultiSelectFilterConfig } from './filter-types';

/** Props for {@link FilterMultiSelect}. */
export interface FilterMultiSelectProps {
    readonly config: MultiSelectFilterConfig;
    /** Comma-separated active values, or undefined when no filter is active. */
    readonly value: string | undefined;
    /** Called with the new comma-separated value, or undefined to clear. */
    readonly onChange: (value: string | undefined) => void;
}

type LoadedOption = { readonly value: string; readonly label: string };

/** Splits the URL value into its selected entries. */
const parseSelected = (value: string | undefined): string[] =>
    value
        ? value
              .split(',')
              .map((entry) => entry.trim())
              .filter(Boolean)
        : [];

/**
 * Renders a popover with one checkbox per loaded option.
 *
 * Toggling emits the full new list joined by commas, in the order the values
 * were picked, or `undefined` once nothing is selected so the param disappears.
 *
 * @param props - {@link FilterMultiSelectProps}
 */
export function FilterMultiSelect({ config, value, onChange }: FilterMultiSelectProps) {
    const { t } = useTranslations();
    const [options, setOptions] = useState<readonly LoadedOption[]>([]);
    const selected = useMemo(() => parseSelected(value), [value]);
    const isActive = selected.length > 0;

    useEffect(() => {
        let cancelled = false;
        void config.loadOptions().then((loaded) => {
            if (!cancelled) setOptions(loaded);
        });
        return () => {
            cancelled = true;
        };
    }, [config]);

    const toggle = (optionValue: string) => {
        const next = selected.includes(optionValue)
            ? selected.filter((entry) => entry !== optionValue)
            : [...selected, optionValue];
        onChange(next.length > 0 ? next.join(',') : undefined);
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    data-testid={`filter-multi-select-${config.paramKey}`}
                    className={cn(
                        'inline-flex h-8 items-center gap-1 rounded-md border bg-background px-3 text-sm',
                        isActive ? 'border-primary border-solid' : 'border-dashed'
                    )}
                >
                    <span className="text-muted-foreground">
                        {t(config.labelKey as TranslationKey)}:
                    </span>
                    <span>
                        {isActive
                            ? selected.length
                            : t('admin-filters.allOption' as TranslationKey)}
                    </span>
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                className="max-h-72 w-64 overflow-y-auto p-2"
            >
                <ul className="space-y-1">
                    {options.map((option) => (
                        <li key={option.value}>
                            <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
                                <input
                                    type="checkbox"
                                    checked={selected.includes(option.value)}
                                    onChange={() => toggle(option.value)}
                                />
                                {option.label}
                            </label>
                        </li>
                    ))}
                </ul>
            </PopoverContent>
        </Popover>
    );
}
