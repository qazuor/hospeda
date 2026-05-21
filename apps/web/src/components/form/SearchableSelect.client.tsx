/**
 * @file SearchableSelect.client.tsx
 * @description Shared single-select combobox with search. Supports two modes:
 *
 *   - **Local**: caller passes `items` and the component filters by case-
 *     insensitive substring on the user's query (used by the home page
 *     destination/type panels which pre-fetch their options at SSR).
 *   - **Async**: caller passes `loadItems(query)` and the component debounces
 *     fetches as the user types (used by the property-publishing form's
 *     city picker, which hits the public destinations API).
 *
 * Visual language matches the home page search panel: rich items with an
 * optional icon affordance, hover/highlighted state, and a selected pill.
 * All styling lives in `apps/web/src/styles/components.css` under the
 * `.combobox*` namespace so future forms can drop this island in without
 * carrying its own stylesheet.
 *
 * The component is fully keyboard-navigable (ArrowUp/Down, Enter, Escape)
 * and ARIA-correct (combobox + listbox + option roles, aria-activedescendant).
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { IconProps } from '@repo/icons';
import type { ComponentType, ReactNode } from 'react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * An item displayed inside a {@link SearchableSelect} dropdown.
 *
 * Extends with arbitrary metadata via the type parameter so callers can pass
 * domain-specific shapes (e.g. a destination with a `slug`) and recover the
 * full object from `onChange` instead of just an id.
 */
export type SelectableItem = {
    readonly id: string;
    readonly label: string;
    /** Optional Phosphor icon component rendered in a 32px badge. */
    readonly icon?: ComponentType<IconProps>;
};

/** Props for {@link SearchableSelect}. */
export type SearchableSelectProps<T extends SelectableItem> = {
    /** Active locale (drives default labels via i18n). */
    readonly locale: SupportedLocale;
    /** Currently selected item, or `null` if nothing is selected. */
    readonly value: T | null;
    /** Fired when the user picks an item or clears the selection. */
    readonly onChange: (item: T | null) => void;
    /**
     * Local mode: full set of items. Filtering happens client-side on the
     * trimmed query (case-insensitive substring). Mutually exclusive with
     * `loadItems`.
     */
    readonly items?: ReadonlyArray<T>;
    /**
     * Async mode: invoked with the trimmed query whenever the user types.
     * Debounced by `debounceMs`. Mutually exclusive with `items`.
     */
    readonly loadItems?: (query: string) => Promise<ReadonlyArray<T>>;
    /**
     * Minimum characters before fetching/filtering applies. Defaults to 0
     * for local mode (shows the full list on open) and 2 for async mode.
     */
    readonly minQueryLength?: number;
    /** Debounce window for async fetches, in ms. Defaults to 300. */
    readonly debounceMs?: number;
    /** Optional explicit input id (falls back to a generated one). */
    readonly inputId?: string;
    /** Label rendered above the input (matches the rest of the form). */
    readonly label?: string;
    /** Visible required asterisk and `aria-required` flag. */
    readonly required?: boolean;
    /** Inline placeholder shown when the field is empty. */
    readonly placeholder?: string;
    /** Status text rendered while async loading is in flight. */
    readonly loadingLabel?: string;
    /** Status text rendered when the query yields no matches. */
    readonly emptyLabel?: string;
    /** Inline validation message rendered below the field. */
    readonly error?: string | null;
    /** Disables interaction. */
    readonly disabled?: boolean;
    /** Arbitrary footer slot rendered below the dropdown (e.g. a help link). */
    readonly footer?: ReactNode;
    /** Optional `data-testid` prefix; auto-applied to the input + listbox. */
    readonly testId?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Case-insensitive substring filter used in local mode. */
function filterLocalItems<T extends SelectableItem>(
    items: ReadonlyArray<T>,
    query: string
): ReadonlyArray<T> {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return items;
    return items.filter((item) => item.label.toLowerCase().includes(needle));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Searchable single-select combobox. See file header for usage modes.
 *
 * @param props - {@link SearchableSelectProps}
 * @returns The React island that renders the input + dropdown.
 */
export function SearchableSelect<T extends SelectableItem>({
    locale,
    value,
    onChange,
    items,
    loadItems,
    minQueryLength,
    debounceMs = 300,
    inputId,
    label,
    required = false,
    placeholder,
    loadingLabel,
    emptyLabel,
    error,
    disabled = false,
    footer,
    testId
}: SearchableSelectProps<T>) {
    const { t } = createTranslations(locale);

    const generatedId = useId();
    const fieldId = inputId ?? `searchable-select-${generatedId}`;
    const listboxId = `${fieldId}-listbox`;
    const errorId = error ? `${fieldId}-error` : undefined;

    const isAsync = typeof loadItems === 'function';
    const effectiveMinQuery = minQueryLength ?? (isAsync ? 2 : 0);

    // The input "query" is what the user typed — distinct from the selected
    // item's label. On select we sync them; while typing they diverge.
    const [query, setQuery] = useState<string>(value?.label ?? '');
    const [results, setResults] = useState<ReadonlyArray<T>>(items ?? []);
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

    const containerRef = useRef<HTMLDivElement | null>(null);
    const skipNextFetchRef = useRef<boolean>(false);

    // Sync the input when an item is set from the outside (parent assigned
    // a value programmatically — e.g. resuming a draft). We deliberately do
    // NOT mirror the transition from non-null → null here: that path is
    // commonly triggered by our own input handler when the user starts
    // editing a previously selected value, and blanking the query mid-typing
    // would wipe the keystrokes from under them.
    useEffect(() => {
        if (value) {
            setQuery(value.label);
        }
    }, [value]);

    // Local mode: synchronous filter on every query change.
    useEffect(() => {
        if (!items) return;
        const trimmed = query.trim();
        if (trimmed.length < effectiveMinQuery) {
            setResults(items);
            return;
        }
        const filtered = filterLocalItems(items, trimmed);
        setResults(filtered);
        setHighlightedIndex(filtered.length > 0 ? 0 : -1);
    }, [items, query, effectiveMinQuery]);

    // Async mode: debounced fetch.
    useEffect(() => {
        if (!loadItems) return;
        if (skipNextFetchRef.current) {
            skipNextFetchRef.current = false;
            return;
        }

        const trimmed = query.trim();
        if (trimmed.length < effectiveMinQuery) {
            setResults([]);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);
        const handle = window.setTimeout(async () => {
            try {
                const next = await loadItems(trimmed);
                if (cancelled) return;
                setResults(next);
                setHighlightedIndex(next.length > 0 ? 0 : -1);
                setIsOpen(next.length > 0);
            } catch {
                // Surface as empty results — keeps the UI consistent and the
                // caller can render a recovery action via the `footer` slot.
                if (!cancelled) setResults([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, debounceMs);

        return () => {
            cancelled = true;
            window.clearTimeout(handle);
        };
    }, [loadItems, query, effectiveMinQuery, debounceMs]);

    // Close when the user clicks outside the picker.
    useEffect(() => {
        function handleDocumentClick(event: MouseEvent): void {
            if (!containerRef.current) return;
            if (containerRef.current.contains(event.target as Node)) return;
            setIsOpen(false);
        }
        document.addEventListener('mousedown', handleDocumentClick);
        return () => document.removeEventListener('mousedown', handleDocumentClick);
    }, []);

    const handleSelect = useCallback(
        (item: T) => {
            skipNextFetchRef.current = true;
            setQuery(item.label);
            setResults([item]);
            setIsOpen(false);
            setHighlightedIndex(-1);
            onChange(item);
        },
        [onChange]
    );

    const handleKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (results.length === 0) return;
                setIsOpen(true);
                setHighlightedIndex((prev) => (prev + 1) % results.length);
                return;
            }

            if (event.key === 'ArrowUp') {
                event.preventDefault();
                if (results.length === 0) return;
                setIsOpen(true);
                setHighlightedIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
                return;
            }

            if (event.key === 'Enter') {
                if (!isOpen || highlightedIndex < 0) return;
                const target = results[highlightedIndex];
                if (!target) return;
                event.preventDefault();
                handleSelect(target);
                return;
            }

            if (event.key === 'Escape') {
                if (!isOpen) return;
                event.preventDefault();
                setIsOpen(false);
                setHighlightedIndex(-1);
            }
        },
        [handleSelect, highlightedIndex, isOpen, results]
    );

    const resolvedPlaceholder =
        placeholder ?? t('form.searchableSelect.placeholder', 'Buscá una opción');
    const resolvedLoadingLabel = loadingLabel ?? t('form.searchableSelect.loading', 'Buscando...');
    const resolvedEmptyLabel =
        emptyLabel ?? t('form.searchableSelect.empty', 'No hay coincidencias');

    const showDropdown =
        isOpen && (loading || results.length > 0 || query.trim().length >= effectiveMinQuery);
    const showEmpty =
        isOpen && !loading && results.length === 0 && query.trim().length >= effectiveMinQuery;

    // Reset the open state once we have nothing to show in local mode after
    // typing yields zero matches (keeps the dropdown visible to show
    // `emptyLabel`).
    const visibleListbox = showDropdown || showEmpty;

    const activeDescendant = useMemo(() => {
        if (highlightedIndex < 0) return undefined;
        return `${listboxId}-option-${highlightedIndex}`;
    }, [highlightedIndex, listboxId]);

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

            <div className="combobox__input-wrap">
                <input
                    id={fieldId}
                    type="text"
                    role="combobox"
                    className="form-input"
                    value={query}
                    placeholder={resolvedPlaceholder}
                    autoComplete="off"
                    disabled={disabled}
                    aria-autocomplete="list"
                    aria-expanded={visibleListbox}
                    aria-haspopup="listbox"
                    aria-controls={listboxId}
                    aria-activedescendant={activeDescendant}
                    aria-required={required ? 'true' : undefined}
                    aria-invalid={error ? 'true' : undefined}
                    aria-describedby={errorId}
                    data-testid={testId ? `${testId}-input` : undefined}
                    onChange={(event) => {
                        const next = event.target.value;
                        setQuery(next);
                        setIsOpen(true);
                        // Only clear the parent's selection when the user
                        // fully empties the input. Clearing on every
                        // divergent keystroke triggered a feedback loop with
                        // the `value` sync effect that wiped the user's typing
                        // mid-search and made async fetches look broken.
                        if (next === '' && value) {
                            onChange(null);
                        }
                    }}
                    onFocus={() => {
                        if (results.length > 0 || effectiveMinQuery === 0) {
                            setIsOpen(true);
                        }
                    }}
                    onKeyDown={handleKeyDown}
                />
                {loading ? (
                    <span
                        className="combobox__loading-hint"
                        aria-live="polite"
                    >
                        {resolvedLoadingLabel}
                    </span>
                ) : null}

                <div
                    id={listboxId}
                    // biome-ignore lint/a11y/useSemanticElements: custom combobox listbox renders icon + text rows a native <select> cannot
                    role="listbox"
                    tabIndex={-1}
                    className="combobox__listbox"
                    hidden={!visibleListbox}
                    data-testid={testId ? `${testId}-listbox` : undefined}
                >
                    {loading && results.length === 0 ? (
                        <div className="combobox__status">{resolvedLoadingLabel}</div>
                    ) : null}
                    {showEmpty ? (
                        <div className="combobox__status">{resolvedEmptyLabel}</div>
                    ) : null}
                    {results.map((item, index) => {
                        const optionId = `${listboxId}-option-${index}`;
                        const isHighlighted = index === highlightedIndex;
                        const isSelected = value?.id === item.id;
                        const Icon = item.icon;
                        const classes = [
                            'combobox__option',
                            isHighlighted && 'combobox__option--highlighted',
                            isSelected && 'combobox__option--selected'
                        ]
                            .filter(Boolean)
                            .join(' ');
                        return (
                            <button
                                key={item.id}
                                id={optionId}
                                type="button"
                                // biome-ignore lint/a11y/useSemanticElements: button with role=option is the documented ARIA combobox/listbox pattern
                                role="option"
                                aria-selected={isSelected}
                                className={classes}
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    handleSelect(item);
                                }}
                                onMouseEnter={() => setHighlightedIndex(index)}
                                data-testid={testId ? `${testId}-option-${item.id}` : undefined}
                            >
                                {Icon && (
                                    <span
                                        className="combobox__option-icon"
                                        aria-hidden="true"
                                    >
                                        <Icon
                                            size={14}
                                            weight="regular"
                                            aria-hidden="true"
                                        />
                                    </span>
                                )}
                                <span className="combobox__option-label">{item.label}</span>
                            </button>
                        );
                    })}
                    {footer && <div className="combobox__footer">{footer}</div>}
                </div>
            </div>

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
