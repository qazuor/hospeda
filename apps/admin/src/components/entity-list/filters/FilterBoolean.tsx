/**
 * @file FilterBoolean component
 *
 * A boolean filter using shadcn Select with three options: All, Yes, No.
 * Used in entity list filter bars for boolean-typed fields.
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
import type { BooleanFilterConfig } from './filter-types';

/**
 * Props for the FilterBoolean component.
 */
export interface FilterBooleanProps {
    /** Configuration for this boolean filter control (label key, paramKey, etc.) */
    readonly config: BooleanFilterConfig;
    /** Current filter value ('true' | 'false'), or undefined when no filter is active */
    readonly value: string | undefined;
    /** Called with 'true', 'false', or undefined to clear the filter */
    readonly onChange: (value: string | undefined) => void;
}

/**
 * FilterBoolean
 *
 * Renders a compact three-option select for boolean filter controls.
 * Options are: All (clears filter), Yes (sets 'true'), No (sets 'false').
 * Trigger border is dashed when inactive and solid primary when active,
 * providing visual feedback about applied filters.
 *
 * @example
 * ```tsx
 * <FilterBoolean
 *   config={{ paramKey: 'isActive', labelKey: 'common.isActive', type: 'boolean' }}
 *   value={filters.isActive}
 *   onChange={(val) => setFilter('isActive', val)}
 * />
 * ```
 */
export function FilterBoolean({ config, value, onChange }: FilterBooleanProps) {
    const { t } = useTranslations();

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
                        ? `${t(config.labelKey as TranslationKey)}: ${value === 'true' ? t('admin-filters.booleanYes') : t('admin-filters.booleanNo')}`
                        : t(config.labelKey as TranslationKey)
                }
            >
                {isActive ? (
                    <span>
                        <span className="text-muted-foreground">
                            {t(config.labelKey as TranslationKey)}:
                        </span>{' '}
                        <SelectValue placeholder={t('admin-filters.allOption')} />
                    </span>
                ) : (
                    <SelectValue placeholder={t('admin-filters.allOption')} />
                )}
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={FILTER_ALL_VALUE}>{t('admin-filters.allOption')}</SelectItem>
                <SelectItem value="true">{t('admin-filters.booleanYes')}</SelectItem>
                <SelectItem value="false">{t('admin-filters.booleanNo')}</SelectItem>
            </SelectContent>
        </Select>
    );
}
