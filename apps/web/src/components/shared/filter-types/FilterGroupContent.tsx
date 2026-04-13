/**
 * @file FilterGroupContent.tsx
 * @description Renders the inner content of a single filter group based on its type.
 * Used internally by FilterSidebar to keep the main component under 500 lines.
 */

import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from '../FilterSidebar.module.css';
import { DualRangeFilter } from './DualRangeFilter';
import { IconChipsFilter } from './IconChipsFilter';
import { SelectSearchFilter } from './SelectSearchFilter';
import { StarsFilter } from './StarsFilter';
import { StepperFilter } from './StepperFilter';
import { ToggleFilter } from './ToggleFilter';
import type {
    FilterDispatch,
    FilterGroup,
    FilterState,
    IconChipsFilterConfig
} from './filter.types';
import type {
    DualRangeFilterConfig,
    SelectSearchFilterConfig,
    StarsFilterConfig,
    StepperFilterConfig,
    ToggleFilterConfig
} from './index';

interface FilterGroupContentProps {
    readonly group: FilterGroup;
    readonly state: FilterState;
    readonly dispatch: FilterDispatch;
    readonly locale: SupportedLocale;
    /** Custom handler for search input changes (supports debounce from parent). */
    readonly onSearchChange?: (value: string) => void;
}

/**
 * Renders the appropriate filter control for a given filter group type.
 * Handles all 9 filter types: search, checkbox, radio, range, stepper,
 * stars, toggle, dual-range, select-search.
 */
export function FilterGroupContent({
    group,
    state,
    dispatch,
    locale,
    onSearchChange
}: FilterGroupContentProps) {
    const { t } = createTranslations(locale);

    if (group.type === 'search') {
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            if (onSearchChange) {
                onSearchChange(e.target.value);
            } else {
                dispatch({ type: 'SET_SEARCH', value: e.target.value });
            }
        };
        return (
            <input
                type="text"
                className={styles.searchInput}
                placeholder={group.placeholder ?? t('ui.filter.searchPlaceholder', 'Buscar...')}
                value={state.search}
                onChange={handleChange}
                aria-label={group.label}
            />
        );
    }

    if (group.type === 'checkbox') {
        return (
            <div className={styles.chipGroup}>
                {group.options?.map((opt) => {
                    const isActive = (state.selections[group.id] ?? []).includes(opt.value);
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            className={cn(styles.filterChip, isActive && styles.filterChipActive)}
                            onClick={() =>
                                dispatch({
                                    type: 'TOGGLE_CHECKBOX',
                                    groupId: group.id,
                                    value: opt.value
                                })
                            }
                            aria-pressed={isActive}
                        >
                            {opt.label}
                        </button>
                    );
                })}
            </div>
        );
    }

    if (group.type === 'radio') {
        return (
            <>
                {group.options?.map((opt) => (
                    <label
                        key={opt.value}
                        className={styles.radioLabel}
                    >
                        <input
                            type="radio"
                            className={styles.radio}
                            name={group.id}
                            checked={(state.selections[group.id] ?? [])[0] === opt.value}
                            onChange={() =>
                                dispatch({
                                    type: 'SET_RADIO',
                                    groupId: group.id,
                                    value: opt.value
                                })
                            }
                        />
                        {opt.label}
                    </label>
                ))}
            </>
        );
    }

    if (group.type === 'range') {
        return (
            <div className={styles.rangeInputs}>
                <input
                    type="number"
                    className={styles.rangeInput}
                    placeholder={String(group.min ?? 0)}
                    min={group.min}
                    max={group.max}
                    step={group.step}
                    value={state.ranges[group.id]?.min ?? ''}
                    onChange={(e) =>
                        dispatch({
                            type: 'SET_RANGE',
                            groupId: group.id,
                            field: 'min',
                            value: e.target.value
                        })
                    }
                    aria-label={`${group.label} ${t('ui.filter.min', 'mínimo')}`}
                />
                <span className={styles.rangeSeparator}>—</span>
                <input
                    type="number"
                    className={styles.rangeInput}
                    placeholder={String(group.max ?? 999999)}
                    min={group.min}
                    max={group.max}
                    step={group.step}
                    value={state.ranges[group.id]?.max ?? ''}
                    onChange={(e) =>
                        dispatch({
                            type: 'SET_RANGE',
                            groupId: group.id,
                            field: 'max',
                            value: e.target.value
                        })
                    }
                    aria-label={`${group.label} ${t('ui.filter.max', 'máximo')}`}
                />
            </div>
        );
    }

    if (group.type === 'stepper') {
        return (
            <StepperFilter
                config={group as StepperFilterConfig}
                value={
                    state.steppers[group.id] ??
                    (group as StepperFilterConfig).defaultValue ??
                    (group as StepperFilterConfig).min ??
                    0
                }
                onChange={(v) => dispatch({ type: 'SET_STEPPER', groupId: group.id, value: v })}
                locale={locale}
            />
        );
    }

    if (group.type === 'stars') {
        return (
            <StarsFilter
                config={group as StarsFilterConfig}
                value={state.steppers[group.id] ?? 0}
                onChange={(v) => dispatch({ type: 'SET_STEPPER', groupId: group.id, value: v })}
                locale={locale}
                includeNull={state.toggles[`${group.id}_includeNull`] ?? false}
                onIncludeNullChange={(v) =>
                    dispatch({ type: 'SET_TOGGLE', groupId: `${group.id}_includeNull`, value: v })
                }
            />
        );
    }

    if (group.type === 'toggle') {
        return (
            <ToggleFilter
                config={group as ToggleFilterConfig}
                value={state.toggles[group.id] ?? false}
                onChange={(v) => dispatch({ type: 'SET_TOGGLE', groupId: group.id, value: v })}
                locale={locale}
            />
        );
    }

    if (group.type === 'dual-range') {
        return (
            <DualRangeFilter
                config={group as DualRangeFilterConfig}
                value={state.ranges[group.id] ?? { min: '', max: '' }}
                onMinChange={(v) =>
                    dispatch({ type: 'SET_RANGE', groupId: group.id, field: 'min', value: v })
                }
                onMaxChange={(v) =>
                    dispatch({ type: 'SET_RANGE', groupId: group.id, field: 'max', value: v })
                }
                locale={locale}
                includeNull={state.toggles[`${group.id}_includeNull`] ?? false}
                onIncludeNullChange={(v) =>
                    dispatch({ type: 'SET_TOGGLE', groupId: `${group.id}_includeNull`, value: v })
                }
            />
        );
    }

    if (group.type === 'icon-chips') {
        const iconChipsConfig = group as IconChipsFilterConfig;
        return (
            <IconChipsFilter
                config={iconChipsConfig}
                value={state.selections[group.id] ?? []}
                onChange={(selected) => {
                    const current = state.selections[group.id] ?? [];
                    const toToggle = [
                        ...selected.filter((v) => !current.includes(v)),
                        ...current.filter((v) => !selected.includes(v))
                    ];
                    for (const v of toToggle) {
                        dispatch({ type: 'TOGGLE_CHECKBOX', groupId: group.id, value: v });
                    }
                }}
                locale={locale}
            />
        );
    }

    if (group.type === 'select-search') {
        const selectConfig = group as SelectSearchFilterConfig;
        return (
            <SelectSearchFilter
                config={selectConfig}
                value={state.selections[group.id] ?? []}
                onChange={(selected) => {
                    if (selectConfig.maxSelections === 1) {
                        // Single-select: replace selection directly
                        const newValue = selected[0];
                        if (newValue) {
                            dispatch({ type: 'SET_RADIO', groupId: group.id, value: newValue });
                        } else {
                            dispatch({
                                type: 'REMOVE_FILTER',
                                groupId: group.id,
                                value: (state.selections[group.id] ?? [])[0] ?? ''
                            });
                        }
                        return;
                    }
                    // Multi-select: diff and toggle
                    const current = state.selections[group.id] ?? [];
                    const toToggle = [
                        ...selected.filter((v) => !current.includes(v)),
                        ...current.filter((v) => !selected.includes(v))
                    ];
                    for (const v of toToggle) {
                        dispatch({ type: 'TOGGLE_CHECKBOX', groupId: group.id, value: v });
                    }
                }}
                locale={locale}
            />
        );
    }

    return null;
}
