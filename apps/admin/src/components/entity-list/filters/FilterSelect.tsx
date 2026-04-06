/**
 * @file FilterSelect component
 *
 * A select dropdown filter that wraps the shadcn Select primitive.
 * Used in entity list filter bars for enum/string-based filters.
 */

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { FILTER_ALL_VALUE } from './filter-types';
import type { SelectFilterConfig } from './filter-types';

/**
 * Props for the FilterSelect component.
 */
export interface FilterSelectProps {
    /** Configuration for this select filter control (label, options, etc.) */
    readonly config: SelectFilterConfig;
    /** Current filter value, or undefined when no filter is active */
    readonly value: string | undefined;
    /** Called with the new value when the user changes selection, or undefined to clear */
    readonly onChange: (value: string | undefined) => void;
}

/**
 * FilterSelect
 *
 * Renders a compact select dropdown for string/enum filter controls.
 * When the "All" option is selected, calls onChange(undefined) to clear the filter.
 * The trigger border changes from dashed (inactive) to solid primary (active) to
 * give visual feedback about which filters are currently applied.
 *
 * @example
 * ```tsx
 * <FilterSelect
 *   config={{ paramKey: 'status', labelKey: 'common.status', type: 'select', options: [...] }}
 *   value={filters.status}
 *   onChange={(val) => setFilter('status', val)}
 * />
 * ```
 */
export function FilterSelect({ config, value, onChange }: FilterSelectProps) {
    const { t } = useTranslations();

    if (import.meta.env.DEV && config.options.length === 0) {
        console.warn(`[FilterBar] Select filter "${config.paramKey}" has no options configured`);
    }

    const allLabelKey = (config.allLabelKey ?? 'admin-filters.allOption') as TranslationKey;
    const isActive = value !== undefined;

    const handleChange = (selected: string) => {
        onChange(selected === FILTER_ALL_VALUE ? undefined : selected);
    };

    return (
        <Select
            value={value ?? FILTER_ALL_VALUE}
            onValueChange={handleChange}
        >
            <SelectTrigger
                className={
                    isActive
                        ? 'h-8 border-primary border-solid text-sm'
                        : 'h-8 border-dashed text-sm'
                }
                aria-label={
                    isActive
                        ? `${t(config.labelKey as TranslationKey)}: ${config.options.find((o) => o.value === value)?.labelKey ? t(config.options.find((o) => o.value === value)?.labelKey as TranslationKey) : value}`
                        : t(config.labelKey as TranslationKey)
                }
            >
                {isActive ? (
                    <span>
                        <span className="text-muted-foreground">
                            {t(config.labelKey as TranslationKey)}:
                        </span>{' '}
                        <SelectValue placeholder={t(allLabelKey)} />
                    </span>
                ) : (
                    <SelectValue placeholder={t(allLabelKey)} />
                )}
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={FILTER_ALL_VALUE}>{t(allLabelKey)}</SelectItem>
                {config.options.map((option) => (
                    <SelectItem
                        key={option.value}
                        value={option.value}
                    >
                        {t(option.labelKey as TranslationKey)}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
