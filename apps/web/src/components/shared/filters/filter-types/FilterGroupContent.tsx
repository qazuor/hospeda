/**
 * @file FilterGroupContent.tsx
 * @description Renders the inner content of a single filter group based on its type.
 * Used internally by FilterSidebar to keep the main component under 500 lines.
 */

import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { resolveIcon } from '@repo/icons';
import { DateRangeFilter } from './DateRangeFilter';
import { DualRangeFilter } from './DualRangeFilter';
import styles from './FilterGroupContent.module.css';
import { IconChipsFilter } from './IconChipsFilter';
import { PriceCompositeFilter } from './PriceCompositeFilter';
import { SearchFilter } from './SearchFilter';
import { SelectSearchFilter } from './SelectSearchFilter';
import { StarsFilter } from './StarsFilter';
import { StepperFilter } from './StepperFilter';
import { ToggleFilter } from './ToggleFilter';
import type {
    FilterDispatch,
    FilterGroup,
    FilterState,
    IconChipsFilterConfig,
    PriceCompositeFilterConfig
} from './filter.types';
import type {
    DateRangeFilterConfig,
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
        const commit = (next: string) => {
            if (onSearchChange) {
                onSearchChange(next);
            } else {
                dispatch({ type: 'SET_SEARCH', value: next });
            }
        };
        return (
            <SearchFilter
                value={state.search}
                onCommit={commit}
                placeholder={group.placeholder}
                ariaLabel={group.label}
                locale={locale}
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
        const priorityOptions = iconChipsConfig.priorityOptions;
        return (
            <div className={styles.iconChipsWrapper}>
                {priorityOptions && priorityOptions.length > 0 && (
                    <fieldset
                        className={styles.priorityChipsRow}
                        aria-label={`${iconChipsConfig.label} — destacados`}
                    >
                        {priorityOptions.map((opt) => (
                            <PriorityChipButton
                                key={opt.value}
                                label={opt.label}
                                icon={opt.icon}
                                isActive={state.toggles[opt.value] === true}
                                onToggle={() =>
                                    dispatch({
                                        type: 'SET_TOGGLE',
                                        groupId: opt.value,
                                        value: !state.toggles[opt.value]
                                    })
                                }
                            />
                        ))}
                    </fieldset>
                )}
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
            </div>
        );
    }

    if (group.type === 'price-composite') {
        const priceConfig = group as PriceCompositeFilterConfig;
        const isFree = !!state.toggles[`${priceConfig.id}_isFree`];
        const includeUnpriced = state.toggles[`${priceConfig.id}_includeUnpriced`] ?? true;
        return (
            <PriceCompositeFilter
                config={priceConfig}
                isFree={isFree}
                includeUnpriced={includeUnpriced}
                range={state.ranges[priceConfig.id] ?? { min: '', max: '' }}
                onIsFreeChange={(v) =>
                    dispatch({
                        type: 'SET_TOGGLE',
                        groupId: `${priceConfig.id}_isFree`,
                        value: v
                    })
                }
                onIncludeUnpricedChange={(v) =>
                    dispatch({
                        type: 'SET_TOGGLE',
                        groupId: `${priceConfig.id}_includeUnpriced`,
                        value: v
                    })
                }
                onMinChange={(v) =>
                    dispatch({
                        type: 'SET_RANGE',
                        groupId: priceConfig.id,
                        field: 'min',
                        value: v
                    })
                }
                onMaxChange={(v) =>
                    dispatch({
                        type: 'SET_RANGE',
                        groupId: priceConfig.id,
                        field: 'max',
                        value: v
                    })
                }
                locale={locale}
            />
        );
    }

    if (group.type === 'date-range') {
        const dateConfig = group as DateRangeFilterConfig;
        return (
            <DateRangeFilter
                config={dateConfig}
                value={state.dates[group.id] ?? { from: '', to: '' }}
                onChange={(next) =>
                    dispatch({
                        type: 'SET_DATE_RANGE',
                        groupId: group.id,
                        from: next.from,
                        to: next.to
                    })
                }
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

/**
 * Standalone chip rendered above the regular icon-chips list for a "priority"
 * (boolean shortcut) option. Same visual language as the normal chips but
 * with a stronger active state so users perceive these as the marquee
 * quick-filters of the group (e.g. "WiFi", "Pileta", "Estacionamiento").
 */
interface PriorityChipButtonProps {
    readonly label: string;
    readonly icon?: string;
    readonly isActive: boolean;
    readonly onToggle: () => void;
}

function PriorityChipButton({ label, icon, isActive, onToggle }: PriorityChipButtonProps) {
    const IconComponent = icon ? resolveIcon({ iconName: icon }) : undefined;
    return (
        <button
            type="button"
            className={cn(styles.priorityChip, isActive && styles.priorityChipActive)}
            aria-pressed={isActive}
            onClick={onToggle}
        >
            {IconComponent && (
                <span
                    className={styles.priorityChipIcon}
                    aria-hidden="true"
                >
                    <IconComponent
                        size={14}
                        weight="duotone"
                    />
                </span>
            )}
            {label}
        </button>
    );
}
