/**
 * @file FilterGroup.tsx
 * @description Collapsible filter group with header, chevron, optional reset button,
 * and active-state dot indicator. Renders its children as the group body.
 */

import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { ReactNode } from 'react';
import styles from './FilterGroup.module.css';

/** Props for the FilterGroup component. */
export interface FilterGroupProps {
    /** Unique group identifier — used for aria IDs and test selectors. */
    readonly id: string;
    /** Display label shown in the group header button. */
    readonly label: string;
    /** Locale for translated UI strings (expand/collapse/reset). */
    readonly locale: SupportedLocale;
    /** Whether the group is currently collapsed. */
    readonly collapsed: boolean;
    /** Whether this group has at least one active filter selection. */
    readonly hasActive: boolean;
    /**
     * Number of selected options for multi-select families (checkbox / radio /
     * select-search / icon-chips). When provided and > 0, renders a `[N]`
     * badge next to the label so the count is visible without expanding the
     * group. `null` / `undefined` for filter types where a count is not
     * meaningful (toggle, stepper, range, date-range, search).
     */
    readonly activeCount?: number | null;
    /** Called when the user clicks the header or chevron to toggle collapsed state. */
    readonly onToggle: () => void;
    /** Called when the user clicks the per-group reset button. */
    readonly onReset: () => void;
    /** Filter controls rendered inside the collapsible body. */
    readonly children: ReactNode;
}

/**
 * Collapsible filter group wrapper.
 * Renders the group label as an expand/collapse toggle button,
 * an optional reset button when the group has an active selection,
 * a chevron indicator, and the filter content in a collapsible region.
 *
 * @param props - See {@link FilterGroupProps}.
 */
export function FilterGroup({
    id,
    label,
    locale,
    collapsed,
    hasActive,
    activeCount,
    onToggle,
    onReset,
    children
}: FilterGroupProps) {
    const { t } = createTranslations(locale);
    const showCountBadge = typeof activeCount === 'number' && activeCount > 0;

    return (
        <fieldset
            className={cn(styles.group, hasActive && styles.groupActive)}
            aria-labelledby={`filter-${id}`}
        >
            <div className={styles.groupHeader}>
                <button
                    type="button"
                    className={styles.groupToggle}
                    onClick={onToggle}
                    id={`filter-${id}`}
                    aria-expanded={!collapsed}
                >
                    <span className={styles.groupToggleLabel}>
                        {hasActive && (
                            <span
                                className={styles.groupActiveDot}
                                aria-hidden="true"
                            />
                        )}
                        {label}
                        {showCountBadge && (
                            <span
                                className={styles.groupCountBadge}
                                aria-label={t(
                                    'ui.filter.activeSelections',
                                    `${activeCount} selecciones activas`
                                ).replace('{{count}}', String(activeCount))}
                            >
                                {activeCount}
                            </span>
                        )}
                    </span>
                </button>
                <span className={styles.groupHeaderActions}>
                    {hasActive && (
                        <button
                            type="button"
                            className={styles.groupReset}
                            onClick={onReset}
                            aria-label={`${t('ui.filter.reset', 'Limpiar')} ${label}`}
                        >
                            ×
                        </button>
                    )}
                    <button
                        type="button"
                        className={styles.chevronBtn}
                        onClick={onToggle}
                        aria-label={
                            collapsed
                                ? t('ui.filter.expand', 'Expandir')
                                : t('ui.filter.collapse', 'Colapsar')
                        }
                    >
                        <span
                            className={cn(styles.chevron, collapsed && styles.chevronCollapsed)}
                            aria-hidden="true"
                        >
                            ▾
                        </span>
                    </button>
                </span>
            </div>

            <div className={cn(styles.groupContent, collapsed && styles.groupContentCollapsed)}>
                {children}
            </div>
        </fieldset>
    );
}
