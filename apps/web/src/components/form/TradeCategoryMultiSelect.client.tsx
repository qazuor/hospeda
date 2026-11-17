/**
 * @file TradeCategoryMultiSelect.client.tsx
 * @description Grouped, searchable multi-select combobox for the provider trade
 * category catalog (HOS-919 US-1).
 *
 * A separate component from `SearchableSelect` on purpose: that one is
 * single-value (`value: T | null`) and bolting groups plus multi-select onto it
 * would double its branches. This one reuses its conventions instead: the
 * global `.combobox*` classes for the field, the listbox and the options, and
 * the same ARIA vocabulary.
 *
 * Behaviour:
 * - Options appear under group headers in catalog order. Typing filters them
 *   through `matchCatalogQuery` (accent/case-insensitive prefix match over the
 *   name and related words), and groups with no match disappear.
 * - Selected categories show as removable chips. Backspace on an empty input
 *   removes the last chip.
 * - At `max` selections every unselected option is disabled, and the reason is
 *   written on screen, not only in a tooltip.
 * - With no match the list shows an empty state plus the hint that the trade
 *   can be written in the message.
 *
 * Keyboard (WAI-ARIA combobox, multi-select listbox): ArrowDown/ArrowUp move
 * the highlight (ArrowDown also opens), Enter toggles the highlighted option,
 * Space toggles it only while the input is empty (otherwise it is a typed
 * character, because a query like "aire acond" has spaces), Escape closes,
 * Backspace on an empty input removes the last chip. The list stays open after
 * a toggle so several categories can be picked in a row.
 *
 * The component is controlled: the parent owns `value` (an array of slugs).
 *
 * Hydration: `client:idle` or `client:visible` is enough. It sits inside a form
 * the visitor has to scroll to.
 */

import { CheckIcon, ChevronDownIcon, CloseIcon } from '@repo/icons';
import type { PublicHostTradeCatalog } from '@repo/schemas';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { matchCatalogQuery } from '@/lib/search/match-catalog-query';
import styles from './TradeCategoryMultiSelect.module.css';

/** Groups of the public catalog, as served by `GET /api/v1/public/host-trade-categories`. */
export type TradeCategoryGroups = PublicHostTradeCatalog['groups'];

type TradeCategoryGroup = TradeCategoryGroups[number];
type TradeCategory = TradeCategoryGroup['categories'][number];

/** Default cap on selected categories (matches the server-side limit). */
export const TRADE_CATEGORY_MAX_SELECTION = 10;

/** Props for {@link TradeCategoryMultiSelect}. */
export interface TradeCategoryMultiSelectProps {
    /** Active locale (drives labels and the search locale). */
    readonly locale: SupportedLocale;
    /** Catalog groups, already ordered (group weight, then category weight). */
    readonly groups: TradeCategoryGroups;
    /** Selected category slugs. */
    readonly value: readonly string[];
    /** Fired with the next full selection whenever it changes. */
    readonly onChange: (next: readonly string[]) => void;
    /** Maximum number of selections. Defaults to {@link TRADE_CATEGORY_MAX_SELECTION}. */
    readonly max?: number;
    /** Optional explicit input id (falls back to a generated one). */
    readonly inputId?: string;
    /** Label rendered above the field. */
    readonly label?: string;
    /** Visible required asterisk and `aria-required` flag. */
    readonly required?: boolean;
    /** Inline validation message rendered below the field. */
    readonly error?: string | null;
    /** Overrides the default placeholder. */
    readonly placeholder?: string;
    /** Disables interaction. */
    readonly disabled?: boolean;
    /** Optional `data-testid` prefix for the input and the listbox. */
    readonly testId?: string;
}

/** Display name of a group or category in the active locale, falling back to Spanish. */
function localizedName(
    nameI18n: { readonly es: string; readonly en?: string; readonly pt?: string },
    locale: SupportedLocale
): string {
    const own = nameI18n[locale];
    return own && own.length > 0 ? own : nameI18n.es;
}

/**
 * Grouped searchable multi-select for provider trade categories.
 *
 * @param props - {@link TradeCategoryMultiSelectProps}
 * @returns The combobox, its chips and its optional error line.
 */
export function TradeCategoryMultiSelect({
    locale,
    groups,
    value,
    onChange,
    max = TRADE_CATEGORY_MAX_SELECTION,
    inputId,
    label,
    required = false,
    error,
    placeholder,
    disabled = false,
    testId
}: TradeCategoryMultiSelectProps) {
    const { t } = createTranslations(locale);

    const generatedId = useId();
    const fieldId = inputId ?? `trade-category-${generatedId}`;
    const listboxId = `${fieldId}-listbox`;
    const errorId = error ? `${fieldId}-error` : undefined;
    const limitId = `${fieldId}-limit`;

    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const selected = useMemo(() => new Set(value), [value]);
    const limitReached = value.length >= max;

    const bySlug = useMemo(() => {
        const map = new Map<string, TradeCategory>();
        for (const group of groups) {
            for (const category of group.categories) map.set(category.slug, category);
        }
        return map;
    }, [groups]);

    const visibleGroups = useMemo(
        () => matchCatalogQuery({ catalog: { groups }, query, locale }).groups,
        [groups, query, locale]
    );

    const flatOptions = useMemo(
        () => visibleGroups.flatMap((group) => group.categories),
        [visibleGroups]
    );

    useEffect(() => {
        function handleDocumentMouseDown(event: MouseEvent): void {
            if (!containerRef.current) return;
            if (containerRef.current.contains(event.target as Node)) return;
            setIsOpen(false);
            setHighlightedIndex(-1);
        }
        document.addEventListener('mousedown', handleDocumentMouseDown);
        return () => document.removeEventListener('mousedown', handleDocumentMouseDown);
    }, []);

    const optionId = (slug: string): string => `${listboxId}-option-${slug}`;

    const isDisabledOption = useCallback(
        (slug: string): boolean => limitReached && !selected.has(slug),
        [limitReached, selected]
    );

    const toggle = useCallback(
        (slug: string) => {
            if (disabled) return;
            if (selected.has(slug)) {
                onChange(value.filter((current) => current !== slug));
            } else {
                if (value.length >= max) return;
                onChange([...value, slug]);
            }
            setQuery('');
            setHighlightedIndex(-1);
        },
        [disabled, max, onChange, selected, value]
    );

    const removeLast = useCallback(() => {
        if (value.length === 0) return;
        onChange(value.slice(0, -1));
    }, [onChange, value]);

    const handleKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLInputElement>) => {
            const count = flatOptions.length;

            if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (count === 0) return;
                if (!isOpen) {
                    setIsOpen(true);
                    setHighlightedIndex(0);
                    return;
                }
                setHighlightedIndex((prev) => (prev + 1) % count);
                return;
            }

            if (event.key === 'ArrowUp') {
                event.preventDefault();
                if (count === 0) return;
                if (!isOpen) {
                    setIsOpen(true);
                    setHighlightedIndex(count - 1);
                    return;
                }
                setHighlightedIndex((prev) => (prev <= 0 ? count - 1 : prev - 1));
                return;
            }

            const highlighted = highlightedIndex >= 0 ? flatOptions[highlightedIndex] : undefined;

            if (event.key === 'Enter') {
                // Never submit the surrounding form while the list is the thing
                // being operated; only an open list with a highlight consumes Enter.
                if (!isOpen || !highlighted) return;
                event.preventDefault();
                if (!isDisabledOption(highlighted.slug)) toggle(highlighted.slug);
                return;
            }

            if (event.key === ' ' && query.length === 0 && isOpen && highlighted) {
                event.preventDefault();
                if (!isDisabledOption(highlighted.slug)) toggle(highlighted.slug);
                return;
            }

            if (event.key === 'Escape') {
                if (!isOpen) return;
                event.preventDefault();
                setIsOpen(false);
                setHighlightedIndex(-1);
                return;
            }

            if (event.key === 'Backspace' && query.length === 0) {
                removeLast();
            }
        },
        [flatOptions, highlightedIndex, isDisabledOption, isOpen, query, removeLast, toggle]
    );

    const activeDescendant =
        isOpen && highlightedIndex >= 0 && flatOptions[highlightedIndex]
            ? optionId(flatOptions[highlightedIndex].slug)
            : undefined;

    const showEmpty = isOpen && flatOptions.length === 0;
    const limitText = t(
        'ui.tradeCategorySelect.maxReached',
        'Llegaste al máximo de {{max}} rubros',
        {
            max
        }
    );

    return (
        <div
            ref={containerRef}
            className="combobox"
        >
            {label && (
                <label
                    className="form-label"
                    htmlFor={fieldId}
                >
                    {label}
                    {required && (
                        <span
                            className="form-required"
                            aria-hidden="true"
                        >
                            *
                        </span>
                    )}
                </label>
            )}

            {value.length > 0 && (
                <ul
                    className={styles.chips}
                    aria-label={t('ui.tradeCategorySelect.selectedLabel', 'Rubros elegidos')}
                >
                    {value.map((slug) => {
                        const category = bySlug.get(slug);
                        const name = category ? localizedName(category.nameI18n, locale) : slug;
                        return (
                            <li
                                key={slug}
                                className={styles.chip}
                            >
                                <span className={styles.chipLabel}>{name}</span>
                                <button
                                    type="button"
                                    className={styles.chipRemove}
                                    disabled={disabled}
                                    aria-label={t(
                                        'ui.tradeCategorySelect.removeChip',
                                        'Quitar {{name}}',
                                        {
                                            name
                                        }
                                    )}
                                    onClick={() =>
                                        onChange(value.filter((current) => current !== slug))
                                    }
                                >
                                    <CloseIcon
                                        size={12}
                                        weight="bold"
                                        aria-hidden="true"
                                    />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            <div className="combobox__input-wrap">
                <input
                    id={fieldId}
                    type="text"
                    role="combobox"
                    className="form-input combobox__input"
                    value={query}
                    placeholder={
                        placeholder ??
                        t(
                            'ui.tradeCategorySelect.placeholder',
                            'Buscá tu oficio (ej. plomería, aire acondicionado)'
                        )
                    }
                    autoComplete="off"
                    disabled={disabled}
                    aria-autocomplete="list"
                    aria-expanded={isOpen}
                    aria-haspopup="listbox"
                    aria-controls={listboxId}
                    aria-activedescendant={activeDescendant}
                    aria-required={required ? 'true' : undefined}
                    aria-invalid={error ? 'true' : undefined}
                    aria-describedby={
                        [errorId, limitReached ? limitId : undefined].filter(Boolean).join(' ') ||
                        undefined
                    }
                    data-testid={testId ? `${testId}-input` : undefined}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setIsOpen(true);
                        setHighlightedIndex(0);
                    }}
                    onClick={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                />
                <span
                    className="combobox__indicator"
                    aria-hidden="true"
                >
                    <ChevronDownIcon
                        size={16}
                        weight="regular"
                        aria-hidden="true"
                    />
                </span>

                <div
                    id={listboxId}
                    role="listbox"
                    tabIndex={-1}
                    aria-multiselectable="true"
                    aria-label={t('ui.tradeCategorySelect.optionsLabel', 'Rubros disponibles')}
                    className="combobox__listbox"
                    hidden={!isOpen}
                    data-testid={testId ? `${testId}-listbox` : undefined}
                >
                    {showEmpty && (
                        <div className="combobox__status">
                            <p className={styles.emptyTitle}>
                                {t('ui.tradeCategorySelect.empty', 'No encontramos ese rubro')}
                            </p>
                            <p className={styles.emptyHint}>
                                {t(
                                    'ui.tradeCategorySelect.emptyHint',
                                    'Si tu oficio no está, escribilo en el mensaje'
                                )}
                            </p>
                        </div>
                    )}
                    {visibleGroups.map((group) => {
                        const headerId = `${listboxId}-group-${group.slug}`;
                        return (
                            // biome-ignore lint/a11y/useSemanticElements: a <fieldset> is not allowed inside role="listbox"; WAI-ARIA's grouped listbox pattern uses role="group" with aria-labelledby (HOS-919 AC-1.8).
                            <div
                                key={group.slug}
                                role="group"
                                aria-labelledby={headerId}
                                className={styles.group}
                            >
                                <div
                                    id={headerId}
                                    className={styles.groupHeader}
                                >
                                    {localizedName(group.nameI18n, locale)}
                                </div>
                                {group.categories.map((category) => {
                                    const index = flatOptions.indexOf(category);
                                    const isSelected = selected.has(category.slug);
                                    const isOptionDisabled = isDisabledOption(category.slug);
                                    const classes = [
                                        'combobox__option',
                                        index === highlightedIndex &&
                                            'combobox__option--highlighted',
                                        isSelected && 'combobox__option--selected',
                                        isOptionDisabled && styles.optionDisabled
                                    ]
                                        .filter(Boolean)
                                        .join(' ');
                                    return (
                                        <div
                                            key={category.slug}
                                            id={optionId(category.slug)}
                                            role="option"
                                            tabIndex={-1}
                                            aria-selected={isSelected}
                                            aria-disabled={isOptionDisabled ? 'true' : undefined}
                                            aria-describedby={
                                                isOptionDisabled ? limitId : undefined
                                            }
                                            className={classes}
                                            data-testid={
                                                testId
                                                    ? `${testId}-option-${category.slug}`
                                                    : undefined
                                            }
                                            onMouseDown={(event) => {
                                                // Keep focus on the input so the keyboard flow
                                                // survives a mouse selection.
                                                event.preventDefault();
                                                if (!isOptionDisabled) toggle(category.slug);
                                            }}
                                            onMouseEnter={() => setHighlightedIndex(index)}
                                        >
                                            <span
                                                className="combobox__option-check"
                                                aria-hidden="true"
                                            >
                                                {isSelected && (
                                                    <CheckIcon
                                                        size={12}
                                                        weight="bold"
                                                        aria-hidden="true"
                                                    />
                                                )}
                                            </span>
                                            <span className="combobox__option-label">
                                                {localizedName(category.nameI18n, locale)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>

            {limitReached && (
                <p
                    id={limitId}
                    className={styles.limit}
                    aria-live="polite"
                >
                    {limitText}
                </p>
            )}

            {error ? (
                <p
                    id={errorId}
                    className="form-error"
                    role="alert"
                >
                    {error}
                </p>
            ) : null}
        </div>
    );
}
