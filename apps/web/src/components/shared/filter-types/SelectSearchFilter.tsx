/**
 * @file SelectSearchFilter.tsx
 * @description Searchable multi-select filter with inline checkbox list,
 * selected chips, and "show more/less" collapse for large option sets.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useState } from 'react';
import styles from '../FilterSidebar.module.css';

/** Configuration for a select-search filter group. */
export interface SelectSearchFilterConfig {
    readonly id: string;
    readonly label: string;
    readonly type: 'select-search';
    readonly options: readonly { readonly value: string; readonly label: string }[];
    readonly maxVisible?: number;
    /** When set to 1, behaves as single-select (radio-style with search). */
    readonly maxSelections?: number;
}

interface SelectSearchFilterProps {
    readonly config: SelectSearchFilterConfig;
    readonly value: readonly string[];
    readonly onChange: (selected: readonly string[]) => void;
    readonly locale: SupportedLocale;
}

/**
 * Searchable multi-select filter. Options are filtered as the user types.
 * Exceeding `maxVisible` options are hidden behind a "show more" toggle.
 * Selected options are shown as removable mini-chips above the search input.
 */
export function SelectSearchFilter({ config, value, onChange, locale }: SelectSearchFilterProps) {
    const { t } = createTranslations(locale);
    const [searchText, setSearchText] = useState('');
    const [showAll, setShowAll] = useState(false);
    const maxVisible = config.maxVisible ?? 8;

    const filtered = config.options.filter((opt) =>
        opt.label.toLowerCase().includes(searchText.toLowerCase())
    );

    const visibleOptions = showAll ? filtered : filtered.slice(0, maxVisible);
    const hasMore = filtered.length > maxVisible;

    const toggleOption = (optValue: string) => {
        if (value.includes(optValue)) {
            onChange(value.filter((v) => v !== optValue));
        } else if (config.maxSelections === 1) {
            // Single-select mode: replace current selection
            onChange([optValue]);
        } else {
            onChange([...value, optValue]);
        }
    };

    const selectedOptions = config.options.filter((opt) => value.includes(opt.value));

    return (
        <div className={styles.selectSearch}>
            {selectedOptions.length > 0 && (
                <div
                    className={styles.selectSearchChips}
                    aria-label={t('ui.filter.selected', 'seleccionados')}
                >
                    {selectedOptions.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            className={styles.selectSearchChip}
                            onClick={() => toggleOption(opt.value)}
                            aria-label={`${t('ui.filter.remove', 'Quitar filtro')}: ${opt.label}`}
                        >
                            {opt.label}
                            <span
                                className={styles.chipX}
                                aria-hidden="true"
                            >
                                &times;
                            </span>
                        </button>
                    ))}
                </div>
            )}

            <input
                type="text"
                className={styles.selectSearchInput}
                placeholder={t('ui.filter.searchOptions', 'Buscar...')}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                aria-label={t('ui.filter.searchOptions', 'Buscar...')}
                autoComplete="off"
            />

            <fieldset className={styles.selectSearchList}>
                <legend className={styles.visuallyHidden}>{config.label}</legend>
                {visibleOptions.map((opt) => {
                    const isChecked = value.includes(opt.value);
                    return (
                        <label
                            key={opt.value}
                            className={styles.checkboxLabel}
                        >
                            <input
                                type="checkbox"
                                className={styles.checkbox}
                                checked={isChecked}
                                onChange={() => toggleOption(opt.value)}
                            />
                            {opt.label}
                        </label>
                    );
                })}

                {hasMore && (
                    <button
                        type="button"
                        className={styles.selectSearchToggle}
                        onClick={() => setShowAll((prev) => !prev)}
                    >
                        {showAll
                            ? t('ui.filter.showLess', 'Ver menos')
                            : t('ui.filter.showMore', 'Ver más')}
                    </button>
                )}
            </fieldset>
        </div>
    );
}
