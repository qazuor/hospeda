/**
 * @file IconChipsFilter.tsx
 * @description Filter component that renders options as icon+label chips.
 * Shows the first `maxVisible` options inline, with a "Ver más" button that
 * opens a native <dialog> with all options, a search input, and optional
 * category grouping.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { resolveIcon } from '@repo/icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './IconChipsFilter.module.css';
import type { IconChipsFilterConfig } from './filter.types';

/** Props for the IconChipsFilter component. */
interface IconChipsFilterProps {
    readonly config: IconChipsFilterConfig;
    readonly value: readonly string[];
    readonly onChange: (selected: readonly string[]) => void;
    readonly locale: SupportedLocale;
}

/** Single chip button rendered inline or in the dialog. */
interface ChipButtonProps {
    readonly optionValue: string;
    readonly label: string;
    readonly icon?: string;
    readonly isActive: boolean;
    readonly onToggle: (v: string) => void;
}

function ChipButton({ optionValue, label, icon, isActive, onToggle }: ChipButtonProps) {
    const IconComponent = icon ? resolveIcon({ iconName: icon }) : undefined;
    return (
        <button
            type="button"
            className={[styles.iconChip, isActive ? styles.iconChipActive : '']
                .filter(Boolean)
                .join(' ')}
            aria-pressed={isActive}
            onClick={() => onToggle(optionValue)}
        >
            {IconComponent && (
                <span
                    className={styles.iconChipIcon}
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

/**
 * Renders options as interactive icon+label chips with a "Ver más" dialog.
 * Uses the native <dialog> element with showModal() for accessibility.
 */
export function IconChipsFilter({ config, value, onChange, locale }: IconChipsFilterProps) {
    const { t } = createTranslations(locale);
    const maxVisible = config.maxVisible ?? 10;
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [dialogSearch, setDialogSearch] = useState('');

    const visibleOptions = config.options.slice(0, maxVisible);
    const hiddenCount = config.options.length - maxVisible;

    const handleToggle = useCallback(
        (optionValue: string) => {
            const next = value.includes(optionValue)
                ? value.filter((v) => v !== optionValue)
                : [...value, optionValue];
            onChange(next);
        },
        [value, onChange]
    );

    const openDialog = useCallback(() => {
        setDialogSearch('');
        dialogRef.current?.showModal();
    }, []);

    const closeDialog = useCallback(() => {
        dialogRef.current?.close();
    }, []);

    // Close dialog on backdrop click (click outside the panel)
    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const handleClick = (e: MouseEvent) => {
            if (e.target === dialog) {
                dialog.close();
            }
        };
        dialog.addEventListener('click', handleClick);
        return () => dialog.removeEventListener('click', handleClick);
    }, []);

    // Filter options by dialog search query
    const filteredOptions = dialogSearch
        ? config.options.filter((opt) =>
              opt.label.toLowerCase().includes(dialogSearch.toLowerCase())
          )
        : config.options;

    // Separate selected from unselected in the dialog
    const selectedOptions = filteredOptions.filter((opt) => value.includes(opt.value));
    const unselectedOptions = filteredOptions.filter((opt) => !value.includes(opt.value));

    // Build category groups for the dialog (only when no search active)
    const categoryEntries = config.categories ? Object.entries(config.categories) : [];
    const hasCategories = categoryEntries.length > 0 && !dialogSearch;

    return (
        <div className={styles.chipGroup}>
            {/* Inline visible chips */}
            {visibleOptions.map((opt) => (
                <ChipButton
                    key={opt.value}
                    optionValue={opt.value}
                    label={opt.label}
                    icon={opt.icon}
                    isActive={value.includes(opt.value)}
                    onToggle={handleToggle}
                />
            ))}

            {/* "Ver más" button — only shown when there are hidden options */}
            {hiddenCount > 0 && (
                <button
                    type="button"
                    className={styles.showMoreBtn}
                    onClick={openDialog}
                    aria-label={t('ui.filter.showMore', `Ver más (+${hiddenCount})`).replace(
                        '{{count}}',
                        String(hiddenCount)
                    )}
                >
                    +{hiddenCount}
                </button>
            )}

            {/* Full-options dialog */}
            <dialog
                ref={dialogRef}
                className={styles.iconChipsDialog}
                aria-label={config.label}
            >
                <div className={styles.iconChipsDialogPanel}>
                    {/* Header */}
                    <div className={styles.iconChipsDialogHeader}>
                        <h3 className={styles.iconChipsDialogTitle}>{config.label}</h3>
                        <button
                            type="button"
                            className={styles.iconChipsDialogClose}
                            onClick={closeDialog}
                            aria-label={t('ui.filter.close', 'Cerrar')}
                        >
                            &times;
                        </button>
                    </div>

                    {/* Search input */}
                    <div className={styles.iconChipsDialogSearch}>
                        <input
                            type="text"
                            className={styles.searchInput}
                            placeholder={t('ui.filter.searchOptions', 'Buscar...')}
                            value={dialogSearch}
                            onChange={(e) => setDialogSearch(e.target.value)}
                            aria-label={t('ui.filter.searchOptions', 'Buscar opciones')}
                        />
                    </div>

                    {/* Body */}
                    <div className={styles.iconChipsDialogBody}>
                        {/* Selected options section */}
                        {selectedOptions.length > 0 && (
                            <>
                                <p className={styles.iconChipsDialogCategory}>
                                    {t('ui.filter.selected', 'Seleccionados')}
                                </p>
                                <div className={styles.chipGroup}>
                                    {selectedOptions.map((opt) => (
                                        <ChipButton
                                            key={opt.value}
                                            optionValue={opt.value}
                                            label={opt.label}
                                            icon={opt.icon}
                                            isActive={true}
                                            onToggle={handleToggle}
                                        />
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Category groups (only when no search) */}
                        {hasCategories
                            ? categoryEntries.map(([categoryName, optionValues]) => {
                                  const categoryOpts = unselectedOptions.filter((opt) =>
                                      optionValues.includes(opt.value)
                                  );
                                  if (categoryOpts.length === 0) return null;
                                  return (
                                      <div key={categoryName}>
                                          <p className={styles.iconChipsDialogCategory}>
                                              {categoryName}
                                          </p>
                                          <div className={styles.chipGroup}>
                                              {categoryOpts.map((opt) => (
                                                  <ChipButton
                                                      key={opt.value}
                                                      optionValue={opt.value}
                                                      label={opt.label}
                                                      icon={opt.icon}
                                                      isActive={false}
                                                      onToggle={handleToggle}
                                                  />
                                              ))}
                                          </div>
                                      </div>
                                  );
                              })
                            : unselectedOptions.length > 0 && (
                                  <div className={styles.chipGroup}>
                                      {unselectedOptions.map((opt) => (
                                          <ChipButton
                                              key={opt.value}
                                              optionValue={opt.value}
                                              label={opt.label}
                                              icon={opt.icon}
                                              isActive={false}
                                              onToggle={handleToggle}
                                          />
                                      ))}
                                  </div>
                              )}

                        {filteredOptions.length === 0 && (
                            <p
                                className={styles.iconChipsDialogCategory}
                                style={{ textAlign: 'center', padding: '1rem 0' }}
                            >
                                {t('ui.filter.noResults', 'Sin resultados')}
                            </p>
                        )}
                    </div>
                </div>
            </dialog>
        </div>
    );
}
