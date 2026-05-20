/**
 * @file CityDestinationPicker.client.tsx
 * @description Autocomplete React island that lets a user select a CITY-typed
 * destination. Hits `GET /api/v1/public/destinations?destinationType=CITY&q=...`
 * (debounced, min 2 chars) and renders a keyboard-navigable dropdown.
 *
 * Always shows a "no encuentro mi ciudad" link below the input that points to
 * the feedback page with a prefilled subject. Caller controls form state via
 * the `value` prop and is notified of changes via `onSelect` (id + display
 * name).
 *
 * Used by SPEC-095 to replace the free-text city input on the property form
 * with a picker tied to the destinations table.
 */

import { destinationsApi } from '@/lib/api/endpoints';
import { createTranslations } from '@/lib/i18n';
import type { SupportedLocale } from '@/lib/i18n';
import { webLogger } from '@/lib/logger';
import { buildUrlWithParams } from '@/lib/urls';
import type { DestinationPublic } from '@repo/schemas';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import styles from './CityDestinationPicker.module.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum character count before triggering a fetch. */
const MIN_QUERY_LENGTH = 2;

/** Debounce window between keystrokes and an outgoing request, in ms. */
const DEBOUNCE_MS = 300;

/** Maximum results requested per query. */
const MAX_RESULTS = 10;

/** Fallback subject for the feedback link when no localized copy is provided. */
const DEFAULT_FEEDBACK_SUBJECT = 'Solicitud de nueva ciudad';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Public-facing fields the picker reads from each destination result. */
type CityResult = Pick<DestinationPublic, 'id' | 'name'>;

/**
 * Rank an array of city results by relevance against the current query:
 *   1. Exact (case-insensitive) name match first.
 *   2. Prefix matches before substring matches.
 *   3. Alphabetical inside each bucket so order is stable.
 *
 * Done client-side because the API's `q` filter is a substring `ILIKE` —
 * results come back in arbitrary order, which made the dropdown feel "fuzzy /
 * noisy" even when filtering correctly.
 */
export function rankCityResults(items: readonly CityResult[], query: string): CityResult[] {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return [...items];

    return [...items].sort((a, b) => {
        const an = a.name.toLowerCase();
        const bn = b.name.toLowerCase();
        const aExact = an === needle;
        const bExact = bn === needle;
        if (aExact !== bExact) return aExact ? -1 : 1;
        const aStarts = an.startsWith(needle);
        const bStarts = bn.startsWith(needle);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
        return an.localeCompare(bn);
    });
}

/** Selected city snapshot held by the parent form. */
export type CityDestinationValue = {
    readonly id: string;
    readonly name: string;
};

/** Props for {@link CityDestinationPicker}. */
export type CityDestinationPickerProps = {
    /** UI locale for labels, helper copy, and the feedback link target. */
    readonly locale: SupportedLocale;
    /** Currently selected city, if any. Drives the input's display value. */
    readonly value?: CityDestinationValue | null;
    /** Invoked when the user picks a city from the dropdown. */
    readonly onSelect: (id: string, name: string) => void;
    /** Optional inline validation message rendered below the field. */
    readonly error?: string | null;
    /** Optional input id; auto-generated when omitted. */
    readonly inputId?: string;
    /** Optional placeholder. Falls back to a localized default. */
    readonly placeholder?: string;
    /** Marks the field as required for assistive tech. */
    readonly required?: boolean;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Autocomplete picker for CITY destinations.
 *
 * @param props - Component props (see {@link CityDestinationPickerProps}).
 * @returns A React island rendering an input + dropdown + fallback link.
 */
export function CityDestinationPicker({
    locale,
    value,
    onSelect,
    error,
    inputId,
    placeholder,
    required = false
}: CityDestinationPickerProps) {
    const { t } = createTranslations(locale);
    const generatedId = useId();
    const fieldId = inputId ?? `city-destination-picker-${generatedId}`;
    const listboxId = `${fieldId}-listbox`;

    const [inputValue, setInputValue] = useState<string>(value?.name ?? '');
    const [results, setResults] = useState<readonly CityResult[]>([]);
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

    const containerRef = useRef<HTMLDivElement | null>(null);
    const skipNextFetchRef = useRef<boolean>(false);

    // Sync input when the controlled value changes from the outside.
    useEffect(() => {
        setInputValue(value?.name ?? '');
    }, [value?.name]);

    // Debounced fetch on input change.
    useEffect(() => {
        if (skipNextFetchRef.current) {
            skipNextFetchRef.current = false;
            return;
        }

        const trimmed = inputValue.trim();
        if (trimmed.length < MIN_QUERY_LENGTH) {
            setResults([]);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);

        const handle = window.setTimeout(async () => {
            try {
                const response = await destinationsApi.list({
                    destinationType: 'CITY',
                    q: trimmed,
                    pageSize: MAX_RESULTS
                });
                if (cancelled) return;

                if (!response.ok) {
                    webLogger.warn('CityDestinationPicker fetch failed', {
                        error: response.error.message
                    });
                    setResults([]);
                    return;
                }

                const items = response.data.items
                    .filter(
                        (item: DestinationPublic): item is DestinationPublic & { id: string } =>
                            typeof item.id === 'string'
                    )
                    .map(
                        (item: DestinationPublic): CityResult => ({
                            id: item.id,
                            name: item.name
                        })
                    );

                const ranked = rankCityResults(items, trimmed);
                setResults(ranked);
                setHighlightedIndex(ranked.length > 0 ? 0 : -1);
                setIsOpen(ranked.length > 0);
            } catch (err) {
                if (cancelled) return;
                webLogger.warn('CityDestinationPicker fetch threw', {
                    error: err instanceof Error ? err.message : String(err)
                });
                setResults([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }, DEBOUNCE_MS);

        return () => {
            cancelled = true;
            window.clearTimeout(handle);
        };
    }, [inputValue]);

    // Close on outside click.
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
        (item: CityResult) => {
            skipNextFetchRef.current = true;
            setInputValue(item.name);
            setResults([]);
            setIsOpen(false);
            setHighlightedIndex(-1);
            onSelect(item.id, item.name);
        },
        [onSelect]
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

    const feedbackSubject = t(
        'host.form.sections.ubicacion.cityPicker.feedbackSubject',
        DEFAULT_FEEDBACK_SUBJECT
    );

    const feedbackHref = useMemo(
        () =>
            buildUrlWithParams({
                locale,
                path: 'feedback',
                params: { subject: feedbackSubject }
            }),
        [locale, feedbackSubject]
    );

    const helperLabel = t(
        'host.form.sections.ubicacion.cityPicker.notFoundLink',
        'No encuentro mi ciudad'
    );
    const placeholderLabel =
        placeholder ??
        t('host.form.sections.ubicacion.cityPicker.placeholder', 'Buscá tu ciudad (mín. 2 letras)');
    const loadingLabel = t(
        'host.form.sections.ubicacion.cityPicker.loading',
        'Buscando ciudades...'
    );
    const emptyLabel = t('host.form.sections.ubicacion.cityPicker.empty', 'No hay coincidencias');

    const showDropdown = isOpen && (loading || results.length > 0);
    const errorId = error ? `${fieldId}-error` : undefined;

    return (
        <div
            ref={containerRef}
            className={styles.root}
        >
            <div className={styles.combobox}>
                <input
                    id={fieldId}
                    type="text"
                    role="combobox"
                    className={`${styles.input} ${error ? styles.inputError : ''}`}
                    value={inputValue}
                    placeholder={placeholderLabel}
                    autoComplete="off"
                    aria-autocomplete="list"
                    aria-expanded={showDropdown}
                    aria-haspopup="listbox"
                    aria-controls={listboxId}
                    aria-activedescendant={
                        highlightedIndex >= 0
                            ? `${listboxId}-option-${highlightedIndex}`
                            : undefined
                    }
                    aria-required={required ? 'true' : undefined}
                    aria-invalid={error ? 'true' : undefined}
                    aria-describedby={errorId}
                    onChange={(event) => {
                        setInputValue(event.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => {
                        if (results.length > 0) setIsOpen(true);
                    }}
                    onKeyDown={handleKeyDown}
                />
                {loading ? (
                    <span
                        className={styles.loadingHint}
                        aria-live="polite"
                    >
                        {loadingLabel}
                    </span>
                ) : null}
            </div>

            <div
                id={listboxId}
                // biome-ignore lint/a11y/useSemanticElements: custom autocomplete dropdown renders rich items <select> cannot
                role="listbox"
                tabIndex={-1}
                className={`${styles.listbox} ${showDropdown ? styles.listboxOpen : ''}`}
                hidden={!showDropdown}
            >
                {loading && results.length === 0 ? (
                    <div className={styles.statusItem}>{loadingLabel}</div>
                ) : null}
                {!loading && results.length === 0 ? (
                    <div className={styles.statusItem}>{emptyLabel}</div>
                ) : null}
                {results.map((item, index) => {
                    const optionId = `${listboxId}-option-${index}`;
                    const isHighlighted = index === highlightedIndex;
                    return (
                        <div
                            key={item.id}
                            id={optionId}
                            // biome-ignore lint/a11y/useSemanticElements: keyboard-navigable autocomplete listbox cannot use a native <option>
                            role="option"
                            tabIndex={-1}
                            aria-selected={isHighlighted}
                            className={`${styles.option} ${
                                isHighlighted ? styles.optionHighlighted : ''
                            }`}
                            onMouseDown={(event) => {
                                event.preventDefault();
                                handleSelect(item);
                            }}
                            onMouseEnter={() => setHighlightedIndex(index)}
                        >
                            <span className={styles.optionName}>{item.name}</span>
                        </div>
                    );
                })}
            </div>

            <a
                href={feedbackHref}
                className={styles.notFoundLink}
                data-testid="city-picker-not-found"
            >
                {helperLabel}
            </a>

            {error ? (
                <p
                    id={errorId}
                    className={styles.fieldError}
                    role="alert"
                >
                    {error}
                </p>
            ) : null}
        </div>
    );
}
